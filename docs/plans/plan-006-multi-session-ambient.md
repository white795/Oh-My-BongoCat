# Plan 006: Multi-Session Ambient Indicators (Codex + Claude Code)

- Status: in-progress
- Summary: 多会话氛围灯升级，按 session_id 聚合多槽位，Done 常驻直到会话结束

## Goal

让氛围灯同时表示多个并发 agent 会话：每个活动会话一颗星标，用色相区分来源（Codex 蓝 /
Claude Code 橙），并接入 Claude Code 的 hook 体系。同时修复现有单槽位设计在多会话下必然
出现的状态互相覆盖、DONE 结算互相取消和事件丢失问题。

## Context

### 现状缺陷

- `AmbientReducer` 只有一个槽位（`active_session_id` / `active_turn_id`），任意时刻只能表示
  一个会话；第二个会话的事件被 `matches_active_turn` 拒绝或反过来抢占已有状态。
- `DoneSettlement` 的 CAS 比对全局 `snapshot.sequence`。A 会话进入 DONE 后排 5 秒定时器，
  期间 B 会话任何事件都会 bump 全局 sequence，导致 A 的结算失败、绿星永久不灭。
- named pipe 为 `nMaxInstances = 1` 且接收循环严格串行：drop 与下一次 `CreateNamedPipeW`
  之间存在无管道窗口，并发 client 的 `Connect(500)` 直接失败，事件静默丢弃。丢 WORKING 只
  影响观感，丢 DONE 会留下卡死星标。
- 色相当前编码状态（蓝 working / 琥珀 waiting / 绿 done）。琥珀与 Claude 品牌橙撞车。

### Claude Code hook 实测结论

以 `~/.claude/ambient-probe` 探针采集 76 条真实事件（Claude Code `2.1.245`）：

- hook 配置结构与 Codex 的 `hooks.json` 同构（事件 → matcher 组 → `type`/`command`/`timeout`），
  写在 `~/.claude/settings.json` 的 `hooks` 字段，stdin 收 JSON。
- `session_id` 字段同名可用；回合标识是 `prompt_id`（对应 Codex 的 `turn_id`）。
- 子 agent 的全部事件（`SubagentStart`、其内部工具事件、`SubagentStop`）复用与主会话
  **完全相同的** `session_id` 与 `prompt_id`，仅多出 `agent_id` / `agent_type`。
- `PermissionRequest` 在 `permission_mode = default` 下确实触发（实测 15 次），红色等待态
  不是死代码。`Notification`(`permission_prompt`) 在 `PermissionRequest` 后约 6 秒补发，属
  催促而非首发。
- `Stop` 仅在回合正常完成时可靠（8 次 `UserPromptSubmit` 对应 2 次 `Stop`）。
- Esc 打断（工具阶段与文本生成阶段）、人工拒绝权限：**均不产生任何事件**。
  `PermissionDenied` 至今零触发，它只覆盖 auto 模式的自动拒绝。
- `SessionEnd` 在 Ctrl-C 退出（`reason = prompt_input_exit`）和关闭窗口（`reason = other`）
  时均可靠触发。
- 基线 `Stop` 距上一个 `PostToolUse` 达 2 分 46 秒（期间为纯文本生成，零事件）。

### 缺失终止信号为何不构成卡点

打断或拒绝的动机是对任务有异议，用户随即发出下一条指令，产生 `UserPromptSubmit`；按
`session_id` 做主键时该事件直接覆盖卡住的星标（实测自愈窗口 22.5 秒）。若用户决定彻底放弃，
则会退出会话，`SessionEnd` 可靠触发。因此缺失信号不落在关键路径上，TTL 清扫仅作最终兜底。

## Scope

- 协议增加 `source` 字段（`codex` | `claude`），保持 Base64URL + 有界 payload 不变。
- adapter 支持 Claude Code 事件映射，并按 `agent_id` 过滤子 agent 事件。
- reducer 改为按 `session_id` 聚合的多槽位结构，sequence、回合守卫、DONE 结算全部下沉到
  每会话；新增 TTL 清扫。
- named pipe 支持并发连接。
- snapshot 由扁平结构改为会话数组；前端渲染多颗星标。
- 视觉：色相只编码身份，状态改用字形 + 动画 + 光晕。
- 接入 `~/.claude/settings.json` hook 并纳入仓库外文件清单。
- 版本统一为 `1.4.0`。

## Non-goals

- 不为子 agent 单独渲染星标（用户明确不需要观测子 agent）。
- 不做 `PostToolUse` 空转抑制与事件去抖。该性能优化留到功能验收完成之后单独处理。
- 不改变 `AMBIENT_PIPE_NAME`。它不面向用户，改名需与已部署的 `~/.codex/ambient` 副本做
  flag day 切换，无收益。
- 不开放 TCP/HTTP 端口，不允许远程 pipe 客户端。
- 不传输 prompt、工具参数、命令内容或工具输出。
- 不改变 Live2D、输入统计、猫窗口与统计热力图。
- 不引入常驻服务或第二个 BongoCat 实例。

## Design Decisions

### 主键与守卫

- 主键为 `session_id`。选 `turn_id` 会让每个中途放弃的回合永久留星并持续堆积；选
  `session_id` 时同会话下一回合直接覆盖，自愈，星标数恰为活动终端数。
- `turn_id` 降级为每槽位的守卫字段，用于丢弃迟到的过期回合事件（沿用现有
  `matches_active_turn` 逻辑，从全局降到每槽位各自一份）。
- 携带 `agent_id` 的事件在 adapter 层即被丢弃，不参与回合建立，也不产生状态迁移。
  `SubagentStop` 尤其不得映射为 DONE，否则子 agent 结束会让主星提前熄灭。

### 事件映射

| Claude Code 事件                     | 动作                |
| ------------------------------------ | ------------------- |
| `UserPromptSubmit`                   | WORKING，并建立回合 |
| `PreToolUse`                         | WORKING             |
| `PermissionRequest`                  | WAITING             |
| `PostToolUse` / `PostToolUseFailure` | WORKING             |
| `Stop` / `StopFailure`               | DONE                |
| `SessionEnd`                         | 立即移除槽位        |
| 含 `agent_id` 的任何事件             | 丢弃                |

`PostToolUse` 承担 WAITING → WORKING 的恢复边（用户批准后由它让星标回到工作态），因此不可
移除。`StopFailure` 必须映射 DONE，否则一次限流会留下卡死星标。

Codex 侧映射为 `UserPromptSubmit` / `PreToolUse` / `PostToolUse` → WORKING，
`PermissionRequest` → WAITING，`Stop` → DONE，`SessionEnd` → 立即移除槽位。legacy notify 只保留
Windows toast，不再进入 ambient bridge，避免 `/recap` 重建已经移除的槽位。
Codex `SessionEnd` 没有 `turn_id`，adapter 使用固定内部占位值 `__session_end__` 满足统一协议；
reducer 只按 `session_id` 删除槽位，不使用该占位值参与回合守卫。

### 生命周期

- 仅渲染非 idle 会话；列表为空则隐藏窗口。`N = 1` 时行为与现状完全等价，改动风险最小。
- **Done 常驻**：adapter 将 `Stop` 归一化为 `agent-turn-complete` 并把槽位置为 Done（`✓`），
  该状态持续显示直到：
  - 同会话下一条 `UserPromptSubmit` 覆盖为 Working；
  - `SessionEnd` 即时移除槽位；
  - TTL 15 分钟无活动驱逐。
- 不再有 DONE → Idle 的 5 秒定时结算；`DoneSettlement` 机制完全移除。
- 星标消失仅意味着会话结束（`SessionEnd` 或 TTL），而非单次回合完成。用户通过 `✓` 字形
  即可确认回合已完成，无需依赖星标消失。
- 单个常驻清扫线程（60s 周期）仅负责 TTL 驱逐，不再处理 DONE 结算。
- TTL 是所有来源的必要兜底，不仅覆盖 Codex 暂未接入 `SessionEnd` 的情况，更覆盖终端崩溃、
  进程被杀、OOM、WSL 通信中断等任何无法触发 hook 的异常退出场景。即使 `SessionEnd` 已
  接入，TTL 仍是最终安全网。
- TTL 取 15 分钟。实测纯文本生成可静默 2 分 46 秒，任何短于 5 分钟的 TTL 都会把正常长回复
  误判为死亡。

### 视觉

色相只编码身份，状态改用非色相通道，避免「一颗橙星是 Claude 会话还是等待中的 Codex 会话」
这类二义。

- Codex 身份：沿用现有蓝色 token。
- Claude 身份：橙色。初值建议 core `rgba(255, 226, 205, 0.94)`、glow
  `rgba(240, 168, 128, 0.9)` → `rgba(217, 119, 87, 0.42)`、shadow `rgba(230, 140, 100, 0.7)`，
  dev 验收时可调。
- WORKING：保持身份色相 + 现有字形轮换 + 脉动光晕。
- WAITING：保持身份色相，字形换为 `?`，叠加红色光晕。红色作为叠加层而非替换色相，使一颗
  等待星仍能指明该切到哪个窗口去确认。
- DONE：沿用绿色涟漪。涟漪动画必须保留——红色等待配绿色完成是典型红绿色觉冲突对，二者
  在同一颗星上时序分离且 DONE 有独特动画，才可接受。
- 文字颜色：仅 Codex → 蓝；仅 Claude → 橙；两者并存 → 淡紫 `rgba(214, 196, 255, 0.9)`。
  紫色只用于文字，不得用于星标，否则会与「蓝＝身份」「红＝等待」在色相空间挤成一团。
- 排序按首次出现时间固定，不随事件重排。上限 5 颗 + 溢出标记，防止撑爆 760px 窗口。
- 文字槽位：`N = 1` 保留现有动词轮换；`N > 1` 跟随最近更新的会话。

## Security Invariants

- pipe 仍仅允许本机当前 Windows 用户连接，显式拒绝远程客户端；放开 `nMaxInstances` 不得
  放宽 DACL。
- 每次连接最多接收一个有界 payload；超长、空值、非 Base64URL、未知字段和未知事件均拒绝。
- `source` 为可选字段并默认 `codex`：`SerializedAmbientEvent` 带 `deny_unknown_fields`，
  新旧两侧不同步时会互相拒收，必须保证旧 payload 仍可解析。
- bridge 只转发 `event`、`sessionId`、`turnId`、`source`；不转发 prompt、工具参数或输出。
- hook 必须无条件 `exit 0` 且不写 stdout：Claude Code 中 `UserPromptSubmit` 上 exit 2 会
  清空用户 prompt，`Stop` 上 exit 2 会阻止回合结束；`UserPromptSubmit` 与 `SessionStart`
  的 stdout 会被注入模型上下文。
- 所有 Claude hook 显式设置 `timeout`。Claude Code 的 command hook 默认超时为 600 秒。
- 事件 sequence 继续只由 BongoCat reducer 生成。

## Tasks

1. [x] Claude Code bridge：独立 adapter + hook shell + dispatch 脚本 + 12 个 Python 测试。
2. [x] Rust `AmbientSource` 枚举 + `source` 字段解析 + 15 个 Rust 测试。
3. [x] 前端身份色相 token（Codex 蓝 / Claude 橙），`?` 字形 + 红色等待光晕。
4. [x] reducer 改为按 `session_id` 聚合的多槽位结构；`SessionEnd` 事件即时移除槽位。
       23 个 Rust 测试 + 12 个 Python 测试全部通过。
5. [x] reducer 简化：移除 `DoneSettlement` 机制（Done 常驻，不再 5 秒后消失）；
       移除 `DONE_IDLE_DELAY_SECONDS`、`settle_done_if_current`、`schedule_done_settlement`；
       槽位不再有 Idle 状态（要么活着要么被移除）。同步更新测试。
6. [x] runtime：移除每次 DONE 起线程的做法；新增单个常驻清扫线程（60s 周期），
       仅负责 15 分钟 TTL 驱逐。reducer 维护每槽位最后活动时间戳；runtime 将状态变更与
       snapshot/窗口发布串行化，避免并发事件反序应用显隐操作。
7. [x] pipe：放开 `nMaxInstances` 并改为每连接一个处理线程，消除无管道窗口；保留安全描述符
       与远程拒绝。
8. [x] snapshot 改为会话数组（version 2），同步 Tauri command 与前端类型。
9. [x] 前端：将模块级单例动画状态机重构为带 props 的子组件，外层改 flex 容器，
       实现排序、上限、溢出标记与文字槽位策略。Done 状态 `✓` 常驻显示。
10. [x] 安装 `~/.claude` bridge 与 hook 配置，移除诊断探针，更新仓库外文件清单。
11. [x] 文档：`AGENTS.md` 仓库外文件、`integration/README.md`、`docs/todo.md`、
        locale 文案（`codexAmbient` → 中性命名，5 个语言文件）。
12. [x] 版本号统一为 `1.4.0`（`package.json` + `src-tauri/Cargo.toml`）。
13. [x] Python 测试、`cargo test`、`cargo fmt`、格式与 `git diff --check` 全部通过后增量同步
        到 `D:\VibeTool\BongoCat`。
14. [ ] 用户在 Windows dev 完成多会话实机验收，再按 AGENTS.md 流程生成安装包。
15. [x] Codex 升级到支持 `SessionEnd` 的版本后，将第五个 lifecycle hook 接入 adapter；
        `SessionEnd` 无 `turn_id`，使用固定内部占位值并归一化为 `session-end`。

## Acceptance

- 两个 Codex 会话 + 一个 Claude Code 会话并发时显示三颗星标，蓝二橙一，各自独立走
  `working → waiting → working → done`，互不干扰。
- Done 状态（`✓`）常驻直到同会话新回合开始、`SessionEnd` 移除或 TTL 驱逐。
  星标消失仅意味着会话结束，不再因回合完成而消失。
- 多会话高频事件下不丢 DONE：连续压测后无残留卡死星标。
- 单会话场景：一颗星、动词轮换，回合完成后 `✓` 常驻。
- Claude Code 子 agent 运行期间不新增星标，`SubagentStop` 不使主星提前熄灭。
- Esc 打断或拒绝权限后，同会话下一条指令能覆盖并复用该槽位。
- Claude Code 会话 Ctrl-C 退出或关闭窗口后，对应星标随 `SessionEnd` 立即消失。
- 旧版 Codex payload（无 `source` 字段）仍能被解析并按 Codex 身份渲染。
- hook 失败、BongoCat 未运行、氛围灯关闭或 payload 非法时静默退出，不影响 Codex 与
  Claude Code 会话，不清空 prompt，不阻止回合结束。
- 非当前用户或远程客户端不能写入 pipe；超长 payload 不进入 reducer。
- 主猫、输入捕获、统计持久化与热力图无回归。

## Risks / Dependencies

- 前端真正的工作量在于把动画状态机从模块级单例重构为实例化子组件，而非配色；现有
  `.agent-indicator` 为 `position: fixed; left: 50%`，多实例会直接重叠。
- 每个事件都要启动一次 `powershell.exe` 走 WSL interop。3–4 个会话并发时会达到每秒数个进程，
  开销可感知。本计划不做优化，但需在验收时记录实际表现，为后续去抖提供依据。
- Claude Code 的 `prompt_id` 需 v2.1.196+；当前为 `2.1.245`，满足。
- 当前 Codex 已支持并接入 `SessionEnd` hook。TTL 不因 `SessionEnd` 接入而取消——终端崩溃、
  进程被杀等异常退出不会触发任何 hook，TTL 是所有来源的终极安全网。
- 待补充实验：`Notification`(`idle_prompt`) 是否在 Esc 打断后触发（文档称空闲 60 秒后发）。
  若有效，可为 Claude 侧补一条 60 秒滞后的通用终止信号。该实验不阻塞本计划。
- 备选心跳源：Claude Code statusLine 命令每次刷新都会收到含 `session_id` 与 `prompt_id` 的
  JSON，可作为会话存活证据以收紧 TTL。会增加耦合，暂不纳入。
- WSL 无法完成实机验证，最终 gate 必须在 Windows dev 模式由用户执行。
