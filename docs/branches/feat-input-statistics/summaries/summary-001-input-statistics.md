# Summary 001: Input Statistics

- Plan: [plan-001-input-statistics.md](../plans/plan-001-input-statistics.md)
- Status: completed

## Delivered

- 设置页新增 Usage 风格的本地输入统计：Today、Yesterday、This Week、This Month、Total，以及最近 14 天历史。
- 键盘按下边沿与鼠标按钮按下分别计数；controller 字段保留为未来兼容字段，本版不接入手柄。
- 统计只保存按本地日期分桶的次数；不保存按键、鼠标按钮或输入内容。
- 内存先按 1 秒批次合并，再由 Pinia/Tauri 每 10 秒节流保存；托盘退出、重启和更新重启会尽力强制刷新。
- 损坏的 statistics JSON 会在 Pinia 读取前移为同目录 `.corrupt` 备份，应用以空统计继续启动。

## Decisions

- 统计是 `useDevice` 的旁路消费者，不影响模型或动画逻辑；桌宠主界面与 `useGamepad` 均不改动。
- 唯一持久化事实源是 `daily` history，所有周期总量均在读取时聚合。
- 锁定的 `tauri-store 0.12.1` 没有所需 custom marshaler API，因此使用 Pinia 前置的恢复插件，而不增加依赖或更换持久化方案。
- Vite 开发监听忽略根目录 `target`，避免 Windows 上 Cargo 锁定 DLL 时导致开发服务器崩溃。

## Verification

- WSL：`pnpm test` 通过 11 个 TypeScript 行为测试；`pnpm exec tsc --noEmit`、`pnpm exec eslint src`、`pnpm build:vite` 与 `git diff --check` 均通过。
- Windows：`cargo test -p bongo-cat statistics` 通过 2 个 Rust 恢复测试；`cargo check -p bongo-cat` 通过。
- Windows 手工：设置页可见统计；键盘计数正确；托盘退出并重启后数据保留；故意写入损坏的 `statistics.dev.json` 后应用仍可启动，原文件保留为 `.corrupt`。

## Known Limitations

- 当前未统计手柄输入，`controller` 保持为 0。
- macOS 与 Linux/X11 尚未做实机验证。
- 强制终止进程或断电时，最后约一个批次加一个节流周期的输入可能丢失。
- 尚未生成自用安装包；打包前应先隔离应用 identifier 和 updater 配置，避免与原版冲突。
