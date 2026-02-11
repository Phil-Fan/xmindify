#!/bin/bash
# XMindMark 转换脚本
# 用法: ./convert.sh <input.xmindmark> [output_dir]

set -e

# 检查 xmindmark CLI 是否已安装
if ! command -v xmindmark &> /dev/null; then
    echo "⚠️  xmindmark CLI 未安装"
    echo ""
    echo "请选择以下方式之一安装:"
    echo ""
    echo "方式1: 全局安装 (推荐)"
    echo "  pnpm install -g xmindmark"
    echo ""
    echo "方式2: 从源码链接 (本项目开发中)"
    echo "  cd /Users/philfan/CodeSource/xmind/xmindmark"
    echo "  pnpm install"
    echo "  pnpm run build"
    echo "  pnpm link"
    echo ""
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_DIR="${2:-output}"

# 检查输入文件
if [ -z "$INPUT_FILE" ]; then
    echo "用法: $0 <input.xmindmark> [output_dir]"
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo "错误: 文件不存在: $INPUT_FILE"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "🔄 正在转换 $INPUT_FILE ..."

# 获取文件名（不含扩展名）
BASENAME=$(basename "$INPUT_FILE" .xmindmark)

# 转换为 XMind
xmindmark -f xmind -o "$OUTPUT_DIR" "$INPUT_FILE"
echo "✅ 已生成 XMind 文件: $OUTPUT_DIR/$BASENAME.xmind"

# 转换为 SVG
xmindmark -f svg -o "$OUTPUT_DIR" "$INPUT_FILE"
echo "✅ 已生成 SVG 文件: $OUTPUT_DIR/$BASENAME.svg"

echo "✨ 完成!"
