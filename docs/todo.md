# Project Todo

## Current Focus

idle

## Active Plan

[plan-001-input-statistics.md](plans/plan-001-input-statistics.md)（已完成）

## Current Step

Plan 001 已完成：Windows 环境已完成 Rust 编译、Tauri 开发启动、真实键盘计数、重启保留与损坏 JSON 恢复验证。

## Blocked

无。

## Evidence / Attempts

- 当前开发分支为 `feat/input-statistics`，审查开始时工作区干净。
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

## Next Action

如需分发自用安装包，先单独规划并修改应用 identifier 和 updater 配置，再生成 Windows 安装包，避免覆盖或接收原版 BongoCat 的更新。

## Validation

- 已完成：仓库状态、输入链、持久化、生命周期、设置页、跨平台风险和测试入口审查。
- 已完成：核对锁定的 `@tauri-store/pinia 3.7.1` 前端包行为。
- 已通过（WSL）：`pnpm test`（11 个行为测试）、`pnpm exec tsc --noEmit`、`pnpm exec eslint src`、`pnpm build:vite`、locale JSON 解析和 `git diff --check`。
- 已通过（Windows）：`cargo test -p bongo-cat statistics`（2 个测试）、`cargo check -p bongo-cat`、`pnpm tauri dev`、真实键盘计数、托盘退出后的数据保留、损坏 `statistics.dev.json` 后正常启动。
- 未执行：macOS 与 Linux/X11 的实机输入权限、重复按键和持久化验证。

## Queued Plans

- 可选：自用发行版打包（先隔离应用 identifier 与 updater，再生成 Windows NSIS 安装包）。
