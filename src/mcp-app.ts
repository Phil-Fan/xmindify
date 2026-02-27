/**
 * XMindify MCP App
 * 前端应用逻辑
 */

import {
  App,
  type McpUiHostContext,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from '@modelcontextprotocol/ext-apps';
import { XMindEmbedViewer } from 'xmind-embed-viewer';
import { parseXMindMarkToXMindFile } from 'xmindmark';
import { createMapByXMindMark } from 'xmindmark/dist/src/parser/mindmark.js';

let app: App | null = null;
let viewer: XMindEmbedViewer | null = null;
let currentXMindMark = '';
let updateTimer: number | null = null;

const editor = document.getElementById('editor') as HTMLTextAreaElement;
const viewerFrame = document.getElementById('viewer-frame') as HTMLIFrameElement;
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const zoomFitBtn = document.getElementById('zoom-fit') as HTMLButtonElement;

type SvgTopicNode = {
  title: string;
  children: SvgTopicNode[];
  width: number;
  x: number;
  y: number;
};

const SVG_NODE_HEIGHT = 40;
const SVG_VERTICAL_GAP = 56;
const SVG_HORIZONTAL_GAP = 220;
const SVG_PADDING_X = 40;
const SVG_PADDING_Y = 40;

function showStatus(message: string, duration = 2000): void {
  statusEl.textContent = message;
  statusEl.classList.add('show');
  window.setTimeout(() => {
    statusEl.classList.remove('show');
  }, duration);
}

function showLoading(show: boolean): void {
  loadingEl.style.display = show ? 'flex' : 'none';
}

function showError(message: string): void {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  window.setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}

function applyContextStyles(ctx: Partial<McpUiHostContext> | undefined): void {
  if (!ctx) {
    return;
  }

  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }

  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }

  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
}

function initViewer(): void {
  viewer = new XMindEmbedViewer({
    el: viewerFrame,
    region: 'global',
    styles: {
      width: '100%',
      height: '100%',
    },
  });

  showStatus('查看器已就绪');
}

function stripUnsupportedMarkers(line: string): string {
  return line
    .replace(/\[(?:S|B)\d+\]/gi, '')
    .replace(/\[\^\d+\](\([^)]+\))?/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

function toSafeXMindMark(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  const rawLines = normalized.split('\n');
  const firstContentIndex = rawLines.findIndex((line) => line.trim().length > 0);

  if (firstContentIndex < 0) {
    return '';
  }

  const rootTitle = stripUnsupportedMarkers(rawLines[firstContentIndex].trim());
  const output: string[] = [rootTitle || '思维导图'];

  for (let i = firstContentIndex + 1; i < rawLines.length; i++) {
    const source = rawLines[i];
    if (!source.trim()) {
      continue;
    }

    const line = source.replace(/^\s*>\s?/, '');
    const headingMatch = line.match(/^(\s*)#{1,6}\s+(.*)$/);
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);

    let indent = '';
    let content = '';

    if (headingMatch) {
      const headingLevel = (line.match(/^(\s*)(#{1,6})\s+/)?.[2].length ?? 1) - 1;
      indent = '  '.repeat(Math.max(0, headingLevel));
      content = headingMatch[2];
    } else if (listMatch) {
      indent = listMatch[1];
      content = listMatch[3];
    } else {
      const plainMatch = line.match(/^(\s*)(.*)$/);
      indent = plainMatch?.[1] ?? '';
      content = plainMatch?.[2] ?? line;
    }

    const cleaned = stripUnsupportedMarkers(content).trim();
    if (!cleaned) {
      continue;
    }

    output.push(`${indent.replace(/\t/g, '  ')}- ${cleaned}`);
  }

  return output.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAttachedChildren(topic: any): any[] {
  const attached = topic?.children?.attached;
  return Array.isArray(attached) ? attached : [];
}

function formatTopicTitle(rawTitle: unknown): string {
  const text = String(rawTitle ?? '').trim();
  if (!text) {
    return '未命名主题';
  }

  const maxChars = 34;
  const chars = [...text];
  return chars.length > maxChars ? `${chars.slice(0, maxChars - 1).join('')}…` : text;
}

function estimateNodeWidth(title: string): number {
  const charCount = [...title].length;
  return Math.max(92, Math.min(260, 44 + charCount * 9));
}

function toSvgTopicNode(topic: any): SvgTopicNode {
  const title = formatTopicTitle(topic?.title);
  const children = getAttachedChildren(topic).map((child) => toSvgTopicNode(child));
  return {
    title,
    children,
    width: estimateNodeWidth(title),
    x: 0,
    y: 0,
  };
}

function getLeafCount(node: SvgTopicNode): number {
  if (node.children.length === 0) {
    return 1;
  }

  return node.children.reduce((sum, child) => sum + getLeafCount(child), 0);
}

function getMaxDepth(node: SvgTopicNode): number {
  if (node.children.length === 0) {
    return 0;
  }

  return 1 + Math.max(...node.children.map((child) => getMaxDepth(child)));
}

function layoutSvgTree(node: SvgTopicNode, depth: number, nextLeafIndex: { value: number }): void {
  node.x = SVG_PADDING_X + depth * SVG_HORIZONTAL_GAP;

  if (node.children.length === 0) {
    node.y = SVG_PADDING_Y + nextLeafIndex.value * SVG_VERTICAL_GAP;
    nextLeafIndex.value += 1;
    return;
  }

  for (const child of node.children) {
    layoutSvgTree(child, depth + 1, nextLeafIndex);
  }

  node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
}

function collectSvgNodes(
  node: SvgTopicNode,
  nodes: SvgTopicNode[],
  links: Array<{ from: SvgTopicNode; to: SvgTopicNode }>
): void {
  nodes.push(node);
  for (const child of node.children) {
    links.push({ from: node, to: child });
    collectSvgNodes(child, nodes, links);
  }
}

function buildSvgFromXMindMark(xmindmarkText: string): string {
  const map = createMapByXMindMark(xmindmarkText);
  const rootTopic = toSvgTopicNode(map.rootTopic);
  const leafCount = getLeafCount(rootTopic);
  const maxDepth = getMaxDepth(rootTopic);
  layoutSvgTree(rootTopic, 0, { value: 0 });

  const nodes: SvgTopicNode[] = [];
  const links: Array<{ from: SvgTopicNode; to: SvgTopicNode }> = [];
  collectSvgNodes(rootTopic, nodes, links);

  const maxNodeWidth = nodes.reduce((max, node) => Math.max(max, node.width), 0);
  const width = SVG_PADDING_X * 2 + maxDepth * SVG_HORIZONTAL_GAP + maxNodeWidth;
  const height = Math.max(
    240,
    SVG_PADDING_Y * 2 + Math.max(leafCount - 1, 0) * SVG_VERTICAL_GAP + SVG_NODE_HEIGHT
  );

  const linkSvg = links
    .map(({ from, to }) => {
      const fromX = from.x + from.width / 2;
      const toX = to.x - to.width / 2;
      const c1 = fromX + 30;
      const c2 = toX - 30;
      return `<path d="M ${fromX} ${from.y} C ${c1} ${from.y}, ${c2} ${to.y}, ${toX} ${to.y}" />`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map((node) => {
      const isRoot = node === rootTopic;
      const fill = isRoot ? '#2563eb' : '#ffffff';
      const stroke = isRoot ? '#1d4ed8' : '#cbd5e1';
      const textColor = isRoot ? '#ffffff' : '#0f172a';
      const x = node.x - node.width / 2;
      const y = node.y - SVG_NODE_HEIGHT / 2;

      return `<g>
  <rect x="${x}" y="${y}" width="${node.width}" height="${SVG_NODE_HEIGHT}" rx="12" fill="${fill}" stroke="${stroke}" />
  <text x="${node.x}" y="${node.y + 5}" text-anchor="middle" fill="${textColor}">${escapeXml(node.title)}</text>
</g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#f8fafc" />
<g fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round">
${linkSvg}
</g>
<g font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="500">
${nodeSvg}
</g>
</svg>`;
}

function extractXMindMarkFromToolResult(result: any): string {
  const structured = result?.structuredContent;
  if (structured && typeof structured.xmindmark === 'string') {
    return structured.xmindmark;
  }

  const textContent = Array.isArray(result?.content)
    ? result.content.find((item: any) => item?.type === 'text' && typeof item?.text === 'string')?.text
    : '';
  return typeof textContent === 'string' ? textContent : '';
}

async function renderFromXMindMark(xmindmarkText: string): Promise<void> {
  if (!viewer) {
    return;
  }

  const normalized = xmindmarkText.trim();
  if (!normalized) {
    currentXMindMark = '';
    return;
  }

  try {
    showLoading(true);
    try {
      const arrayBuffer = await parseXMindMarkToXMindFile(normalized);
      viewer.load(arrayBuffer);
      currentXMindMark = normalized;
      showStatus('思维导图已更新');
      return;
    } catch {
      const safeText = toSafeXMindMark(normalized);
      if (!safeText) {
        throw new Error('内容为空或无法识别为有效结构');
      }

      const retryBuffer = await parseXMindMarkToXMindFile(safeText);
      viewer.load(retryBuffer);
      currentXMindMark = safeText;
      showStatus('已自动规范化后渲染');
    }
  } catch (error) {
    console.error('Failed to render XMindMark:', error);
    showError('解析 XMindMark 失败: ' + (error as Error).message);
  } finally {
    showLoading(false);
  }
}

async function initMCPApp(): Promise<void> {
  app = new App({
    name: 'xmindify-mcp-app',
    version: '1.0.0',
  });

  app.onhostcontextchanged = (ctx) => {
    applyContextStyles(ctx);
  };

  app.ontoolinput = async ({ arguments: args }) => {
    const xmindmarkText = typeof args?.xmindmark === 'string' ? args.xmindmark : '';
    editor.value = xmindmarkText;
    await renderFromXMindMark(xmindmarkText);
  };

  app.ontoolresult = async (result) => {
    const xmindmarkText = extractXMindMarkFromToolResult(result);
    if (!xmindmarkText) {
      return;
    }

    editor.value = xmindmarkText;
    await renderFromXMindMark(xmindmarkText);
  };

  app.onteardown = async () => {
    if (updateTimer) {
      window.clearTimeout(updateTimer);
      updateTimer = null;
    }

    return {};
  };

  await app.connect();
  applyContextStyles(app.getHostContext());
}

function handleEditorInput(): void {
  if (updateTimer) {
    window.clearTimeout(updateTimer);
  }

  updateTimer = window.setTimeout(async () => {
    const text = editor.value;
    if (text.trim() && text.trim() !== currentXMindMark) {
      await renderFromXMindMark(text);

      if (app) {
        try {
          await app.callServerTool({
            name: 'update_view',
            arguments: { xmindmark: text },
          });
        } catch (error) {
          console.error('Failed to call update_view:', error);
        }
      }
    }
  }, 500);
}

async function exportToSVG(): Promise<void> {
  if (!currentXMindMark) {
    showError('没有可导出的内容');
    return;
  }

  try {
    const svg = buildSvgFromXMindMark(currentXMindMark);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xmindify-map.svg';
    link.click();
    URL.revokeObjectURL(url);

    showStatus('SVG 导出成功');
  } catch (error) {
    console.error('Export failed:', error);
    showError('导出失败: ' + (error as Error).message);
  }
}

function fitToWindow(): void {
  if (!viewer) {
    return;
  }

  viewer.setFitMap();
  showStatus('已适应窗口');
}

function initEventListeners(): void {
  editor.addEventListener('input', handleEditorInput);
  exportBtn.addEventListener('click', () => {
    void exportToSVG();
  });
  zoomFitBtn.addEventListener('click', fitToWindow);
}

async function bootstrap(): Promise<void> {
  initViewer();
  await initMCPApp();
  initEventListeners();
  console.log('XMindify MCP App ready');
}

void bootstrap().catch((error) => {
  console.error('Failed to bootstrap app:', error);
  showError('应用初始化失败');
});
