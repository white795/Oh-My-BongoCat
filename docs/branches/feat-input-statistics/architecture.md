# Architecture — feat/input-statistics

> 本文冻结 `feat/input-statistics` 分支在提交 `bca8bb0` 时的架构边界。MikuCat 支线不得直接
> 改写本文；新架构见 [`feat/mikucat-state-machine`](../feat-mikucat-state-machine/architecture.md)。

## Product Boundary

BongoCat 是以桌宠交互为核心的 Tauri 桌面应用。输入统计和 Agent 氛围灯是相互独立的附加
能力，不能改变 Live2D 桌宠的渲染与交互。

输入统计必须保持以下不变量：

- 桌宠主窗口不展示统计 UI。
- Statistics 不控制动画，动画也不依赖 Statistics。
- 只保存 keyboard、mouse、controller 的次数，不保存按键、按钮或文本内容。
- 数据完全保存在本地，不增加遥测、账号、网络服务或数据库。

Agent 氛围灯必须保持以下不变量：

- 不修改 Live2D Canvas、模型、动作、输入管线或猫窗口。
- BongoCat 不轮询或解析 WSL 中的 agent CLI；Codex 与 Claude Code hook 是事件发送方，
  BongoCat 只接受本机 named pipe 上被主动推送的最小事件。
- 只接收事件名、session ID、turn ID 和 agent 来源，不接收 prompt、命令、输出或
  assistant message。
- BongoCat 未运行或功能关闭时，bridge 静默退出且不得自动启动应用。

## Runtime Components

- Rust/Tauri 负责全局键鼠与手柄监听，并向 Webview 发送事件。
- 主窗口的 Vue composables 消费输入事件并驱动模型、Live2D 和按键贴图。
- 设置窗口使用独立的 Vue Webview，通过 Pinia/Tauri store 与主窗口同步状态。
- 两个窗口在应用启动时都加载现有 Pinia stores；窗口关闭只会隐藏窗口，应用继续运行。
- Agent 氛围灯使用独立的透明 Tauri 窗口和 Vue renderer，不加载 Live2D 页面。
- Rust ambient runtime 持有唯一状态，并向氛围窗口发布 snapshot；renderer 只负责动画。

## Input Data Flow

```text
Keyboard / Mouse -> rdev -> device-changed -> useDevice -> model / Live2D
Controller       -> gilrs -> gamepad-changed -> useGamepad -> model / Live2D
```

统计只能作为事件消费者旁路接入，不改变上述现有行为。统计写入者限定为主窗口；设置窗口只读取同步后的统计数据，避免重复计数。

## Persistence

项目使用 `@tauri-store/pinia` / `tauri-plugin-pinia` 将各 Pinia store 以 JSON 保存到应用数据目录，并在窗口间同步。统计应复用该机制，使用独立的 `statistics` store，不引入另一套存储系统。

在 Pinia 加载前，statistics 专用的轻量 Tauri 插件会检查该 JSON。若文件语法损坏，会将它改名为同目录的 `.corrupt` 备份，让 Pinia 以空统计启动；其他 store 不受影响。

统计的唯一持久化事实源是按本地日期保存的分类计数。Today、Yesterday、This Week、This Month 和 Total 都从 daily history 派生，不持久化重复聚合值。

## Statistics Decisions

- 日期键为事件发生时的用户本地日期 `YYYY-MM-DD`，不依赖午夜定时器。
- 一周按 ISO 日历习惯定义为周一至周日；“This Week”只聚合到当前本地日期。
- Keyboard 以按下边沿计数，尽力过滤 OS key repeat。
- Mouse 只统计按钮按下；移动、释放和当前未转发的滚轮事件不计数。
- Controller 字段作为未来兼容预留；当前版本不修改手柄管线，因此该分类保持为 0。
- 设置页的历史展示使用最近 53 个周一对齐日历周的热力图；每日总量相对可见区间最大值按对数刻度映射为四档蓝色，不改变统计数据或计数口径。

## Agent Ambient Data Flow

```text
Codex lifecycle hook ─────────────────┐
Claude Code lifecycle hook ───────────┴─> one-shot shell/Python adapter
  -> one-shot Windows PowerShell named pipe client
  -> elevated or standard running BongoCat pipe server
  -> Rust multi-session ambient reducer
     ├── snapshot v2 -> ambient window renderer（持续状态）
     └── transition alert -> ambient-alert renderer（瞬时边缘提示）
```

- Codex 与 Claude Code 使用彼此独立的 adapter，在协议边界统一为
  `{ event, sessionId, turnId, source }`，再以严格 Base64URL 参数跨 WSL/Windows 边界传递；
  缺少 `source` 的旧 payload 默认视为 Codex。
- pipe name 由固定应用前缀与当前 Windows 用户 SID 组成；DACL 只允许该用户和 SYSTEM 访问，
  mandatory label 允许同一用户的 medium-integrity client 写入 elevated server，并拒绝远程客户端。
- client 不检查进程、不依赖 exe 安装路径，也不启动 BongoCat；pipe 不存在时短超时静默退出。
- named pipe 最多允许 16 个并发实例，每个连接只接收一个不超过 4096-byte 的 Base64URL
  payload，之后由严格 schema 解码。
- Rust reducer 是唯一状态真相源：sequence 只在进程内生成，槽位按 `sessionId` 聚合，
  `turnId` 只用于每槽位的迟到事件守卫；状态更新、snapshot 发布和窗口显隐按同一顺序串行化。
- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` 映射为 WORKING，`PermissionRequest` 映射为
  WAITING；Codex `Stop` 和 Claude `Stop` / `StopFailure` 在各自 adapter 中归一化为
  `agent-turn-complete`（常驻 DONE），`SessionEnd` 归一化为 `session-end` 并立即删除对应槽位。
- Codex legacy notify 只保留 Windows toast，不进入 ambient bridge。`/recap` 等非回合生命周期
  通知因此不能创建或改变会话槽位。
- 每个槽位在同会话下一回合开始时复用；无法产生 `SessionEnd` 的异常退出由 15 分钟 TTL
  最终驱逐。snapshot v2 暴露会话数组，前端最多渲染五颗星并显示溢出计数。
- reducer 只在单个 session 首次进入 WAITING 或 DONE 时产生不可持久化的 transition alert；
  重复状态、WORKING、SessionEnd、TTL、迟到事件和 snapshot 重连不会重放强提示。
- `ambient-alert` 是预创建但默认隐藏的独立透明 renderer，覆盖主显示器 work area：WAITING
  播放两次琥珀红连续呼吸，DONE 播放绿色单次扫边。优先级为 Waiting > Done，generation 守卫和
  Rust 超时兜底防止旧回调隐藏新动画或留下透明全屏窗口。
- 氛围灯开关由现有 Pinia/Tauri 持久化体系保存；关闭时隐藏 `ambient` 与 `ambient-alert` 两个
  窗口并忽略事件。
- ambient 窗口拥有独立的置顶、鼠标穿透与任务栏上沿定位策略，不能复用仅管理主猫 HWND 的
  Windows 置顶循环。
