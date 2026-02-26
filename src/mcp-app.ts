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

let app: App | null = null;
let viewer: XMindEmbedViewer | null = null;
let currentXMindMark = '';
let updateTimer: number | null = null;

const editor = document.getElementById('editor') as HTMLTextAreaElement;
const viewerContainer = document.getElementById('viewer-container') as HTMLDivElement;
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const fitBtn = document.getElementById('fit-btn') as HTMLButtonElement;
const zoomFitBtn = document.getElementById('zoom-fit') as HTMLButtonElement;

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
    el: viewerContainer,
    region: 'cn',
    styles: {
      width: '100%',
      height: '100%',
    },
  });

  showStatus('查看器已就绪');
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
    const arrayBuffer = await parseXMindMarkToXMindFile(normalized);
    viewer.load(arrayBuffer);
    currentXMindMark = normalized;
    showStatus('思维导图已更新');
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

  app.ontoolresult = async () => {
    // create_view 的核心数据在 tool input 中，这里无需重复处理
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

async function exportToXMind(): Promise<void> {
  if (!currentXMindMark) {
    showError('没有可导出的内容');
    return;
  }

  try {
    const fileBuffer = await parseXMindMarkToXMindFile(currentXMindMark);
    const blob = new Blob([fileBuffer], { type: 'application/vnd.xmind.workbook' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xmindify-map.xmind';
    link.click();
    URL.revokeObjectURL(url);

    if (app) {
      await app.callServerTool({
        name: 'export_to_xmind',
        arguments: { xmindmark: currentXMindMark },
      });
    }

    showStatus('导出成功');
  } catch (error) {
    console.error('Export failed:', error);
    showError('导出失败: ' + (error as Error).message);
  }
}

async function setZoom(scale: number): Promise<void> {
  if (viewer) {
    viewer.setZoomScale(scale);
    showStatus(`缩放: ${scale}%`);
  }

  if (app) {
    try {
      await app.callServerTool({
        name: 'set_zoom',
        arguments: { zoom: scale },
      });
    } catch (error) {
      console.error('Failed to call set_zoom:', error);
    }
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
    void exportToXMind();
  });
  fitBtn.addEventListener('click', fitToWindow);
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
