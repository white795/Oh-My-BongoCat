# 贡献指南

本指南适用于 [white795/Oh-My-BongoCat](https://github.com/white795/Oh-My-BongoCat)，
稳定主分支为 `main`。上游 `ayangweb/BongoCat` 是来源仓库，不是本分支功能 PR 的目标。
开发前请阅读 [AGENTS.md](../AGENTS.md) 与 [main 文档入口](../docs/branches/main/todo.md)。

## 透明的开发

所有工作都在 GitHub 上公开进行。无论是核心团队成员还是外部贡献者的 Pull Request，都需要经过相同的 review 流程。

## 问题反馈

本仓库目前未开启 Issues。问题可联系 [维护者](https://github.com/white795)，或在
[相关 PR](https://github.com/white795/Oh-My-BongoCat/pulls) 中讨论；开启 Issues 后使用
[本仓库 Issues](https://github.com/white795/Oh-My-BongoCat/issues)。

Bug 报告请包含软件版本、触发条件和可复现步骤；功能建议请说明目标及边界。
请勿将本分支新增的 Agent 联动问题直接提交到上游。

## 提交 Pull Request

### 共建流程

- 先与维护者确认任务范围，避免重复或无关改动。
- 从 `main` 建立独立任务分支；并行工作使用不同 worktree，计划保存在自己的分支文档目录。
- 按变更范围运行测试和静态检查；涉及运行表现时，先完成 Windows dev 验收。
- PR 的 base repository 选 `white795/Oh-My-BongoCat`，base branch 选 `main`，由维护者审阅后合入。

### 准备工作

- [Rust](https://v2.tauri.app/start/prerequisites/): 请自行根据官网步骤安装 rust 环境。
- [Node.js](https://nodejs.org/en/): 用于运行项目。
- [Pnpm](https://pnpm.io/)：本项目使用 Pnpm 进行包管理。

### 下载依赖

仅首次准备工作副本时安装；已有 Windows 副本保留 `node_modules` 和 `target`，不要通过重复制
仓库或重装依赖代替增量同步。Windows PowerShell 使用：

```shell
pnpm.cmd install
```

### 启动应用

```shell
pnpm.cmd tauri dev
```

维护者的 Windows 构建与实机验收目录为 `D:\VibeTool\BongoCat`，具体同步及检查流程见
[AGENTS.md](../AGENTS.md)。WSL / Linux 使用 `pnpm` 命令，不以 WSL 构建代替 Windows 验收。

### 打包应用

只有 Windows dev 验收通过后才生成安装包；构建由用户执行。

```shell
pnpm.cmd tauri build
```

## Commit 指南

Commit messages 请遵循[conventional-changelog 标准](https://www.conventionalcommits.org/en/v1.0.0/)。

### Commit 类型

以下是 commit 类型列表:

- feat: 新特性或功能
- fix: 缺陷修复
- docs: 文档更新
- style: 代码风格更新
- refactor: 代码重构，不引入新功能和缺陷修复
- perf: 性能优化
- chore: 其他提交

本项目的 PR 流程不改变助手的 Git 只读约定；提交、推送和合并由用户执行。
