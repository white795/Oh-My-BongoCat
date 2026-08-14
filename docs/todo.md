# Project Todo

## Current Focus

personal Windows distribution

## Active Plan

[plan-002-personal-distribution.md](plans/plan-002-personal-distribution.md)

## Current Step

Plan 002 进行中：个人版本配置已同步到 `D:\\VibeTool\\BongoCat`，下一步是在 Windows 原生环境构建 NSIS 安装包。

## Blocked

无。

## Evidence / Attempts

- 输入统计功能已提交并由用户推送；当前工作围绕个人 Windows 安装包，不更改统计行为。
- 项目使用 Vue 3、Pinia、Tauri 2，并已包含 `@tauri-store/pinia`、`serde_json` 和 Tauri 文件系统插件。
- 键鼠从 Rust `rdev` 经 `device-changed` 进入 `useDevice`；手柄从 `gilrs` 经 `gamepad-changed` 进入 `useGamepad`。
- 当前版本的最小接入点是 `useDevice` 的键鼠 listener 入口，不应放进 `useModel`；手柄 listener 保持不变。
- Statistics 采用 daily-only 本地 JSON；日、周、月和 Total 动态聚合。
- Pinia store 支持节流保存和 graceful-exit 保存；statistics 专用 Tauri 启动插件会在 Pinia 加载前备份语法损坏的 JSON。
- 用户确认当前版本以键盘为核心，不修改手柄管线；controller 仅保留数据字段。
- 已实现键盘按下边沿、鼠标按钮按下、按本地日期分桶、周期聚合、1 秒内存批次和 10 秒节流保存。
- 设置页已增加 Usage 风格统计面板；桌宠主界面和 `useGamepad` 未修改。
- statistics 使用独立 Pinia/Tauri JSON store；损坏 JSON 会保留为 `.corrupt` 备份，并以空统计恢复。
- Windows 已通过 `cargo test -p bongo-cat statistics`、`cargo check -p bongo-cat`、`pnpm tauri dev` 及键盘/重启/损坏数据手工验证。
- 已将所有平台的 Tauri identifier 设为 `com.white795.bongocat.stats`，保留显示名称 `BongoCat`。
- 已移除 updater 的服务端点、Rust 注册、capability、自动检查状态与设置/托盘/关于页入口；打包不会生成 updater 产物。
- 已同步 13 个运行时文件到 `D:\\VibeTool\\BongoCat`，并用 SHA-256 抽样确认 Windows 工作区与当前源文件一致。

## Next Action

在 Windows PowerShell 的 `D:\\VibeTool\\BongoCat` 中执行 `pnpm.cmd tauri build --bundles nsis`，然后定位并安装生成的 `.exe`。

## Validation

- 已完成：仓库状态、输入链、持久化、生命周期、设置页、跨平台风险和测试入口审查。
- 已完成：核对锁定的 `@tauri-store/pinia 3.7.1` 前端包行为。
- 已通过（WSL）：`pnpm test`（11 个行为测试）、`pnpm exec tsc --noEmit`、`pnpm exec eslint src`、`pnpm build:vite`、locale JSON 解析和 `git diff --check`。
- 已通过（Windows）：`cargo test -p bongo-cat statistics`（2 个测试）、`cargo check -p bongo-cat`、`pnpm tauri dev`、真实键盘计数、托盘退出后的数据保留、损坏 `statistics.dev.json` 后正常启动。
- 未执行：macOS 与 Linux/X11 的实机输入权限、重复按键和持久化验证。
- 待执行（Plan 002）：个人版本的 Windows NSIS 打包及安装后身份隔离验证。
- 已通过（Plan 002）：所有 Tauri JSON 配置解析、identifier/updater 静态复核和 `git diff --check`。
- 未执行（因 WSL 缺少 pnpm/Rust）：前端测试、类型检查、lint 与 Rust 构建；Windows NSIS 构建会覆盖关键前端/Rust 编译验证。

## Queued Plans

- 暂无；完成 Plan 002 后更新为 `idle`。
