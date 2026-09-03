# Summary 004: BongoCat Codex Ambient Integration

- Plan: [plan-004-codex-ambient-integration.md](../plans/plan-004-codex-ambient-integration.md)
- Status: completed

## Delivered

- BongoCat 内置 Codex ambient 状态模块、持久化开关和独立透明窗口，无需 Python 常驻状态
  服务或浏览器页面。
- WSL 中的 Codex lifecycle hook 与 legacy notify 通过一次性 adapter/dispatcher，主动把最小
  状态事件发送到已经运行的 Windows BongoCat；BongoCat 不监听 WSL 网络端口。
- WORKING 使用动态符号、词表和低干扰冷色流光；WAITING 使用静止琥珀提示；DONE 使用绿色完成
  动画并保留五秒后回到 IDLE。
- 主猫窗口、Live2D、输入、拖动、托盘和偏好设置保持原有职责；ambient renderer 与其隔离。

## Changes

- Rust 新增严格事件解析、service-owned sequence、active turn、stale DONE 过滤和 DONE timer
  compare-and-set，并通过 Tauri snapshot 事件驱动 ambient renderer。
- Tauri 新增透明、无边框、跳过任务栏、鼠标穿透的 `ambient` 窗口及独立 Windows 置顶/定位逻辑。
- 设置页新增默认关闭的 Codex 氛围灯开关，并补齐现有 locale 文案。
- `integration/` 新增 lifecycle/notify 归一化 adapter、WSL hook wrapper 与 Windows dispatcher；
  dispatcher 只向指定路径下已运行的 BongoCat 发送 single-instance 参数。
- 全局 `~/.codex/hooks.json` 的四个 lifecycle hook 已接入 wrapper；legacy notify 仍由原
  `launcher.sh` 进入，并保留既有 Windows toast。

## Decisions

- 采用“WSL hook 主动推送到 Windows”的单向边界，不让 Windows 监听 Codex CLI，也不使用
  WSL/Windows loopback HTTP 服务。
- BongoCat Rust runtime 是唯一状态真相源；hook、dispatcher 和 renderer 均不生成 sequence。
- 事件载荷只允许 `{ event, sessionId, turnId }`，使用专用标志、Base64URL 和严格 schema 校验。
- BongoCat 不运行或开关关闭时 fail-open/no-op；hook 不能自动拉起桌宠或影响 Codex 任务。

## Verification

- Rust 事件解析/reducer：8 个行为测试通过。
- Python adapter：5 个测试及编译检查通过。
- 前端：TypeScript 类型检查、目标 ESLint 和 Vite 生产构建通过；Tauri JSON 配置可解析。
- Windows 开发态：用户确认主猫裁切回归已修复，氛围灯的手动状态与视觉正常。
- 真实 Codex：hooks 面板显示 UserPromptSubmit、PreToolUse、PermissionRequest、PostToolUse 均为
  Installed 1 / Active 1；首次提示未显示，重新提交后真实 hook 链路正常触发。

## Known Limitations

- 首次真实提示曾有一次未显示，重试后没有再次复现；当前没有足够证据判定是 hook、dispatcher
  冷启动还是运行时初始化时序，故保留为观察项而非已确认缺陷。
- WSL wrapper 当前默认定位开发版 `D:\\VibeTool\\BongoCat\\target\\debug\\bongo-cat.exe`；
  安装版必须显式配置实际 exe 路径并重新验收。
- V1 只维护一个 active turn，不精确聚合并行 session，也未实现 error/interrupted 灯效。
- 未验证多显示器、DPI、全屏应用、OBS/录屏以及 macOS/Linux 实机行为。

## Follow-ups

- 若继续个人发行版收尾，恢复
  [Plan 002](../plans/plan-002-personal-distribution.md)，把安装版 bridge 路径纳入安装后验收。
