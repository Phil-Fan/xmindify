# 贡献指南

感谢你对 XMindify Skills 的关注！

## 如何贡献

### 报告问题

在 [GitHub Issues](https://github.com/Phil-Fan/xmindify/issues) 中提交问题，请包含：

- 问题描述
- 复现步骤
- 期望行为
- 实际行为
- 环境信息（OS、xmindmark 版本等）

### 提交代码

1. **Fork 本仓库**

2. **创建特性分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **进行修改**

   - 遵循现有代码风格
   - 添加必要的文档
   - 更新相关场景模板

4. **提交更改**

   ```bash
   git add .
   git commit -m "feat: add xxx scenario"
   ```

   提交信息格式建议：
   - `feat:` - 新功能
   - `fix:` - 修复 bug
   - `docs:` - 文档更新
   - `style:` - 代码格式
   - `refactor:` - 重构
   - `test:` - 测试
   - `chore:` - 构建/工具

5. **推送并创建 Pull Request**

   ```bash
   git push origin feature/your-feature-name
   ```

## 开发规范

### 场景模板规范

新增场景模板时：

1. 在 `scenarios/` 目录创建 `.md` 文件
2. 使用统一的模板结构：

   ```markdown
   # 场景名称

   ## 适用场景
   简短描述

   ## XMindMark 模板
   实际模板代码

   ## 使用说明
   补充说明
   ```

3. 在 `SKILL.md` 的场景路由表中添加对应条目

### 文档规范

- 使用中文编写文档
- 代码块使用语法高亮
- 链接使用相对路径

### 代码风格

- Shell 脚本遵循 [ShellCheck](https://www.shellcheck.net/) 规范
- 使用 4 空格缩进
- 行宽不超过 100 字符

## 测试

在提交 PR 前，请确保：

1. 转换脚本可正常执行
2. 场景模板生成的 XMindMark 语法正确
3. 生成的思维导图在 XMind 中可正常打开

## 许可证

提交代码即表示你同意将代码以 MIT 许可证发布。
