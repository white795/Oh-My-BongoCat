# Architecture

## Product Boundary

BongoCat 是以桌宠交互为核心的 Tauri 桌面应用。输入统计和 Codex 氛围灯是相互独立的附加
能力，不能改变 Live2D 桌宠的渲染与交互。

输入统计必须保持以下不变量：

- 桌宠主窗口不展示统计 UI。
- Statistics 不控制动画，动画也不依赖 Statistics。
- 只保存 keyboard、mouse、controller 的次数，不保存按键、按钮或文本内容。
- 数据完全保存在本地，不增加遥测、账号、网络服务或数据库。

Codex 氛围灯必须保持以下不变量：

- 不修改 Live2D Canvas、模型、动作、输入管线或猫窗口。
- BongoCat 不主动监听 WSL 或 Codex CLI；Codex hook 是事件发送方。
- 只接收事件名、session ID 和 turn ID，不接收 prompt、命令、输出或 assistant message。
- BongoCat 未运行或功能关闭时，bridge 静默退出且不得自动启动应用。

## Runtime Components

- Rust/Tauri 负责全局键鼠与手柄监听，并向 Webview 发送事件。
- 主窗口的 Vue composables 消费输入事件并驱动模型、Live2D 和按键贴图。
- 设置窗口使用独立的 Vue Webview，通过 Pinia/Tauri store 与主窗口同步状态。
- 两个窗口在应用启动时都加载现有 Pinia stores；窗口关闭只会隐藏窗口，应用继续运行。
- Codex 氛围灯使用独立的透明 Tauri 窗口和 Vue renderer，不加载 Live2D 页面。
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

## Codex Ambient Data Flow

```text
Codex lifecycle hook / legacy notify (WSL)
  -> one-shot shell/Python adapter
  -> Windows PowerShell dispatcher
  -> running BongoCat single-instance channel
  -> Rust ambient reducer
  -> ambient window snapshot
```

- lifecycle hook 与 legacy notify 在 adapter 层统一为
  `{ event, sessionId, turnId }`，再以严格 Base64URL 参数跨 WSL/Windows 边界传递。
- dispatcher 只定位配置路径下已经运行的 `BongoCat.exe` 或 `bongo-cat.exe`；不匹配时无操作。
- Rust reducer 生成 sequence、维护唯一 active turn、过滤迟到的 DONE，并以 compare-and-set
  保护 DONE 五秒后的 IDLE 定时器。
- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` 映射为 WORKING，`PermissionRequest` 映射为
  WAITING，legacy `agent-turn-complete` 映射为 DONE，之后自动回到 IDLE。
- 氛围灯开关由现有 Pinia/Tauri 持久化体系保存；关闭时隐藏窗口并忽略事件。
- ambient 窗口拥有独立的置顶、鼠标穿透与任务栏上沿定位策略，不能复用仅管理主猫 HWND 的
  Windows 置顶循环。
