/**
 * Cloudflare Workers 入口
 * MCP Server with Streamable HTTP transport
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { XMINDMARK_REFERENCE } from './lib/xmindmark-reference.js';
import { HTML_RESOURCE } from './resources.js';

// 类型定义
type Bindings = {
  REGION?: string;
};

// 创建 Hono 应用
const app = new Hono<{ Bindings: Bindings }>();

// 启用 CORS（浏览器端 MCP 客户端需要读取会话相关响应头）
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'content-type',
      'accept',
      'mcp-protocol-version',
      'mcp-session-id',
      'last-event-id',
    ],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
  })
);

// MCP 端点路径
const MCP_PATH = '/mcp';

type SessionEntry = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

const sessions = new Map<string, SessionEntry>();

/**
 * 创建 MCP 服务器实例
 */
function createMCPServer() {
  const server = new McpServer({
    name: 'xmindify-mcp',
    version: '1.0.0',
  });

  // 注册 MCP 资源（HTML UI）
  registerAppResource(
    server,
    'XMindify UI',
    'ui://xmindify/mcp-app.html',
    {
      description: 'Interactive XMind mind map editor and viewer',
      _meta: {
        ui: {
          csp: {
            frameDomains: ['https://www.xmind.app', 'https://www.xmind.cn'],
          },
        },
      },
    },
    async () => {
      return {
        contents: [
          {
            uri: 'ui://xmindify/mcp-app.html',
            mimeType: RESOURCE_MIME_TYPE,
            text: HTML_RESOURCE,
          },
        ],
      };
    }
  );

  // 注册 read_me 工具
  server.registerTool(
    'read_me',
    {
      description: '返回 XMindMark 语法规范和示例，用于了解如何格式化思维导图内容',
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: XMINDMARK_REFERENCE,
          },
        ],
      };
    }
  );

  // 定义 inputSchema
  const createViewSchema = {
    xmindmark: z.string().describe('XMindMark 格式的思维导图文本'),
  };

  // 注册 create_view 工具 (带 UI)
  registerAppTool(
    server,
    'create_view',
    {
      title: '创建思维导图',
      description: '根据 XMindMark 格式创建并渲染思维导图',
      inputSchema: createViewSchema,
      annotations: {
        readOnlyHint: true,
      },
      _meta: {
        ui: {
          resourceUri: 'ui://xmindify/mcp-app.html',
        },
      },
    },
    async (args: any) => {
      const { xmindmark } = args;
      return {
        content: [
          {
            type: 'text',
            text: xmindmark,
          },
        ],
      };
    }
  );

  // 注册 update_view 工具 (仅 UI 可见)
  registerAppTool(
    server,
    'update_view',
    {
      description: '更新当前思维导图的内容',
      _meta: {
        ui: {
          visibility: ['app'],
        },
      },
    },
    async (args: any) => {
      const { xmindmark } = args;
      return {
        content: [
          {
            type: 'text',
            text: xmindmark || '',
          },
        ],
      };
    }
  );

  // 注册 export_to_xmind 工具 (仅 UI 可见)
  registerAppTool(
    server,
    'export_to_xmind',
    {
      description: '将当前思维导图导出为 XMind 二进制格式',
      _meta: {
        ui: {
          visibility: ['app'],
        },
      },
    },
    async (args: any) => {
      const { xmindmark } = args;
      // 在前端处理转换，这里返回原始数据
      return {
        content: [
          {
            type: 'text',
            text: xmindmark || '',
          },
        ],
      };
    }
  );

  // 注册 set_zoom 工具 (仅 UI 可见)
  registerAppTool(
    server,
    'set_zoom',
    {
      description: '设置查看器缩放级别',
      _meta: {
        ui: {
          visibility: ['app'],
        },
      },
    },
    async (args: any) => {
      const { zoom } = args;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ zoom }),
          },
        ],
      };
    }
  );

  return server;
}

function isInitializeRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const message = body as { method?: unknown };
  return message.method === 'initialize';
}

async function resolveTransport(
  request: Request,
  parsedBody: unknown
): Promise<WebStandardStreamableHTTPServerTransport | Response> {
  const sessionId = request.headers.get('mcp-session-id');

  if (sessionId) {
    const existingSession = sessions.get(sessionId);
    if (!existingSession) {
      return new Response('Invalid or missing session ID', { status: 400 });
    }
    return existingSession.transport;
  }

  if (request.method !== 'POST' || !isInitializeRequest(parsedBody)) {
    return new Response('Bad Request: No valid session ID provided', { status: 400 });
  }

  const server = createMCPServer();
  let transport!: WebStandardStreamableHTTPServerTransport;
  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { server, transport });
    },
    onsessionclosed: (closedSessionId) => {
      sessions.delete(closedSessionId);
    },
  });

  await server.connect(transport);

  return transport;
}

/**
 * Streamable HTTP 端点处理
 */
app.all(MCP_PATH, async (c) => {
  const rawRequest = c.req.raw;
  const contentType = c.req.header('content-type') || '';
  const parsedBody =
    rawRequest.method === 'POST' && contentType.includes('application/json')
      ? await c.req.json().catch(() => ({}))
      : undefined;

  const resolved = await resolveTransport(rawRequest, parsedBody);
  if (resolved instanceof Response) {
    return resolved;
  }

  return resolved.handleRequest(rawRequest, { parsedBody });
});

/**
 * 健康检查端点
 */
app.get('/', (c) => {
  return c.json({
    name: 'xmindify-mcp',
    version: '1.0.0',
    endpoints: {
      mcp: MCP_PATH,
      ui: '/ui',
    },
  });
});

/**
 * UI 端点 - 提供 HTML 界面
 */
app.get('/ui', (c) => {
  return c.html(HTML_RESOURCE);
});

/**
 * XMindMark 转换 API
 * 将 XMindMark 文本转换为 XMind 二进制格式
 */
app.post('/api/convert', async (c) => {
  try {
    const { xmindmark } = await c.req.json();

    if (!xmindmark || typeof xmindmark !== 'string') {
      return c.json({ error: 'Invalid xmindmark parameter' }, 400);
    }

    // 使用 xmindmark 包进行转换
    const xmindmarkModule = await import('xmindmark');
    const parseXMindMarkToXMindFile =
      xmindmarkModule.parseXMindMarkToXMindFile ?? xmindmarkModule.default?.parseXMindMarkToXMindFile;

    if (!parseXMindMarkToXMindFile) {
      throw new Error('xmindmark parser is not available');
    }

    const arrayBuffer = await parseXMindMarkToXMindFile(xmindmark);

    // 将 ArrayBuffer 转换为 base64 以便传输
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);

    return c.json({
      success: true,
      data: base64,
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 500);
  }
});

/**
 * 导出 Cloudflare Workers
 */
export default app;

/**
 * 导出用于 stdio 模式的入口
 */
export async function runStdioServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
