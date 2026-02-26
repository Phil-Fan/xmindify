/**
 * 构建后脚本：将生成的 HTML 内容注入到 src/resources.ts 中
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const paths = {
  html: path.resolve(__dirname, '../resources/src/mcp-app.html'),
  resources: path.resolve(__dirname, '../src/resources.ts'),
};

// 读取生成的 HTML 文件
const htmlContent = fs.readFileSync(paths.html, 'utf-8');

// 创建 resources.ts 文件内容（不包含时间戳以避免不必要的重建）
const resourcesContent = `/**
 * MCP App UI 资源
 * 此文件由构建脚本自动生成，请勿手动编辑
 */

export const HTML_RESOURCE = ${JSON.stringify(htmlContent)};
`;

// 检查文件是否已存在且内容相同
const existingContent = fs.existsSync(paths.resources)
  ? fs.readFileSync(paths.resources, 'utf-8')
  : null;

if (existingContent !== resourcesContent) {
  // 只在内容改变时写入
  fs.writeFileSync(paths.resources, resourcesContent, 'utf-8');
  console.log('✓ Updated src/resources.ts with embedded HTML');
  console.log(`  HTML size: ${(htmlContent.length / 1024).toFixed(2)} KB`);
} else {
  console.log('✓ src/resources.ts already up to date');
}
