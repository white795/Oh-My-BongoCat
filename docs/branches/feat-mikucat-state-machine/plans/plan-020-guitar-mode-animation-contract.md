# Plan 020: Character / Guitar / Angry State Machines

- Status: active
- Summary: pending
- Branch: `feat/mikucat-state-machine`
- Depends on: [Plan 018](plan-018-mikucat-guitar-performance.md), [Plan 019](plan-019-mikucat-guitar-notes.md)

## Goal

建立分层状态机与表现层之间的稳定契约。父级角色状态机把现有 Agent 多 Session 快照归约为唯一
角色模式；`GUITAR` 子状态机把键盘输入和时间解释为演奏意图，`ANGRY` 子状态机把连续等待时长
解释为生气强度。状态机分支只产生表现层无关的持续快照、瞬时提示与 deadline，不实现任何动画
或特效；动画机和特效机统一由动画机支线实现，且都不能反向定义语义状态。

## Architecture Boundary

完整链路由 Agent 与设备活动两个上层输入源、一个分层状态机和一个表现层组成。单调时钟是
状态归约依赖，不作为第三个业务输入源：

1. **角色状态机**读取现有 `AmbientSnapshot.sessions` 和 Agent 接管开关，按固定优先级归约为
   `RELAXED | GUITAR | ANGRY`；它不直接读取原始 hook，也不写模型或特效。
2. **子状态机**按当前角色模式归约输入与时间。`GUITAR` 下接收去重后的设备 press 边缘和时间流逝；
   `ANGRY` 下只接收连续生命周期与时间流逝。两者都输出持续状态、一次性提示与下一个 deadline，
   不保存键值、不写 Live2D 参数、不创建视觉节点，也不维护角色姿态或特效实例。
3. **表现层**（动画机与特效机）全部由动画机支线实现。状态机分支只定义并验证它们消费的
   持续快照与瞬时提示契约，不再实现任一消费者。

状态机与表现层之间只有一条边界：状态机发送"持续状态 + 瞬时提示"，表现层不回写、不反向定义
语义。动画机与特效机在表现层支线中仍是两个同级消费者；它们如何分别落实同一份输出属于该支线
设计，但任何一方都不得成为另一方或状态机的语义真相源。

```text
Agent hooks -> AmbientSnapshot.sessions -> Character State Machine
                                           RELAXED | GUITAR | ANGRY
                                                       │ mode + generation
Normalized keyboard / mouse press ─────────────────────┤
Monotonic time ─────────────────────────────────────────┤
                                                       ▼
                                          active mode child state machine
                                               snapshot + transient cues
                                                           │
                                                           ▼
                                        presentation layer（动画机支线）
                                     animation + effects, Live2D + DOM
```

状态机一次归约产出的快照与提示必须自足：表现层不需要回读状态机内部结构、不需要自行判断
静默时长或输入密度，也不需要访问原始输入。状态机可以暴露调试快照，但表现层的内部播放状态
不是状态机的输入，两者之间不存在回边。

## Character State and Ownership Contract

角色控制权与角色模式是两个不同维度：

```text
owner = MANUAL | AGENT
mode  = RELAXED | GUITAR | ANGRY  // 仅 owner=AGENT 时有效
```

- Agent 接管关闭时，`owner=MANUAL`，现有手动 Expression / Motion 行为保持不变；Ambient 快照仍可
  被缓存，不能因为模型未接管就丢失真实 Session 状态。
- Agent 接管开启时，角色状态机遍历完整的 `sessions`：存在任一 `waiting` 即为 `ANGRY`；否则
  存在任一 `working` 即为 `GUITAR`；其余 `done`、`idle` 或空列表均为 `RELAXED`。
- 不得使用顶层 `AmbientSnapshot.state` 做角色归约；该字段表示最近更新的 Session，不是多 Session
  优先级汇总。
- `WAITING > WORKING > RELAXED` 是跨 Codex / Claude Session 的全局优先级，不因数组顺序改变。
- 只有 owner 或归约后的 mode 真正变化时才递增 `generation`。同一模式下的 PreToolUse、PostToolUse
  或其他重复快照不得重启表情、动画或特效。
- `done` 不形成第四个稳定模式。当至少一个同一 `sessionId` 的会话从 `working` / `waiting` 变为
  `done`，且当前 Session 列表非空并全部为 `done` 时，父级额外发出一次 `ALL_SESSIONS_DONE`
  cue；动画机后续可把它表现为“默认 -> 豆豆 -> 默认”的一次性完成动画。
- 完成 cue 必须携带 ambient sequence 与当前 presentation generation。重复 done 快照、初始或重连
  得到的全 done 快照、延迟开启 Agent 接管、`SessionEnd` / TTL 移除都不得补发或重放历史完成动画。
- 每个子状态提示携带父级 `generation`；切出 `GUITAR` 后到达的旧提示必须被拒绝。
- 开启接管时使用已缓存的当前快照立即派生模式；关闭时使旧 generation 失效，退出吉他子状态、
  清理特效、恢复鼠标控制并把角色交还默认手动态。

Agent 接管是独立于现有“Agent 氛围灯”的持久化开关。接收服务在任一消费者开启时都必须继续
归约 Session；氛围灯关闭不能导致模型控制丢失状态，模型控制关闭也不能关闭氛围灯。偏好页可以
禁用手动按钮作为提示，但真正的 Expression / Motion 拦截必须位于主窗口中央入口，防止快捷键或
程序事件绕过。首版只允许明确声明能力的内置 MikuCat 被 Agent 接管，其他内置和自定义模型保持
手动行为。

## Engine Ownership Boundary

动画机与特效机的实现都在动画机支线；本计划只固定状态机一侧的输出契约。两者之间的分工由
该支线自行决定，但必须共同满足：

- 状态机侧不设置 `Live2D Expression / Motion / Parameter` 的写入者，也不创建任何视觉实例；
- 状态机侧不解释颜色、轨迹、节流、容量或 TTL，这些全部属于表现层；
- 同一份快照与提示在表现层内部如何分配，不影响状态机的归约结果与寿命。

未来“生气”等状态可由表现层自行决定用表情、耳朵、身体动作或模型外气场表达，本计划不提前
定义生气特效 profile、插件注册系统或通用特效 DSL。

## Guitar Interaction State Contract

生命周期、输入活跃度和释放趋势必须分开，避免把“吉他模式是否启用”“最近输入有多强”和
“输入是否正在停止”混为一谈：

- lifecycle：`INACTIVE | ACTIVE`；是否进场或退场是动画机内部 phase，不由状态机猜测播放进度；
- interaction：`AUTONOMOUS | ENGAGED | GROOVE | DRIVE`；
- releasing：`false | true`；保留释放前的 interaction 与 activity，供消费者平滑回落。

其中：

- `AUTONOMOUS`：没有近期输入，动画机仍播放自己的自然演奏乐句；
- `ENGAGED`：出现零散输入，给予轻量响应；
- `GROOVE`：形成持续输入节奏，允许提高演奏活力；
- `DRIVE`：短时间高密度输入，允许安排更强重音或更密集表现；
- `releasing=true`：输入停止后的平滑释放阶段，随后回到 `AUTONOMOUS`，不得直接停机或复位。

首版以 3 秒窗口衡量持续活动，以 600 ms 窗口衡量 burst。第 1 次 press 进入 `ENGAGED`，6 次进入
`GROOVE`，12 次或 600 ms 内 5 次进入 `DRIVE`，20 次映射为 `activity=1`；降级使用 5 / 9 次和
3 次 burst 的较低阈值形成迟滞。最后输入后保持 400 ms，再置 `releasing=true`；达到 1 秒时发出
一次 `INPUT_REST` 并回到 `AUTONOMOUS`。输入在释放期间恢复会立即取消 releasing。阈值集中在
`GUITAR_INTERACTION`，可以在视觉验收后调参，但上述状态语义和正交边界不变。

状态机输出分成两类：

- **持续快照（latest wins）**：父级 generation、生命周期、interaction、归一化 activity、burst、
  releasing、最后输入时间和递增 revision；新快照可以覆盖尚未消费的旧快照。
- **瞬时提示（edge event）**：例如 `PRESS`、`ACCENT`、`INPUT_REST`；必须通过 sequence、队列或
  合并规则避免重复消费，也不能被误当成持续状态。

`INPUT_REST` 表示输入停止后的一次语义标点，可供休止符和动画机使用，但不表示动画停止。它与
当前动画数据中的内部 `rest` / 放松片段是不同概念，后续实现必须使用不会混淆的命名。

状态机采用可注入的单调时钟。运行时只能根据状态机给出的下一个 deadline 安排唤醒；是否进入
释放、是否到达休止点以及是否只发送一次 `INPUT_REST` 都由纯状态归约决定，不能继续散落在 Vue
页面计时器中。父级 generation 同时保护 press 与 deadline，退出后到达的旧工作不能复活状态。

## Angry Waiting State Contract

生气等待状态机不读取键盘或鼠标，只解释一段连续 `ANGRY` 生命周期与单调时间：

- lifecycle：`INACTIVE | ACTIVE`；进入和退出由父级模式与 generation 决定；
- intensity：`ANNOYED | IMPATIENT | FURIOUS`；首版分别对应刚进入、连续 8 秒与连续 25 秒等待；
- 持续快照携带 lifecycle、父级 generation、revision 与活跃时的 intensity；
- 每次真实升级只发送一个 `ANGER_ESCALATED` cue，携带最终 intensity、独立 sequence 与父级
  generation；进入和退出通过持续快照表达，不另造提示；
- `nextDeadlineAt` 只指向下一个尚未跨越的升级阈值；到达 `FURIOUS` 后不再周期提醒；
- 同一 generation 的重复激活不重置起点，离开后清空 deadline，新 generation 重新从 `ANNOYED`
  开始；旧 generation 的唤醒不得改变当前状态；
- 唤醒严重延迟并一次跨过多个阈值时直接收敛到当前强度，只发送一个最终升级 cue，不补播中间表现。

父级只要始终归约为 `ANGRY`，具体 waiting Session 的替换不重置全局等待时长；出现一个不含 waiting
的父级快照后再次进入才算新周期。现有 Session snapshot 没有 `waitingSince`，因此重启或延迟开启
Agent 接管时从前端本地观察到 `ANGRY` 的时刻计时，不为历史等待补算时长。状态机只表达强度，
具体表情、耳朵、身体动作、烟雾或气场仍由表现层决定。

## Canonical Output Contract

表现层只消费 `src/utils/characterStateCoordinator.ts` 导出的 `CharacterStateUpdate`，不得分别订阅
父级归约器或两个子状态机。该类型是跨 worktree 接线的唯一标准入口：

- `snapshot.presentation` 表示当前控制权、父级模式与 generation；
- `snapshot.child` 只可能是当前唯一活跃的 `guitar` / `angry` 子快照，`RELAXED` 或手动控制时为
  `null`；
- `cues` 通过 `source: presentation | guitar | angry` 区分一次性提示来源，并保留各自 sequence 与
  generation；
- `nextDeadlineAt` 是状态侧内部调度所需的绝对单调时间，表现层不得根据它重新推导状态或另建计时；
- deadline 自动推进产生的更新通过 `CharacterStateDeadlineRuntime.onUpdate` 使用同一
  `CharacterStateUpdate` 形状发布。

具体嵌套字段仍以 TypeScript 导出类型为准，本文只固定边界与语义，不复制一份可能漂移的完整类型
定义。未来扩展字段必须保持上述入口和来源判别稳定；任何破坏性契约变更需要状态机与表现层两侧
同时确认。

## Consumer-Facing Guarantees

状态机不规定动画机内部如何编排，但它的输出必须满足以下条件，否则任何消费者都无法正确使用：

1. 快照与提示自足：不需要回读状态机内部结构、不需要访问原始输入、不需要反算按键次数或静默
   时长；
2. 生命周期变化只通过持续快照表达，消费者不通过任何播放进度推断模式是否启用；
3. 持续状态 latest-wins，瞬时提示带 sequence 且可去重，消费者重复消费同一提示不会产生第二次
   表现；
4. 提示携带父级 generation，模式切换后到达的旧提示可被消费者识别并丢弃；
5. 无输入显式表示为 `autonomous`，不是"没有值"，消费者据此继续自然演奏而不是停止更新；
6. `releasing` 是独立标记，不与强度等级混同，消费者可据此平滑回落而不直接停机或复位。

动画机支线可以在此基础上增加自己的播放 phase、安全动作点、乐句调度和姿态连续性规则；这些
规则不进入本计划的契约，也不得成为特效机或状态机的语义真相源。

## Effect Migration Boundary

特效机不在本分支实现，由动画机支线另立计划承接 Plan 019 的音符原型并扩展为三模式特效。本分支
的责任是保证状态机输出自足：迁移后特效机不需要回读状态机内部结构，也不需要自行判断静默时长
或输入密度。

因此状态机必须提供以下可观察输出，且这些输出与视觉实现无关：

- `press` 提示携带当前 `activity` 与 `burst`，供表现层即时选择符号形态；
- `accent` 提示独立于 `press` 发出，表现层不需要从按键间隔反推重音；
- `input-rest` 提示只在停键达到休止条件后发出一次，表现层不重新判断静默时长；
- 输入密度分级由状态机以离散档位表达，不要求表现层从 `activity` 反算按键次数；
- 生命周期变化通过持续快照表达，表现层不通过动画机内部 phase 判断吉他模式是否启用。

Plan 019 的音符原型整体移交表现层支线，本分支不再演进 `GuitarNoteEffect` / `GuitarNoteLayer`。
移交后由表现层支线负责删除其中的输入语义，本分支只保证自己这一侧不再存在第二份定义：

- `GuitarNoteEffect` 的 `recentPresses`、`lastInputAt`、`restEmitted` 及 `recordInput` / `triggerRest`
  内部的静默判断必须由状态机输出取代，最终不得残留；
- `GUITAR_NOTE_EFFECT` 的 `activityWindowMs`、`restDelayMs` 与 `sixteenthTiers.minPresses` 阈值
  由状态机定义，常量不得在两处并存；
- 页面不再维护休止计时器，也不再通过 `live2d.isGuitarPerforming` 决定是否生成音符；迁移完成前
  这属于已知原型耦合，不作为本分支的完成条件。

继续保留在特效机、由表现层支线接管的视觉策略：十一种符号、十组调色板、七类轨迹、70 ms 视觉
节流、最多 6 个并发、820 ms 生命周期，以及退出、换模和卸载时的统一清理。

当前页面通过 `live2d.isGuitarPerforming` 决定是否生成音符，属于原型耦合。迁移后，吉他模式的
启用/退出事件先进入状态机，再由同一 lifecycle snapshot 同时驱动动画机和特效机；动画机内部
phase 不再是特效机的语义真相源。

## Scope

- 定义并实现角色父状态机、`MANUAL | AGENT` 所有权和 `RELAXED | GUITAR | ANGRY` 模式契约。
- 复用现有 AmbientReducer 的多 Session 快照，不修改 WSL hook、adapter 或 named pipe payload。
- 将 snapshot 明确发布给主窗口，并分离氛围灯显示开关与模型接管开关的消费者生命周期。
- 定义状态机输出给表现层的持续快照与瞬时提示契约。
- 将当前 3 秒输入窗口、十六分音符增密和 1 秒停键休止作为状态机行为基线。
- 构建吉他与生气等待纯状态机；状态机拥有输入休止和等待升级的语义时间与 deadline。
- 把角色模式接入主窗口：只有内置 MikuCat 可被接管，手动 Expression / Motion 在中央入口仲裁。
- 通过纯逻辑测试验证状态归约、迟滞、释放、等待升级、事件去重与模式切换清理。
- 保持键值隐私边界：只消费去重后的按下时序，不保存或向表现层传递具体键值。

不在本计划中：

- 不实现动画机或特效机；两者的实现、调试与后续优化全部属于动画机支线；
- 不新增模型素材、声音、依赖、Rust 输入监听或仓库外配置；
- 不修改 Codex / Claude hook 数量、事件映射、adapter 或 named pipe 协议；
- 不重做已经通过视觉观察的音符图形、颜色和轨迹；
- 不在首版实现特效插件系统、生气特效或其他尚未设计的视觉 profile。

## Tasks

1. [x] 固定父级角色状态、所有权、优先级和 generation 契约；以纯 TypeScript 归约器和测试验证
       缓存后接管、多 Session 优先级、同模式不重启、旧快照拒绝和手动交还。
2. [x] 将现有 Ambient snapshot 定向发布给主窗口；拆分氛围灯显示与 Agent 模型接管开关，并保证
       任一消费者开启时接收服务仍维护当前 Session 快照。Windows dev 已由用户确认无异常。
3. [x] 建立主窗口 Presentation Controller：初始化时先恢复当前 snapshot，再启用接管；集中仲裁
       手动 Expression / Motion，并仅对声明能力的 MikuCat 生效。Windows dev 已确认编译恢复正常。
4. [x] 接入父级最小表现适配，验证 `RELAXED / GUITAR / ANGRY` 的进入、退出、优先抢占和清理，
       相同 generation 不得重启动画。Windows dev 视觉验收通过。
   - [x] 父级收尾增加一次性 `ALL_SESSIONS_DONE` cue，以 `sessionId` 比较前后状态，排除重复快照、
         重连恢复、延迟接管与 Session 移除；本分支只固定语义，豆豆完成动画由动画机支线消费。
5. [x] 固定吉他持续快照、瞬时提示、sequence、deadline 和表现层消费端的最小 TypeScript 契约。
6. [x] 用可注入单调时钟实现纯吉他状态归约器；先写输入开始、强度升降、迟滞、停键释放、单次休止
       和快速恢复的预期失败测试。
7. [x] 为生气等待建立纯子状态机：固定 `ANNOYED / IMPATIENT / FURIOUS`、8 秒与 25 秒 deadline、
       单次升级 cue、漏唤醒收敛、连续等待不重置及 generation 淘汰语义。
8. [x] 定义父级到活跃子状态机的统一输出封装；`RELAXED` 停用全部子状态，`GUITAR` 与 `ANGRY`
       同时只能有一个子状态机处于 ACTIVE，模式切换必须使旧输入、deadline 与 cue 失效。
9. [x] 建立状态侧薄协调器，以单调时钟和 `nextDeadlineAt` 驱动当前子状态机；它只负责唤醒、转发与
       lifecycle 清理，不自行判断休止、输入密度或生气强度，也不依赖表现层 phase。
10. [x] 以纯逻辑测试覆盖父级在 `RELAXED / GUITAR / ANGRY` 间切换、旧 deadline 淘汰、漏唤醒以及
        持续快照和瞬时提示的统一转发；冻结交给表现层支线的公共契约。
11. [ ] 完成本分支全部状态机的定向测试、静态检查与主窗口回归验证；动画、特效、Plan 019 语义
        删除及视觉验收全部由表现层支线负责。

## Acceptance

以下断言全部在状态机的快照与提示层面验证，不依赖 Live2D 画面或 DOM 渲染结果。

角色与所有权：

- Agent 接管关闭时，Agent Session 变化不改变角色，手动 Expression / Motion 保持可用；开启后手动
  请求在中央入口被拒绝，关闭后立即恢复。
- 多 Session 同时存在时严格满足 `WAITING > WORKING > RELAXED`；最近更新的是 done 也不能覆盖
  另一个仍在 waiting 或 working 的 Session。
- 同一角色模式内的后续 hook 只更新源快照，不增加 presentation generation，也不重启表现。
- 只有活跃会话真实完成并使当前全部 Session 进入 done 时才产生一次 `ALL_SESSIONS_DONE`；Session
  移除、重复 done、重连和接管开关恢复不会重放该提示。
- Agent 接管与氛围灯开关相互独立；任一开启时状态接收仍工作，重新打开接管立即反映当前 Session。
- 退出 `GUITAR` 后，旧 generation 的按键提示与 deadline 全部失效，迟到事件不能复活状态。

吉他子状态机：

- 吉他模式下连续无输入时，快照稳定在 `autonomous`，不凝固、不重复触发 `input-rest`。
- 零散、稳定和密集输入之间有迟滞，不因单个按键或阈值附近抖动频繁切换状态。
- 第一次 press 产生一个 `press` 提示并进入 `engaged`；第 6 次进入 `groove`；第 12 次或 600 ms
  内第 5 次进入 `drive`。
- 停键达到休止条件后只产生一次 `input-rest`；随后快照稳定在 `autonomous` 且 `releasing` 归位。
- `releasing` 期间恢复输入时取消释放并平滑转向新意图，不产生第二次入场。
- 密集输入中途的 `accent` 提示按冷却与合并规则发出，至多在每个冷却窗口内一次，当前动作不被
  重复重启。

生气等待子状态机：

- 进入 `ANGRY` 后立即为 `annoyed`，连续 8 秒与 25 秒分别升级为 `impatient`、`furious`。
- 每个阈值只产生一次 `anger-escalated`；晚唤醒跨越多个阈值时只产生最终强度的一个提示。
- 同一段连续 `ANGRY` 不因重复快照或 waiting Session 替换而重置；退出后 deadline 清空。
- 新等待周期使用更高 generation 从 `annoyed` 重新开始，旧 generation 不能升级当前周期。
- `furious` 是稳定最终强度，不由状态机周期性产生提醒；是否重复播放表现由表现层自行决定。

输出自足性（Effect Migration Boundary）：

- `press` 提示携带当前 `activity` 与 `burst`，表现层无需回读状态机内部结构即可选择符号形态。
- 输入密度以离散档位表达，表现为快照或提示上的明确字段，不要求表现层从 `activity` 反算按键
  次数。
- `input-rest` 只在状态机判定静默后发出一次，表现层不重新判断静默时长。
- 吉他模式是否启用由生命周期快照表达，表现层不需要读取动画机内部 phase。
- 本分支自身不再定义第二份 3 秒窗口、1 秒休止或密度阈值：`GUITAR_INTERACTION` 是这些语义的
  唯一来源。Plan 019 遗留的 `activityWindowMs`、`restDelayMs`、`sixteenthTiers.minPresses` 与
  `recentPresses` / `lastInputAt` / `restEmitted` 的实际删除由表现层支线在移交时完成，不作为本
  分支的完成条件。

边界与回归：

- 状态机不写 Live2D 参数、不创建视觉节点、不解释颜色与轨迹。
- 状态侧协调器不依赖任何表现层 phase，页面不再新增休止或升级计时器。
- 退出吉他或生气模式、切换模型或卸载页面时，全部 deadline 与待处理提示停止，其他模型行为不变。
- 不传递、记录或持久化具体键值，现有输入统计结果不受影响。
- Windows dev 中主猫、拖动、缩放、镜像、点击、托盘、手动表情切换与输入统计没有可见回归；
  动画与特效的视觉验收由表现层支线负责。

## Risks / Dependencies

- 当前 Rust runtime 只有一个 `enabled`，关闭时会清空 reducer，并且只向 `ambient` 窗口发布快照；
  接入主窗口前必须拆开“是否接收”和“哪个消费者显示/接管”，不能直接复用当前开关语义。
- 主窗口现有 `SET_EXPRESSION` / `START_MOTION` 直接写 Live2D；只禁用偏好页按钮无法形成所有权边界，
  快捷键和程序事件仍可能绕过。
- 动画机支线已在独立 worktree 的 `feat/mikucat-v2-animation-engine` 上开发，动画与特效全部由该
  支线实现；本支线不得直接修改该 worktree，只保证状态机输出自足并与其按公共契约对齐。
- 本分支保留的 `guitarHandAnimation.ts` / `guitarPerformance.ts` 是动画机的前身实现，迁移完成后
  应由动画机支线接管，本分支不继续演进它们；`live2d.ts` 中的吉他表情接管理论上应随之下移。
- 表现层迁出后，本分支失去端到端视觉验证手段；动画机支线需要自建可回放的 cue 测试源，否则
  两边只能靠人工接力验证。
- 当前状态机/特效原型与动画机支线可能同时修改 `live2d.ts`、`main/index.vue` 或设备输入接线，
  合并时应按本契约重接边界，不能简单选择任一侧整文件。
- activity 阈值、迟滞和 attack / release 时间需要合成时序测试与 Windows 视觉观察共同校准。
- 输入密度迁入状态机后改变语义时（例如调整 `maxActivityPresses`），会同时改变音符密度与节奏
  表现；该常量属于状态机，但影响面在表现层，变更需两侧确认。
- Windows dev 和构建继续由用户在 `D:\VibeTool\BongoCat` 执行，本计划不替用户构建或写入 Git。

## Verification

父级角色归约器已按 Red-Green-Refactor 建立：首次测试因模块不存在失败；最小实现首次运行暴露
内部缓存形状错误并由测试捕获，修正后 5 个行为测试通过。当前仅实现纯逻辑层，尚未接入 Rust
发布、Vue、Live2D、动画机或特效机。

任务 2 已完成：Rust runtime 以 indicator / presentation 两个独立消费者替代单一
`enabled`，任一开启时继续 ingest 与 TTL，分别向 `ambient` / `main` 窗口发布同一 snapshot；只有
indicator 产生 alert 和控制氛围窗口，两者全关时才清空 reducer。新增持久化但默认关闭的
`agentModelControlEnabled` 及 Tauri command；该阶段尚未暴露的偏好页开关现由任务 4 补齐。
2 个 Rust 行为测试已先写入；WSL 没有 Rust 工具链，未单独运行这些测试，Windows dev 由用户
完成并确认观察无异常。

任务 3 已按 Red-Green-Refactor 写入待验证实现：5 个控制权测试先因控制器模块不存在而失败，随后
验证 snapshot 先恢复、内置 MikuCat 能力识别、非支持模型保持手动、换模交还以及关闭开关交还。
主窗口注册监听后主动获取 snapshot，只有收到有效快照才读取接管开关；初始化失败保持手动。
现有 `START_MOTION` / `SET_EXPRESSION` 在同一入口检查所有权。具体 Expression 和动画映射仍属于
任务 4。当前 62 项 utils 测试、定向 ESLint、TypeScript 检查、Vite 生产构建及 `git diff --check`
通过。Controller 的 3 个文件已增量同步 Windows；首次 dev 暴露 Windows 独立工作副本缺少已提交的
父级 `characterPresentation.ts`，随后补齐该文件及其测试，5 个文件均核对 SHA-256 一致；用户确认
Windows dev 热重载后错误消失，任务 3 关闭。

任务 4 已写入待验收实现：通用设置新增默认关闭的“Agent 接管模型”开关；表现适配器只消费新的
presentation generation，并在目标尚未加载时保留该 generation 以供重试。内置 MikuCat 按
model3 中的语义文件路径解析默认、生气和吉他表情，不硬编码表情序号；`GUITAR` / `ANGRY` 锁定
鼠标输入，`RELAXED` 与交还手动控制恢复默认表情和鼠标。换模先释放旧模型，加载完成后才对新模型
申请控制，异步旧加载结果不能恢复过期能力。测试先得到适配器缺失和 Live2D API 缺失的预期失败；
实现后又由既有测试捕获吉他入场姿态被清零的顺序回归，修正后 68 项 utils 测试、定向 ESLint、
TypeScript、5 份 locale JSON 解析、Vite 构建及 `git diff --check` 通过。构建只有既有动态导入和
chunk 大小警告。11 个源文件已增量同步 Windows 并核对 SHA-256。用户随后确认开关与三态表现观察
无异常，任务 4 关闭；父级角色状态机至此完成最小端到端闭环。

任务 4 的父级收尾按 Red-Green-Refactor 补齐完成边沿：4 个新测试先因 transition 尚无 `cues` 失败；
实现后以 `sessionId` 比较前后状态，只在最后一个活跃 Session 从 working / waiting 进入 done 时
发出一次 `all-sessions-done`。多 Session 未全部完成、SessionEnd 式移除、重复全 done、初始恢复和
延迟接管均不会发出 cue。全量 72 项 utils 测试、定向 ESLint、TypeScript 与 `git diff --check`
通过。3 个相关文件已增量同步 Windows 并核对 SHA-256。当前只发布语义事件，尚未在本 worktree
编排或播放豆豆完成动画。

任务 5～6 已建立纯 `GuitarInteractionMachine`。9 项合成时序测试先因模块不存在得到预期失败，
随后验证 INACTIVE 输入拒绝、AUTONOMOUS 激活、ENGAGED / GROOVE / DRIVE 升级、降级迟滞、600 ms
burst、1.2 秒 ACCENT 冷却、400 ms releasing、1 秒单次 INPUT_REST、释放中恢复、漏唤醒后的新
乐句、revision / cue sequence 分离和父级 generation 淘汰旧工作。目标测试、定向 ESLint、
TypeScript 及全量 81 项 utils 测试通过。当前尚未接入页面或任一消费者，因此没有改变 Windows
可观察行为。两个新增 TypeScript 文件已增量同步 Windows 并核对 SHA-256。

任务 7 已建立纯 `AngryWaitingMachine`。6 项合成时序测试先因实现模块不存在得到预期失败，随后
验证初始 `ANNOYED`、8 秒 `IMPATIENT`、25 秒 `FURIOUS`、每阈值单次 cue、漏唤醒直接收敛、同一
generation 不重置、退出清理、旧 generation 拒绝和单调时钟回退保护。目标测试、定向 ESLint 与
TypeScript 检查通过；当前未接页面或消费者，因此没有改变 Windows 可观察行为。

任务 8 已建立纯 `CharacterStateCoordinator`，统一封装父级快照、当前唯一活跃子快照、带来源的
cue 与 `nextDeadlineAt`。6 项测试覆盖父级在 `GUITAR / ANGRY / RELAXED / MANUAL` 间切换、按键只
路由到吉他、同 generation 的生气等待不重置、旧输入与旧 deadline 淘汰，以及父级完成 cue 不被
误当成子状态提示。连接器不创建真实 timer，也不调用动画机或特效机；deadline 调度仍属于任务 9。

任务 9～10 在同一个 `CharacterStateCoordinator` 内加入了可选的单次 deadline runtime，没有新增
状态机或持续轮询。4 项新增测试验证生气在 8 秒与 25 秒自动唤醒、漏唤醒直接收敛、吉他新输入替换
旧释放 timer、400 ms releasing 后继续预约 1 秒休止，以及模式切换和 dispose 后取消 timer；即使
保留并手工调用旧 callback，也会被 token 与 generation 拒绝。协调器仍不判断输入密度或生气强度，
只根据子状态机返回的绝对 `nextDeadlineAt` 维护至多一个 timer，并通过 `onUpdate` 发布自动推进结果。
