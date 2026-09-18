# Plan 002: Personal Windows Distribution

- Status: completed
- Summary: [summary-002-personal-distribution.md](../summaries/summary-002-personal-distribution.md)

## Goal

生成一个可供个人安装的 Windows NSIS 安装包：显示名称继续使用 `BongoCat`，但应用身份与上游版本隔离，并且不检查、下载或安装上游更新。

## Context

- 输入统计功能已在 Plan 001 完成、提交并由用户推送。
- 用户确认应用显示名称保持 `BongoCat`，新的应用 identifier 使用 `com.white795.bongocat.stats`。
- 用户不需要保留此前开发版产生的测试统计数据。
- Plan 004 的 Codex 氛围灯集成已完成开发态验收；首次以 `1.3.0` 生成包含该能力的安装包。
- 用户已在安装前手动备份现有正式版统计数据。
- `1.3.0` 已成功构建并安装；其管理员进程不能接收普通权限 single-instance dispatcher 的问题
  已由 [Plan 005](plan-005-cross-integrity-ambient-ipc.md) 使用 named pipe 修复。

## Scope

- 将各平台 Tauri 配置的 identifier 统一为新的个人版本 identifier。
- 保留现有产品名称、图标和 Windows NSIS 打包方式。
- 将应用与 Rust crate 版本统一更新为当前个人发行版本 `1.4.0`。
- 移除自动更新的运行时注册、更新服务端点、设置/托盘/关于页入口和打包更新产物。
- 在 Windows 原生工具链中生成并定位 NSIS 安装包。

## Non-goals

- 不建立新的更新服务器、签名密钥或自动发布流程。
- 不更换应用名称、图标或上游署名信息。
- 不修改 GitHub Actions 的上游发布工作流；自用本地打包不会使用它。
- 不构建或验证 macOS、Linux 安装包。

## Tasks

1. [completed] 确认个人版本 identifier、显示名称和更新策略。
2. [completed] 隔离 identifier，并关闭自动更新的配置、运行时和 UI 入口。
3. [completed] 执行 Tauri 配置复核；WSL 未安装 pnpm/Rust，前端与 Rust 检查改在 Windows 构建中执行。
4. [completed] 已同步必要文件到 Windows 工作区，并成功生成 `BongoCat_1.1.0_x64-setup.exe`。
5. [completed] `1.4.0` 已完成 Windows dev、NSIS 安装、管理员 BongoCat + 普通权限 agent
   跨权限验收，并在真实使用中复核统计、hook 与氛围灯行为。

## Acceptance

- 安装包的显示名称为 `BongoCat`，应用 identifier 为 `com.white795.bongocat.stats`。
- 应用不会显示检查更新入口，也没有可用的 updater Tauri 插件或上游更新端点。
- 不生成 updater 签名/更新清单产物。
- Windows 构建命令成功，并生成可安装的 `.exe`（NSIS）文件。
- 安装后的个人版本能正常打开，且统计数据保存到与上游版本不同的应用数据目录。
- 管理员权限安装版能通过 named pipe 接收普通权限 WSL Codex 的真实 hook。

## Risks / Dependencies

- 新 identifier 会建立新的应用数据目录；之前位于旧 identifier 目录下的测试统计不会自动迁移。
- Windows 构建必须在用户已准备好的 `D:\\VibeTool\\BongoCat` 原生环境运行，不能由 WSL 生成 Windows 安装包。
- 未签名的个人安装包首次运行时可能出现 Windows SmartScreen 提示。
- 安装版已完成管理员启动与普通权限 agent hook 的跨权限实测。
