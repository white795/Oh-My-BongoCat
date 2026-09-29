# Plan 025: Guitar Performance Planner

- Status: complete
- Summary: [Summary 025](../summaries/summary-025-guitar-performance-planner.md)
- Branch: `feat/mikucat-v2-animation-engine`
- Parent: [Plan 021](plan-021-mikucat-v2-animation-engine.md)

## Goal

把当前只会展开固定模板的 `GuitarPerformancePlanner` 升级为确定性的演奏规划器。规划器根据
`profile / activity / releasing`、冻结动作资格和自身可审计历史，生成基础乐句、Motif、收句及乐句
强度；`GuitarHandAnimation` 只执行规划结果，不再自行决定演奏策略。第一版先解决低强度 Motif 前后
A 过强的问题，再逐步接入 Motif 调度规则。

## Scope

- 固定规划输入：当前 durable intent、上一份规划结果、近期动作历史和安全乐句边界；
- 固定规划输出：乐句或 Motif 身份、语法角色、Profile、可执行强度、迭代/插槽及可审计原因；
- 由规划器根据连续 `activity` 生成 A/A′/Cadence 的载体强度，播放器在生成轨迹目标时统一应用；
- 八项冻结 Motif 继续以标准强度保存，动作文件不包含 A 的上下文增益；
- 按 Profile 过滤 Motif，定义合法前后继、基础乐句最少重复数、Motif 最大连续数、冷却和近期历史；
- 第一版使用确定性规则，给定相同输入和历史必须产生相同规划，不引入随机抽取；
- 规划器稳定后，让开发态预览和未来生产消费端口复用同一份规划/强度契约。

不在本计划中：

- 不新增、删除或重编八项冻结 Motif、A/A′、Cadence 和头发次级运动；
- 不读取键值、计算输入密度、维护静默 deadline 或重新归约状态机；
- 不消费 `PRESS / ACCENT / INPUT_REST` 瞬时 cue，不修改 Plan 022 特效机；
- 不接真实状态总线，不实现 generation/revision/sequence 传输层去重；
- 不增加生产依赖、声音、模型资源或 Rust/Tauri 行为；
- 不以自动测量动作参数峰值代替显式规划规则。

## Tasks

1. [x] 以行为测试固定规划器输入/输出契约。输出至少包含可区分的 `phrase / motif` 身份、语法角色、
       Profile、`gain`、插槽/迭代和选择原因；旧固定模板行为在迁移期间保持可验证。
2. [x] 首先实现载体强度规划：连续 `activity` 单调映射为 A 的 `gain`，只在乐句边界采纳；Motif
       继续使用标准增益。播放器只把规划结果统一应用到拨弦、头、身体、按弦手、吉他和双耳，不读取
       `activity` 决策策略。
3. [x] 在 Windows dev 校准低/中/高三个端点。低强度 A 不得盖过 `tuning-listen / lazy-arpeggio /
sustain-sway`，中强度仍能建立节奏，高强度 DRIVE 与当前验收效果基本一致；只做代表性边界
       回归，不重新验收全部动作主体。
4. [x] 将八项冻结目录转为累计强度资格。每项分别声明最能代表的 `homeProfile` 和允许出现的
       `minimumProfile`；高强度可包含低强度动作，低强度不能包含高强度动作。明确
       `single-pick-ack` 实验模块永不进入生产候选。
5. [x] 实现第一版确定性语法：主强度 Motif 与累计支撑 Motif 交替；普通块为
       `A → A → Motif → A`，`immersed-double-nod` 保留 `A → A → A′ → Motif`。Motif 不连续，同一
       动作不能立即重复；Profile 变化会取消尚未开始的旧强度动作，但不打断当前句。
6. [x] 让 `releasing` 只影响后续规划，不中断当前乐句；定义从当前强度进入 SoftCadence、A 或
       AUTONOMOUS 的确定路径，并防止旧高强度计划在释放后继续排队。
7. [x] 让开发菜单和快照暴露规划结果及 `gain`，使用固定输入逐项审计资格、前后继、冷却和历史；
       播放器不得恢复随机 Motif 池或产生第二个 ticker。
8. [x] 运行规划器/播放器定向测试、相关 Live2D 生命周期回归、TypeScript、定向 ESLint 和差异检查，
       增量同步到 Windows 镜像并完成视觉验收。

## Progress / Verification

第一增量已经实现。`GuitarPerformancePlanner` 现在为模板乐句和开发态 Motif 上下文统一输出
`kind / role / profile / gain / reason / slot`；模板结果继续携带模板 ID 与迭代，Motif 结果携带动作
ID。载体强度使用 `0.60 + 0.40 × smoothstep(activity)`，输入先约束到 `0..1`，因此低/中/高代表值
分别为 `0.60 / 0.8592 / 1.00`。A、A′ 和 Cadence 的七条演奏通道统一消费该值，Motif 始终使用
`gain = 1`；动作资产没有写入上下文强度。

行为测试先确认旧规划器缺少统一结果与强度字段，再接入最小实现。播放器测试确认低强度载体七条
通道均明显低于高强度、Motif 保持标准增益，并且乐句中途更新 activity 不改变当前计划，只在下一
乐句开始时采纳。规划器、播放器、Motif 注册表与 Live2D 桥接四个定向测试文件通过，TypeScript、
定向 ESLint 与差异检查通过。下一步只做 Windows dev 的低/中/高视觉标定；通过前不实现 Motif
自动调度。

Windows dev 随后确认低、中、高三档层级及两侧边界均无异常，任务 3 完成。第二增量不再把动作的
原始 `profile` 当作互斥分组，而拆为 `homeProfile / minimumProfile`。当前通用候选为
`tuning-listen / lazy-arpeggio / sustain-sway / two-note-answer / call-response-sway`；
`syncopated-chord-walk` 从 GROOVE 开始可用，`immersed-double-nod / fretboard-slide-accent` 只在
DRIVE 可用。因而 AUTONOMOUS 有五项动作，DRIVE 可累计使用全部八项，但高强度动作不会向下泄漏。

自动规划以四句块运行，并在当前强度主动作与累计支撑动作之间确定性交替；两个候选池分别使用循环
游标，最近一次动作不能立即重复。规划结果用 `performance-home-motif` 或
`performance-support-motif` 记录选择原因。普通动作使用 `A → A → Motif → A`，点头动作继续使用
已验收的 `A → A → A′ → Motif`。选择只在 Motif 真正开始时提交；若 Profile 在铺垫期间下降，待播
高强度动作及其剩余队列会被丢弃，新 Profile 从 A 重新建立。播放器默认消费该自动乐谱；原模板
override 和单 Motif 预览仍可独立验收。

本轮以 Red-Green 固定累计候选表、四档前八个 Motif 序列、主/支撑原因、普通与特殊块形状以及
DRIVE 降级取消行为。13 个规划器、播放器、动作目录和 Live2D 相关测试文件通过，TypeScript、定向
ESLint 与差异检查通过。Windows dev 随后确认四档自动编排没有明显问题，第二增量通过视觉验收。

第三增量实现确定性释放相位。规划器第一次在安全边界看到 `releasing=true` 时撤销剩余普通块和
尚未开始的 Motif，输出一次 `performance-release-cadence / SoftCadence`；后续持续释放只输出
`performance-release-hold / A`，并在每个乐句边界使用最新 activity 计算 gain。释放期间 Profile
下降只更新保持句的 Profile，不会重播 Cadence；恢复 `releasing=false` 后从新的 establish A 开始，
同时保留已经实际播放过的 Motif 历史。开发菜单新增
`Guitar release (dev) → ACTIVE / RELEASING (LOW ACTIVITY)`；后者使用不高于 `0.15` 的代表性 activity，
前者恢复所选 Profile 的开发默认值，因此不需要 DevTools 即可观察完整收束与恢复。

本轮测试先确认旧实现会继续排队的 A′/repeat 而按预期失败；实现后固定排队 Motif 取消、Cadence
恰好一次、跨 Profile 不重播、保持句动态 gain、Motif 播放中不被打断及恢复后从 A 重建。13 个相关
测试文件、TypeScript、定向 ESLint 与差异检查通过。Windows dev 随后确认不同 Profile 下的当前句、
Motif、SoftCadence、保持 A 和恢复 A 均没有断裂；释放路径与第一版自动规划器至此冻结。

收尾时确认状态机 `GuitarInteractionSnapshot.interaction / activity / releasing` 与本计划
`GuitarPerformanceIntent.profile / activity / releasing` 一对一对应。动画核心不复制
`CharacterStateUpdate`，也不处理 generation、revision、sequence 或瞬时 cue；真实接线留给合并
阶段的顶层表现消费者。

## Acceptance

- 相同 intent 与规划历史产生完全相同的乐谱；逐帧更新、帧率和随机源不改变规划结果；
- A 的 `gain` 随 `activity` 单调变化，低强度 A 不再反客为主，DRIVE 端保持现有力度；
- 强度只在乐句边界采纳，A 与 Motif 两侧没有位置跳变、突然缩放或中途变形；
- Motif 文件保持标准动作曲线，不保存前后 A 的 gain，也不读取状态机输入；
- Motif 只有在当前 Profile 不低于 `minimumProfile` 时才可出现；高强度可累计使用低强度候选，反向
  不允许。主动作和支撑动作确定性交替，Motif 不连续，同一动作遵守最小近期历史；
- 至少一条 A 建立句先于 Motif，Motif 后返回 A；只有声明资格的动作可从 A′ 进入；
- `releasing` 不打断当前句，并能在有限句数内离开高强度演奏；
- 规划策略全部位于规划器或其纯配置，播放器只执行 `plan`，状态机只提供意图；
- 八项动作主体和已通过的连贯性没有视觉回归。

## Risks / Dependencies

- 当前播放器直接持有部分预览序列、Profile 中点 energy 和旧自主随机逻辑；迁移必须分步进行，不能
  一次删除旧路径后再补规划行为；
- `activity` 是连续量但 Profile 是离散资格，两者职责必须分开：Profile 决定“哪些动作可用”，
  activity 决定“载体多强”，不得用一个字段替代另一个；
- 降低 A 的目标幅度不会造成位置瞬移，但可能改变边界速度；自动化只能保护位置连续，仍需 Windows
  dev 观察低强度和 DRIVE 两端；
- `homeProfile` 只控制主动作优先级，`minimumProfile` 才控制资格；两者不得重新合并成互斥分组。
  `single-pick-ack` 不能为了增加任一候选池的数量而重新进入生产目录；
- 若未来确需个别 Motif 的载体微调，应由规划器读取显式语义提示；第一版不增加 per-Motif gain，
  避免用手工补丁掩盖统一 activity 映射的问题。
