# Plan 004: BongoCat Codex Ambient Integration

- Status: completed
- Summary: [summary-004-codex-ambient-integration.md](../summaries/summary-004-codex-ambient-integration.md)

## Goal

将已验收的 Codex 氛围灯显示能力完整整合进 BongoCat：BongoCat 自身拥有状态归约、
持久化开关和独立透明氛围窗口。WSL 中的 Codex hook 主动通过 launcher 把最小事件推送给
**已运行的** Windows BongoCat，而不是让 Windows 进程跨 WSL 网络监听 Codex CLI。
最终运行时不依赖 Python 常驻服务、浏览器页或 WSL sidecar，同时不改变猫的任何既有功能。

## Context

- 已验证的原型将四个 Codex lifecycle hook 与 legacy `agent-turn-complete` notify
  归一为 `{ event, sessionId, turnId }`，并验证了 sequence、stale DONE 和 DONE timer
  compare-and-set 规则。
- 现有 `~/.codex/launcher.sh` 已证明可行的方向：它在 WSL 收到 notify JSON 后，用
  `wslpath -w` 和 `wscript.exe` 异步启动 Windows `notify-launch.vbs`，由 Windows 端显示 toast。
- BongoCat 已启用 `tauri-plugin-single-instance`；当前二次启动回调无条件打开偏好设置，
  可扩展为识别专用 ambient event 参数，其他二次启动行为保持不变。
- 先前 Windows `TcpListener(127.0.0.1:18765)` 与 WSL `curl` 的实测表明，直接让 WSL
  网络命名空间访问 Windows loopback 不可用；该路径不再作为本计划架构。
- BongoCat 已具备 Tauri 多窗口、透明主窗口、Pinia 持久化设置、托盘和自启动能力。
- Windows 自定义置顶插件当前只有一个全局 `TOPMOST_RUNNING` 循环，持续抬高主猫窗口；
  新窗口不能复用该机制。

## Scope

- 在 BongoCat Rust 侧实现内置 ambient 状态模块，复用既有 normalized event contract 和
  状态机不变量，但不开放跨环境 HTTP 服务。
- 设计 Codex-side launcher：从 hook/notify 取得最小事件后，调用 Windows dispatcher，
  以专用命令行参数将 Base64URL 编码后的 normalized event 送入已运行 BongoCat 的
  single-instance 回调。
- BongoCat 只接受严格校验后的 `{ event, sessionId, turnId }`；不接收 prompt、命令、输出、
  assistant message 或任意可执行参数。
- 新增默认关闭且可持久化的“Codex 氛围灯”设置；启用时显示独立窗口并处理事件，禁用时
  丢弃事件并隐藏窗口；BongoCat 退出后 dispatcher 静默无操作，不能因 hook 自动拉起应用。
- 新增独立、透明、无边框、跳过任务栏、鼠标穿透的小型 bottom overlay。
- 移植已验收的 working/waiting/done/idle 视觉语言和用户词表，但不把词表解释成真实
  Codex 行为。
- 在 Windows 上验证 launcher 推送、single-instance 分发、基本窗口层级、主显示器任务栏
  定位、开关和自启动。

## Non-goals

- 不修改 Live2D Canvas、模型、动作、表情、键鼠/手柄输入、猫窗口尺寸或交互。
- 不把氛围状态混入猫窗口、主页面或现有桌宠渲染循环。
- 不保留 Python 状态服务作为 BongoCat 的生产运行时依赖，也不让 BongoCat 启动 WSL Python。
- 不绑定 `0.0.0.0`、不暴露 LAN 端口、不引入云服务、数据库、App Server 或第三方运行时依赖。
- 不实现多 Codex session/并行工具的精确聚合、`error` 或 `interrupted` 灯效。
- 本阶段以 Windows 为实机验收目标；不额外验证多显示器、DPI、全屏应用、OBS/录屏或其他
  扩展显示兼容性。

## Architecture and Invariants

```text
Codex lifecycle hook / legacy notify (WSL)
              │ normalized event
              ▼
       WSL ambient launcher
              │ starts a Windows one-shot dispatcher
              ▼
running BongoCat single-instance channel (--codex-ambient-event <base64url>)
              ▼
 BongoCat native ambient state module (Rust)
    ├─ active turn / sequence / stale-event filtering
    ├─ DONE 5 s compare-and-set timer
    └─ Tauri snapshot event
              ▼
 BongoCat ambient window (Vue, independent renderer)
```

- launcher 是发送方：它只推送最小 normalized event，短时运行、静默、fail-open。
- BongoCat 不跨 WSL 网络监听 Codex CLI；其 single-instance callback 只接收 Windows
  本地进程激活参数。
- BongoCat Rust 模块是唯一状态真相源；launcher 和 renderer 都不得生成 sequence。
- V1 只保留一个 active turn；新 `UserPromptSubmit` 替换旧 turn，迟到事件不得覆盖它。
- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` → `working`；
  `PermissionRequest` → `waiting`；`agent-turn-complete` → `done` → 5 秒后 `idle`。
- BongoCat 未运行时，Windows dispatcher 必须 exit 0 且不得启动 BongoCat；功能关闭时，
  已运行的 BongoCat 同样忽略 event。
- 新窗口必须有独立的 Windows 层级策略，绝不调用现有仅适用于主窗口的
  `set_always_on_top` 循环。

## Delivery Gate

先实现并验证最小 dispatcher 路径，而非网络端口：在 BongoCat 已运行时，从 WSL launcher
发送一个 Base64URL event，确认当前实例接收它、不会打开偏好设置、不会创建第二个 BongoCat
进程。该 gate 通过后才接入完整 reducer 和氛围窗口。

任何修改 `~/.codex` hook/launcher 的安装步骤仍需在实施前使用环境审批机制；现有 Windows
toast 必须保持为独立、异步的完成通知副作用。

## Changes Outside This Repository

本计划实施时还修改了两个不受 BongoCat Git 仓库管理的 Codex 用户配置文件：

- `/home/devuser/.codex/hooks.json`：将 `UserPromptSubmit`、`PreToolUse`、
  `PermissionRequest`、`PostToolUse` 四个 lifecycle hook 的命令切换为
  `/bin/bash /home/devuser/VibeTool/BongoCat/integration/codex-ambient-hook.sh lifecycle`。
- `/home/devuser/.codex/launcher.sh`：在 legacy notify 路径中调用
  `codex-ambient-hook.sh notify`，同时保留既有 `wscript.exe` Windows toast 调用。

修改前的备份分别为：

- `/home/devuser/.codex/hooks.json.bongocat-bridge-backup-20260902`
- `/home/devuser/.codex/launcher.sh.bongocat-bridge-backup-20260902`

`/home/devuser/.codex/config.toml` 未在本计划中修改；原有
`notify = ["/bin/bash", "/home/devuser/.codex/launcher.sh"]` 继续使用。上述仓库外修改不会包含在
本计划对应的 Git commit 中，迁移或恢复环境时必须单独处理。

## Tasks

1. [completed] 为 Rust 事件解析与 reducer 编写行为测试：字段校验、service-owned sequence、
   active turn、stale DONE、DONE timer CAS、功能禁用时丢弃事件。
2. [completed] 扩展 BongoCat single-instance 处理：识别专用 ambient 参数并分发给状态模块；
   保持正常二次启动仍打开偏好设置。
3. [completed] 实现 Windows dispatcher 与 WSL ambient launcher 的最小推送路径：只传递
   Base64URL normalized event；BongoCat 不运行时无副作用；保留 notify 的 Windows toast。
4. [completed] 通过最小 dispatcher gate 后，实现 BongoCat 内置 ambient reducer、5 秒定时器和
   向指定氛围窗口发送 snapshot 的机制。
5. [completed] 新增独立 `ambient` Tauri window 与 Vue renderer，完成透明、点击穿透、主显示器
   任务栏上沿定位和独立置顶策略。
6. [completed] 增加持久化开关、设置页文案和所有现有 locale；将其接入 BongoCat 启动、隐藏和
   退出生命周期，默认关闭。
7. [completed] 在 Windows 开发模式完成真实 Codex 状态、基本窗口行为和猫功能非回归验收；仅在
   验收完成后决定是否进行安装包构建。
8. [completed] 更新架构、todo、计划总结与使用说明，记录 launcher 协议和已知限制。

## Acceptance

- BongoCat 不运行时，hook/notify launcher 静默 exit 0，不启动 BongoCat，也不影响原 Windows toast。
- BongoCat 运行且功能启用时，WSL 的真实 Codex hooks 经 Windows dispatcher 能可靠产生
  `working → waiting → working → done → idle`，并保留迟到 DONE 和旧 timer 防护。
- 一个 ambient event 到达时，不打开偏好设置、不抢焦点、不创建第二个 BongoCat 进程。
- 功能禁用后氛围窗口隐藏、事件被忽略，猫和既有 Windows toast 不受影响。
- BongoCat 开机自启或重启后，持久化开关正确恢复窗口与事件处理状态。
- 氛围窗口位于主显示器任务栏上沿、鼠标穿透、无任务栏图标；working/waiting/done/idle
  的已验收视觉和 5 秒 DONE 保留时间正确呈现。
- 主猫窗口的 Live2D、输入、拖动、隐藏、置顶、托盘和偏好设置原有功能回归正常。
- 两个窗口同时存在时不发生互相抢占、闪烁或错误层级。

## Risks / Dependencies

- Windows dispatcher 必须可靠定位**已运行**的个人版 BongoCat，而不能误启动上游实例或
  因 event 自动启动应用；开发态和安装态的可执行路径都需明确验证。
- single-instance 的 argv 是外部输入，必须使用专用标志、Base64URL 与严格 schema 校验，
  不能把 payload 解释为 shell 命令或窗口参数。
- 每个 hook 产生一个短生命周期 Windows dispatcher，必须保持有界超时和静默失败，避免影响
  Codex 生命周期。
- 当前主窗口的 Windows 置顶实现只能管理一个 HWND；ambient 必须隔离该逻辑，避免改变现有猫的层级行为。
- Codex-side adapter/launcher 不在 BongoCat 包内；它是 WSL hook 边界的一部分，未来若需可移植
  安装体验，应另立安装/配置计划。
