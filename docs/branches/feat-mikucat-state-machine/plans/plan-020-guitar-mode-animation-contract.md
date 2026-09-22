# Plan 020: Character / Guitar State Machines and Presentation Engines

- Status: active
- Summary: pending
- Branch: `feat/mikucat-state-machine`
- Depends on: [Plan 018](plan-018-mikucat-guitar-performance.md), [Plan 019](plan-019-mikucat-guitar-notes.md)

## Goal

建立两级状态机与两个同级表现消费者的稳定契约。父级角色状态机把现有 Agent 多 Session 快照
归约为唯一的角色模式；只有进入 `GUITAR` 时，子级吉他状态机才把键盘输入和时间解释为演奏意图。
动画机把意图转换为连续的 Live2D 动作，特效机把同一意图转换为音符、粒子、贴图或光效。
无输入不是控制权空档，而是明确的 `AUTONOMOUS` 状态；动画机继续自然演奏，特效机保持安静或
完成已有实例，两者都不反向定义语义状态。

## Architecture Boundary

完整链路由一个父状态机、一个按需激活的子状态机和两个表现消费者组成：

1. **角色状态机**读取现有 `AmbientSnapshot.sessions` 和 Agent 接管开关，按固定优先级归约为
   `RELAXED | GUITAR | ANGRY`；它不直接读取原始 hook，也不写模型或特效。
2. **吉他状态机**仅在父级为 `GUITAR` 时接收去重后的按键边缘和时间流逝，归约出持续状态与
   一次性提示；它不写 Live2D
   参数、不创建视觉节点，也不维护角色姿态或特效实例。
3. **动画机**消费状态机的输出，维护自己的时间轴、当前姿态、速度、乐句和安全切换点；它是头、
   身体、耳朵、右手和吉他等模型参数的唯一写入者。
4. **特效机**消费同一份输出，维护音符及未来粒子、贴图、光晕等模型外视觉实例；它负责生成、
   节流、容量、播放和回收，不解释原始输入，也不写 Live2D 参数。

动画机和特效机是同一状态输出的并列消费者，可以采用不同响应时机：特效机可在按键发生时立即
显示音符，动画机则可等到拍点、重音点或乐句边界再平滑落实同一个意图。两者互不调用、互不等待。

```text
Codex / Claude hooks -> existing AmbientReducer -> AmbientSnapshot.sessions
                                                    │
                         agent takeover switch ─────┤
                                                    ▼
                                      Character State Machine
                                  RELAXED | GUITAR | ANGRY
                                                    │
                          ┌─────────────────────────┴───────────────────────┐
                          │ GUITAR                                         │
                          ▼                                                │
             Guitar Interaction State Machine                             │
       KeyboardPress + monotonic time -> snapshot + cues                  │
                          └─────────────────────────┬───────────────────────┘
                                                    │ fan-out
                                      ┌─────────────┴─────────────┐
                                      ▼                           ▼
                              Animation Engine              Effect Engine
                              Live2D parameters          DOM / Canvas / Sprite
```

状态机的一次归约结果由薄接线层扇出给两个消费者；该接线层只负责转发和生命周期清理，不成为
第四个业务引擎。数据流保持单向。动画机或特效机可以暴露调试快照，但这些内部播放状态不是键盘
语义状态机的输入，也不得形成相互驱动的循环依赖。

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
- 每个子状态提示携带父级 `generation`；切出 `GUITAR` 后到达的旧提示必须被拒绝。
- 开启接管时使用已缓存的当前快照立即派生模式；关闭时使旧 generation 失效，退出吉他子状态、
  清理特效、恢复鼠标控制并把角色交还默认手动态。

Agent 接管是独立于现有“Agent 氛围灯”的持久化开关。接收服务在任一消费者开启时都必须继续
归约 Session；氛围灯关闭不能导致模型控制丢失状态，模型控制关闭也不能关闭氛围灯。偏好页可以
禁用手动按钮作为提示，但真正的 Expression / Motion 拦截必须位于主窗口中央入口，防止快捷键或
程序事件绕过。首版只允许明确声明能力的内置 MikuCat 被 Agent 接管，其他内置和自定义模型保持
手动行为。

## Engine Ownership Boundary

| Concern                                | State Machine | Animation Engine | Effect Engine |
| -------------------------------------- | ------------- | ---------------- | ------------- |
| 按键时序、输入密度、迟滞和休止语义     | owns          | reads intent     | reads intent  |
| Live2D Expression / Motion / Parameter | never writes  | sole writer      | never writes  |
| 音符、粒子、贴图和光晕实例             | never creates | never creates    | owns          |
| 自主乐句、姿态、速度和安全动作点       | no            | owns             | no            |
| 颜色、轨迹、视觉节流、容量和 TTL       | no            | no               | owns          |

未来“生气”等状态可以同时被两个表现引擎消费：表情、耳朵或身体动作归动画机；烟雾、火花和
外部气场归特效机。本计划先接通角色状态与吉他表现，不提前实现生气特效 profile、插件注册系统
或通用特效 DSL。

## Guitar Interaction State Contract

生命周期与输入活跃度必须分成两个维度，避免把“吉他模式是否启用”和“最近是否打字”混为一谈：

- lifecycle：`OFF -> ENTERING -> ACTIVE -> LEAVING -> OFF`
- interaction：`AUTONOMOUS | ENGAGED | GROOVE | DRIVE | DECAY`

其中：

- `AUTONOMOUS`：没有近期输入，动画机仍播放自己的自然演奏乐句；
- `ENGAGED`：出现零散输入，给予轻量响应；
- `GROOVE`：形成持续输入节奏，允许提高演奏活力；
- `DRIVE`：短时间高密度输入，允许安排更强重音或更密集表现；
- `DECAY`：输入停止后的平滑释放阶段，随后回到 `AUTONOMOUS`，不得直接停机或复位。

状态名和阈值在实现测试中可以微调，但“无输入是显式自治状态”和“生命周期与活跃度正交”是固定
架构约束。

状态机输出分成两类：

- **持续快照（latest wins）**：生命周期、interaction、归一化 activity / 输入密度、节奏与力度
  偏置和递增 sequence；新快照可以覆盖尚未消费的旧快照。
- **瞬时提示（edge event）**：例如 `PRESS`、`ACCENT`、`INPUT_REST`；必须通过 sequence、队列或
  合并规则避免重复消费，也不能被误当成持续状态。

`INPUT_REST` 表示输入停止后的一次语义标点，可供休止符和动画机使用，但不表示动画停止。它与
当前动画数据中的内部 `rest` / 放松片段是不同概念，后续实现必须使用不会混淆的命名。

状态机采用可注入的单调时钟。运行时可以根据状态机给出的下一个 deadline 安排唤醒，但“是否已
到休止点”和“是否只发送一次 `INPUT_REST`”必须由纯状态归约决定，不能继续散落在 Vue 页面计时器中。

## Animation Engine Contract

动画机消费状态时遵守以下优先级和收敛规则：

1. 模型切换和 `LEAVING` 最高优先，负责清理待处理提示并平滑交还控制权；
2. `ENTERING` / `ACTIVE` 等生命周期过渡高于普通输入意图；
3. 一次性 `ACCENT` 等提示经过冷却、合并或排队，在最近的安全动作点执行；
4. interaction、activity、节奏和力度属于持续目标，在拍点或乐句边界被采纳；
5. 没有更高优先级输入时，回落到 `AUTONOMOUS` 的动画机基线，而不是停止更新。

状态变化不得直接重新播放当前片段、把参数重置为零或抢写模型参数。输入发生在动作中途时，动画机
延续当前姿态和速度，在安全边界应用最新持续状态；密集的一次性提示可以合并，但不得无限排队。
`DECAY` 期间再次输入应取消回落并平滑转向新的目标，不重新执行完整入场动画。

## Effect Engine Contract

特效机的公共边界不能以“音符”命名；音符只是第一个 effect profile。首版无需建立插件框架，
但核心引擎必须能接收状态快照和瞬时提示，并独立维护 effect instance 的创建、并发容量、TTL、
回收和整体清理。

Plan 019 的迁移按以下规则执行：

- `recentPresses`、`lastInputAt`、`restEmitted`、3 秒活跃窗口和 1 秒休止判断迁入状态机；
- 十一种符号、十组调色板、七类轨迹、70 ms 视觉节流、最多 6 个和 820 ms 生命周期保留在特效机；
- `PRESS` 到达时，特效机可以结合最新 activity 立即选择普通或十六分音符；
- `INPUT_REST` 到达时，特效机只选择并播放一种休止符，不自行重新判断静默时长；
- sequence 由两个消费者分别记录，特效机不得重复播放已经消费的瞬时提示；
- 切换模型、退出吉他模式或卸载页面时，特效机统一清空实例和回收任务；
- `GuitarNoteLayer.vue` 继续作为只读渲染层，不监听输入、不判断状态。

当前页面通过 `live2d.isGuitarPerforming` 决定是否生成音符，属于原型耦合。迁移后，吉他模式的
启用/退出事件先进入状态机，再由同一 lifecycle snapshot 同时驱动动画机和特效机；动画机内部
phase 不再是特效机的语义真相源。

## Scope

- 定义并实现角色父状态机、`MANUAL | AGENT` 所有权和 `RELAXED | GUITAR | ANGRY` 模式契约。
- 复用现有 AmbientReducer 的多 Session 快照，不修改 WSL hook、adapter 或 named pipe payload。
- 将 snapshot 明确发布给主窗口，并分离氛围灯显示开关与模型接管开关的消费者生命周期。
- 定义状态机到动画机与特效机的共享输出契约。
- 将当前 3 秒输入窗口、十六分音符增密和 1 秒停键休止作为行为基线，而不是直接固化为动画参数。
- 构建纯状态机，以及承接 Plan 019 视觉行为的首版特效机。
- 为动画机增加消费“持续状态 + 瞬时提示”的适配入口，并保留其自主乐句调度。
- 通过纯逻辑测试验证状态归约、迟滞、释放、事件去重、特效生命周期和动画机仲裁。
- 保持键值隐私边界：只消费去重后的按下时序，不保存或向表现层传递具体键值。

不在本计划中：

- 不新增模型素材、声音、依赖、Rust 输入监听或仓库外配置；
- 不修改 Codex / Claude hook 数量、事件映射、adapter 或 named pipe 协议；
- 不重做已经通过视觉观察的音符图形、颜色和轨迹；
- 不在首版实现特效插件系统、生气特效或其他尚未设计的视觉 profile；
- 不要求状态机支线直接合并动画机支线的全部内部实现。

## Tasks

1. [x] 固定父级角色状态、所有权、优先级和 generation 契约；以纯 TypeScript 归约器和测试验证
       缓存后接管、多 Session 优先级、同模式不重启、旧快照拒绝和手动交还。
2. [ ] 将现有 Ambient snapshot 定向发布给主窗口；拆分氛围灯显示与 Agent 模型接管开关，并保证
       任一消费者开启时接收服务仍维护当前 Session 快照。
3. [ ] 建立主窗口 Presentation Controller：初始化时先恢复当前 snapshot，再启用接管；集中仲裁
       手动 Expression / Motion，并仅对声明能力的 MikuCat 生效。
4. [ ] 接入父级最小表现适配，验证 `RELAXED / GUITAR / ANGRY` 的进入、退出、优先抢占和清理，
       相同 generation 不得重启动画。
5. [ ] 固定吉他持续快照、瞬时提示、sequence、deadline 和两个消费者的最小 TypeScript 契约。
6. [ ] 用可注入单调时钟实现纯吉他状态归约器；先写输入开始、强度升降、迟滞、停键释放、单次休止
       和快速恢复的预期失败测试。
7. [ ] 构建特效机的实例生命周期，并把 Plan 019 的符号、颜色、轨迹、节流、容量和回收策略迁入；
       先写提示去重、即时音符、单次休止和统一清理测试。
8. [ ] 增加薄接线层，将同一次归约的 snapshot / cues 扇出给特效机和测试替身；移除页面中的语义
       休止判断及特效机对动画 phase 的依赖。
9. [ ] 在 Windows dev 中确认状态机与特效机重构前后音符视觉和生命周期行为等价。
10. [ ] 动画机支线接口就绪后增加第二个消费者适配层，在不重启当前动作的前提下，于安全边界采纳
        最新持续状态并合并一次性提示。
11. [ ] 接入头、身体、耳朵、右手和吉他的单一参数写入链路，排除状态机或特效机的旁路写入。
12. [ ] 完成父子状态机及两个表现引擎合并后的定向测试、静态检查和 Windows dev 视觉验收。

## Acceptance

- Agent 接管关闭时，Agent Session 变化不改变角色，手动 Expression / Motion 保持可用；开启后手动
  请求在中央入口被拒绝，关闭后立即恢复。
- 多 Session 同时存在时严格满足 `WAITING > WORKING > RELAXED`；最近更新的是 done 也不能覆盖
  另一个仍在 waiting 或 working 的 Session。
- 同一角色模式内的后续 hook 只更新源快照，不增加 presentation generation，也不重启表现。
- Agent 接管与氛围灯开关相互独立；任一开启时状态接收仍工作，重新打开接管立即反映当前 Session。
- 退出 `GUITAR` 后，旧 generation 的按键提示、动画请求和特效请求全部失效。
- 吉他模式下连续 30 秒无输入，角色仍以 `AUTONOMOUS` 乐句自然演奏，不凝固、不重复触发
  `INPUT_REST`。
- 从无输入开始打字时，音符立即响应；角色动画可以延迟到安全边界增强，但不得跳姿势、清零或
  重进入场动画。
- 同一个 snapshot / cue 扇出给动画机和特效机，任一消费者暂停、延迟或清理都不阻塞另一方，
  两者也不直接互相调用。
- 零散、稳定和密集输入之间有迟滞，不因单个按键或阈值附近抖动频繁切换状态。
- 动作中途出现密集输入时，重音提示至多按合并规则执行一次，当前动作不被重复重启。
- 停键达到休止条件后只产生一次 `INPUT_REST`；角色经 `DECAY` 平滑回到 `AUTONOMOUS`，动画
  继续运行。
- `DECAY` 期间恢复输入时平滑转向新意图，不发生姿态突跳或重复入场。
- Plan 019 已验收的十一种符号、双色高光、三象限轨迹、70 ms 节流、6 个容量和 820 ms 生命周期
  在迁移后保持可观察等价；特效机不再保存输入历史或判断静默时长。
- 退出吉他表情、切换模型或卸载页面时，待处理提示、计时器和参数写入全部停止；其他模型行为不变。
- 音符层、贴图层和状态机都不直接写 Live2D 参数；同一模型参数在任一帧只有动画机一个写入源。
- 不传递、记录或持久化具体键值，现有输入统计结果不受影响。

## Risks / Dependencies

- 当前 Rust runtime 只有一个 `enabled`，关闭时会清空 reducer，并且只向 `ambient` 窗口发布快照；
  接入主窗口前必须拆开“是否接收”和“哪个消费者显示/接管”，不能直接复用当前开关语义。
- 主窗口现有 `SET_EXPRESSION` / `START_MOTION` 直接写 Live2D；只禁用偏好页按钮无法形成所有权边界，
  快捷键和程序事件仍可能绕过。
- 动画机支线需要提供稳定的“安全边界消费”入口；其实际分支名和合并提交以届时仓库为准，本文
  不假设尚未合并的文件结构。
- 当前状态机/特效原型与动画机支线可能同时修改 `live2d.ts`、`main/index.vue` 或设备输入接线，
  合并时应按本契约重接边界，不能简单选择任一侧整文件。
- activity 阈值、迟滞和 attack / release 时间需要合成时序测试与 Windows 视觉观察共同校准。
- 状态机意图与画面实际动作允许短暂错位，这是安全边界调度的预期结果；若没有 sequence 和合并
  规则，瞬时提示仍可能重复或积压。
- Windows dev 和构建继续由用户在 `D:\VibeTool\BongoCat` 执行，本计划不替用户构建或写入 Git。

## Verification

父级角色归约器已按 Red-Green-Refactor 建立：首次测试因模块不存在失败；最小实现首次运行暴露
内部缓存形状错误并由测试捕获，修正后 5 个行为测试通过。当前仅实现纯逻辑层，尚未接入 Rust
发布、持久化开关、Vue、Live2D、动画机或特效机，也未同步 Windows 或执行 dev。下一步进入任务 2。
