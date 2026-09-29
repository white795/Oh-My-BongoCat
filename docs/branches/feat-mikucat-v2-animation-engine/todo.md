# Project Todo — feat/mikucat-v2-animation-engine

## Current Focus

当前位于 `feat/mikucat-v2-animation-engine`，负责 MikuCat V2 运行素材、动画机及独立模型外特效机。V2 的
`moc3 / physics3 / cdi3` 已进入内置运行目录，源目录已忽略并补齐本地专有许可证；现有中文表情
身份、默认脸吉他表情、纹理、封面和打包许可证保持不变。运行资源测试确认 49 个参数及 14 个
独立动画轴均存在。

吉他动画阶段已经完成：旧四通道播放器已迁移为单 ticker 多通道动画机，A/A′、两类 Cadence、
八项 Motif、头发次级运动、确定性规划器和 releasing 收束均通过自动化与 Windows dev 视觉验收。
参数所有权以原子方式获取，退出时用 `weight = 0` 释放 14 个主动画参数、9 个头发次级运动参数和
4 个鼠标控制参数，再恢复缓存的最新鼠标目标。

本分支以旧 [Plan 018](../feat-mikucat-state-machine/plans/plan-018-mikucat-guitar-performance.md)
的四通道吉他动画作为行为基线，并遵守
[Plan 020](../feat-mikucat-state-machine/plans/plan-020-guitar-mode-animation-contract.md)
定义的消费者边界。角色状态归约和键盘交互状态机仍归 `feat/mikucat-state-machine`；动画与模型外
特效均归本分支。吉他动画机已经冻结 `GuitarPerformanceIntent` durable 端口，但不复制状态机
`CharacterStateUpdate`；真实生命周期、generation/sequence 与 cue 接线留给最终 integration plan。
下一阶段转入 ANGRY 动画和豆豆完成过渡，Plan 022 特效核心继续等待联合接线。

## Active Plan

- [Plan 022](plans/plan-022-guitar-effect-engine.md)（waiting-integration；特效核心已完成，停止独立扩展，
  等 ANGRY、豆豆完成动作和顶层表现消费者具备后统一接状态总线）

当前没有活动中的吉他动画计划。下一步先为 ANGRY 三档动画建立新计划；豆豆
`all-sessions-done` 一次性完成动作单独编排，二者均不提前复制状态机逻辑。

最近完成：

- [Plan 021](plans/plan-021-mikucat-v2-animation-engine.md) / [Summary 021](summaries/summary-021-mikucat-v2-animation-engine.md)：
  完成 MikuCat V2 多通道吉他动画、动作库、上下文连续性、生命周期与稳定 durable 端口；
- [Plan 025](plans/plan-025-guitar-performance-planner.md) / [Summary 025](summaries/summary-025-guitar-performance-planner.md)：
  完成载体强度、累计动作资格、确定性调度和 releasing 收束；
- [Plan 023](plans/plan-023-guitar-motif-batch.md) / [Summary 023](summaries/summary-023-guitar-motif-batch.md)：
  最终冻结八项动作，`single-pick-ack` 降为不进入目录与规划器的实验模块；
- [Plan 024](plans/plan-024-guitar-motion-families.md) / [Summary 024](summaries/summary-024-guitar-motion-families.md)：
  冻结最后新增的 `sustain-sway`，其余动作提案全部延期。

## Execution Order

1. 吉他动画核心保持冻结，只接受缺陷修复，不再增加动作或扩张第一版规划器语义。
2. 新建 ANGRY 动画计划，按状态机已经冻结的 `annoyed / impatient / furious` 语义独立设计和验收。
3. 单独编排 `all-sessions-done` 豆豆完成动作，验证进入、退出以及被新一代 WORKING/WAITING 抢占。
4. 动画与特效能力稳定后，在目标分支新建 integration plan，由单一顶层消费者接入
   `CharacterStateUpdate` 并完成联合 Windows dev 验收。

## Progress Record

历史推进记录：Plan 021 的任务 6 完成后进入任务 7 / Plan 025。任务 5 已停止扩充随机动作池并冻结八项动作；第一条有明确职责的基础句 A 已通过验收。新增的四拍
`steady-groove` 在单一时间轴上按“按弦准备 → 拨弦 → 琴体 → 身体 → 头 → 耳朵”传递力量；
`ENGAGED / GROOVE / DRIVE` 都确定性重复 A，不抽取 Motif、不改变随机 home，也不在句边界随机调节
BPM / energy。三个 Profile 仍使用各自固定的速度、能量和 DRIVE 身体增益，`AUTONOMOUS` 暂时保留
旧随机行为作为对照。

Plan 025 第一增量已完成：规划器对模板乐句和开发态预览统一输出身份、角色、Profile、gain、插槽及
选择原因。A/A′/Cadence 的载体 gain 由 activity 经 `0.60 + 0.40 × smoothstep(activity)` 单调生成，
七条演奏通道统一消费；Motif 保持 `gain = 1`，冻结曲线未改。activity 在当前句中变化不会修改已经
生成的轨迹，只在下一乐句边界采纳。定向测试、TypeScript、ESLint 与差异检查通过，下一步同步到
Windows dev，只观察低、中、高三档的层级与边界速度；视觉通过前不开始自动 Motif 调度。

Windows dev 已确认第一增量的三档强度和边界均正常。第二增量现已实现：动作资格拆为
`homeProfile / minimumProfile`，AUTONOMOUS 可使用五项通用动作，GROOVE 新增切分和弦资格，DRIVE
累计拥有全部八项；两个 DRIVE 动作不会出现在更低状态。规划器按四句块交替选择当前强度主动作与
累计支撑动作，普通块为 `A → A → Motif → A`，点头块为 `A → A → A′ → Motif`，选择原因写入快照。
Profile 在待播动作开始前下降时会取消旧队列并从新状态 A 重新建立。自动化和静态检查已经通过，
Windows dev 已确认四档自动编排没有明显问题。

第三增量现已实现 releasing 收束。第一次在乐句边界采纳释放意图时，规划器会撤销尚未开始的 Motif
和剩余普通块，播放一次 SoftCadence；持续释放时只保持 A，并按最新 activity 调整载体 gain。释放期
Profile 降级不会重复播放 Cadence，已经开始的 Motif 不会中途打断；ACTIVE 恢复后从 establish A
重新建立。开发菜单新增 `Guitar release (dev) → ACTIVE / RELEASING (LOW ACTIVITY)`，释放项以不高于
`0.15` 的 activity 模拟输入衰减，ACTIVE 恢复当前 Profile 的默认测试强度。Red-Green 行为测试、
13 个相关测试文件、TypeScript、ESLint 与差异检查通过；三类释放边界随后已由 Windows dev 验收。

Windows dev 已分别确认 `engaged / groove / drive` 重复两到四句后节奏稳定且可预期、各通道像同
一次发力，并且 A/A 句边界没有卡顿。确定性的 `A → A → A′ → A` 也已通过验收：第三句后半段能
观察到一次更短、更快的变化，A/A′ 与 A′/A 均无断裂感。第四句 Fill 现已实现，四句改为
`A → A → A′ → Fill`：Fill 只落一次明确重音，随后停稳并以 pickup 回到下一轮 A。首轮录像确认
乐句边界连续，但 Fill 内部身体、琴体和按弦手的横向反转叠加为一次明显的左右拉扯；本轮已保留
纵向重拍、停稳和 pickup，只把身体归一化 X 行程从 `1.03` 压到 `0.52`，同步减小琴体横移并让
按弦手在重拍前单向准备。第二轮录像确认整体改善但仍有一次短促来回，进一步定位为身体和琴体在
重音前相位相反：身体仍先折返，琴体则与身体向相反方向到达重音。现已让身体单向进入，琴体只保留
一次短暂入场惯性后跟随身体。第三轮录像确认动作进一步自然，但重音后仍出现“减速后卡一下”；
录像低运动区与 Fill 内部全部核心通道 `0.65 → 0.80` 的约 300～390ms 零速停稳吻合，并非 A 从零速
启动。现已把核心停稳压到约 120～180ms、拨弦手完全休止缩到四分之一拍，让双耳持续微弱余韵并
提前各通道 pickup。Windows dev 随后在 DRIVE 与 ENGAGED 两个端点确认：重音后的停顿能读作短促
标点，慢速下身体和双耳仍保留轻微余韵，收束与 `Fill → A` 均自然。由相同轨迹和端点参数包围的
GROOVE 不再增加重复调参；`A → A → A′ → Fill` 至此冻结为输入态基础演奏。

模板、插槽和序列游标已从 `GuitarHandAnimation` 抽成独立 `GuitarPerformancePlanner`：当前模板
显式标记 `establish / repeat / variation / accent-cadence` 四个插槽，规划结果携带模板 ID、迭代、
插槽和角色供快照审计；Profile 切换仍从 establish 重置，现有四句顺序和零随机行为逐项不变。

当前 Fill 已明确为 `AccentCadence`；新的四拍 `SoftCadence` 不含 accent，并与 A 共用所有通道的
入口、出口和 pickup。首轮 Windows 观察确认两条结尾均流畅：`AccentCadence` 已能读作“重音结尾后
短暂休息”，但 `SoftCadence` 仍像“较轻重音后继续演奏”，柔和收句语义不足。第二版已把开头 down
改为三次强度递减的轻触，随后留出 1.5 拍 settle/rest 换气；头、身体、琴体和耳朵改为更小的连续
释放弧线，最后仍以共享 pickup 返回 A，避免以跳变换取停顿。规划器现可分别展开
`CONTINUE / SOFT_CLOSE / ACCENT_CLOSE` 三份确定模板，开发态模板 override 只在下一乐句边界采纳，
不会打断当前姿态。生产 Profile 默认仍走已经验收的 `ACCENT_CLOSE`，因此本轮尚未引入自动模板
选择。第二版已由 Windows 录像确认形成“渐弱—换气—继续”，中段仍有身体和耳朵余韵，pickup
回到 A 没有速度突变；`SoftCadence` 与 `AccentCadence` 至此冻结。

首个 Motif 采用参考动作的上下点头而非左右摇摆，调试 ID 暂为 `immersed-double-nod`。四拍独立
动作资产已经通过 Windows dev 视觉验收。多轮实机反馈依次排除了“两拍动作 + 空余
中立拍”、只有两次落点和“重—重—轻—重”方案。当前版本改为“轻—轻—重—轻”，头部下压为
`-0.76 / -0.74 / -0.92 / -0.78`，轻拍只比已验收的重拍轻一档；身体对应
`-0.31 / -0.30 / -0.40 / -0.32`，双耳按同一重量层级延迟回弹。拨弦手改为 Motif 自有的
`down → up → accent → up` 四拍谱，按弦手在第三拍前完成最大换把和按压；只有吉他本体暂时继续复用
A 的惯性轨迹。第四拍后的额外过冲关键帧仍保持删除，零位置边界继续携带同向速度。开发态预览现按
`A → A → A′ → Motif` 固定循环：前三句使用已冻结的正常演奏，第四句才应用 Motif，下一轮从 A
恢复，用于同时观察 `A′ → Motif` 入场和 `Motif → A` 退场。该路径仍不进入生产模板或规划器选择，
也不自动随机投放。Windows dev 已确认两个边界均流畅，证明“独立动作资产 → 确定上下文编排 →
规划器管理”的扩展路径可行。下一步不再反复调这一动作；现有未冻结动作继续沿用相同验收流程，
完成后立即为规划器增加带频率、合法前后继和 Profile 分级的受控插槽，禁止新增动作继续推迟集成，
也禁止退回全随机动作池。
activity / releasing 连续混合和 cue 响应仍不在这一阶段。

第二个 Motif `fretboard-slide-accent` 已重编为“身体左倾 → 双手快速 riff → 向右重扫 → 1.25 拍
缓慢归位”。中段三次短 `double` 与按弦手多次快速换位共享节奏窗口；该 Motif 单独采用 `-40°`
琴颈轴，其他已验收动作的 `40°` 映射不变。最后一次重扫已提高到 `accent 1.12`，身体同步到
`x = 0.50 / y = -0.48`，用户确认可在此版本上进入结构拆分。开发态仍只循环自身，不播放 A/A′，
也不进入生产规划器；后续按默认契约验证 `A → Motif → A`，A′ 只作为少数明确需要变奏铺垫动作的
入口。

两个现有 Motif 已从单文件拆为 `src/utils/guitarMotifs/` 下的独立动作模块与独立数据测试；每个模块
自带 ID、显示名和所属 Profile，现有两个均归 `DRIVE`，该 Profile 目前只作资格元数据。公共类型
集中在 `types.ts`，动作及其开发预览乐谱只由 `registry.ts` 汇总，根级 `guitarMotifs.ts` 保持旧导入
兼容。下一批六个动作可以按 `AUTONOMOUS / ENGAGED / GROOVE` 三组并行开发，每组只创建自己的动作
和测试文件，不修改注册表、菜单、播放器或其他组文件；全部独立测试通过后再由主线统一注册并进行
一次 Windows dev 批量验收。当前拆分不改变任何动作参数、预览顺序或生产规划器行为。

Plan 023 的首批六动作已并行完成：`AUTONOMOUS` 包含 `tuning-listen / lazy-arpeggio`，`ENGAGED`
包含 `single-pick-ack / two-note-answer`，`GROOVE` 包含 `syncopated-chord-walk /
call-response-sway`。六个动作均为四拍独立模块并带数据测试，主线已统一登记隔离预览；开发菜单按
`AUTONOMOUS → ENGAGED → GROOVE → DRIVE` 从注册表生成。播放器回归已逐个跨越六个动作的完整循环，
22 个 utils 测试文件、TypeScript、定向 ESLint 和差异检查通过。21 个批次相关文件已同步到 Windows
镜像并逐项一致；下一步由用户一次性验收六个候选。首轮观察前不逐个微调，也不接生产规划器。

首次批量观察已经完成：六个候选都很流畅，但连续观看时近似同一个四拍平滑动作，说明连贯性通过而
动作辨识度未通过。后续不再同时调整六项，改为逐个固定“主角动作”。第一项 `call-response-sway`
已重做为四拍“左侧点头两次 → 右侧点头两次”：每拍一次轻量点头，双手持续演奏，身体只做较小的
左右承力，没有 `double / accent` 或 DRIVE 式重压。定向行为、注册表、播放器、TypeScript、ESLint
和差异检查通过。首次单项观察发现第四拍末端与下一轮第一拍准备位之间出现一次头部弹跳；现已用
跨循环行为测试复现，并把末端、边界和起拍改为同一条持续抬升、向左移动的恢复曲线，避免先下沉再
弹起，也不在边界硬停。Windows dev 已确认循环流畅，`call-response-sway` 通过并冻结。

第二项 `syncopated-chord-walk` 已按“三个和弦台阶”重做：第一和弦 `down → up`，两个半拍空拍分别
承载向第二、第三和弦的抬手换位，第二和弦单次下拨，第三和弦执行 `double`，末尾半拍单向返回。
按弦手在每个位置明确落下并保持，身体只延迟承接左—中—右重心，头部保持安静；跨循环测试固定
身体不能在返回第一和弦前折返。定向动作、注册表、播放器测试、TypeScript、ESLint 和差异检查通过；
局部低头从不可辨识放大后被观察为一次点头，因此已改成跨越三个和弦的持续查看：第一和弦开始
缓慢下降，第二和弦进入低位，第三和弦期间保持，再在第三和弦后半逐步抬起。行为测试限制下降和
回收单调、低位持续时间及最大纵向速度。下一步只在 Windows dev 选择
`GROOVE / SYNCOPATED CHORD WALK` 复验它是否读作低头确认位置而非点头。最新反馈认为慢弧线幅度仍小，
最低位已从 `-0.44` 加深到 `-0.62`，时序和速度上限保持不变；Windows dev 随后确认动作通过并冻结。

第三项 `two-note-answer` 已放弃原有“小幅换和弦 + 四次轻拨”方案，避免与
`syncopated-chord-walk` 重复。新版只在同一个琴位做两次按下—松开，第二次按压与拨弦更重；全句
只有两次 `pick`，随后头部和双耳统一抬起确认，再用较长 `settle` 返回。定向测试固定按弦手无横向
行进、两次按压保持、第二次更深、抬头发生在第二音之后，以及自身循环边界无头部反弹；TypeScript、
ESLint 和差异检查通过。Windows dev 随后确认新版语义可辨识且循环自然，动作通过并冻结。

Plan 024 已完成：`sustain-sway` 复用四拍 Motif 契约，第一拍只执行一次下拨，随后两拍保持同一
和弦和持续音，头身双耳通过一次缓慢换重心维持生命感，第四拍连续回收。动作数据、注册表及播放器
循环边界测试通过，Windows dev 隔离观察确认可以进入下一动作；该动作已经冻结，仍不进入生产
规划器。此前讨论的其他动作全部延期，不再阻塞当前集成路线。

Plan 023 的下一项 `tuning-listen` 已重编为“第一次轻拨 → 持续侧耳静听 → 按弦手松开并微调 →
第二次确认轻拨 → 放松”。身体行程被压低，头部和单耳形成主剪影，按弦手沿修正后的琴颈轴完成一次
小于换和弦的清楚调整。动作测试先以旧实现失败，改写后动作数据与播放器运行时层级测试通过；等待
Windows dev 单项视觉验收。实机随后确认动作可辨识且自然，`tuning-listen` 已通过并冻结。

最后一个待优化动作 `lazy-arpeggio` 已改成四次彼此分隔的轻拨，每个音后保留半拍余响；身体只向
同一侧完成一次缓慢下沉—回收弧线，头部持续低头看弦，按弦手在入场抓住同一和弦后只改变压力而
不换位，双耳保持次级余动。数据测试先以旧实现失败；改写后固定四次 `pick / rest`、单侧身体轨迹、
持续低头和弦位置不变，播放器测试另排除入场抓弦后确认运行阶段按弦手没有横向行进。Windows dev
确认最终效果通过；Plan 023 因而以八项动作正式冻结。`single-pick-ack` 不再进入本轮优化或最终
规划器候选。

连贯性阶段已经建立第一版统一验收乐谱：除 `immersed-double-nod` 外的七项冻结动作均循环
`A → Motif`，下一轮自然形成 `Motif → A`；点头动作保留已验收的 A′ 特殊铺垫。注册表测试固定最终
八项目录并排除 `single-pick-ack`，播放器测试逐项跨越两个边界，确认头、身体、双手、吉他和双耳
七条轨道没有瞬时位置重置。当前只证明数据连续，尚未证明速度与意图在视觉上自然；下一步由
Windows dev 逐项观察，失败项按边界单独修复。

Windows dev 随后确认八项上下文整体流畅，没有发现跳变、卡顿、反向抽动或异常停顿，连贯性阶段
正式结束。低强度 Motif 前后的 A 幅度偏强被归类为编排层级问题，而不是边界连续性失败；该问题移交
Plan 025。新计划约束：状态机只提供 `profile / activity / releasing`，规划器决定乐句、Motif 与
`gain`，播放器在乐句边界执行，动作资产保持标准曲线。第一增量先实现 activity 驱动的 A 载体强度，
视觉通过后再进入 Motif 资格、前后继、冷却、历史和释放规则。

头发静止问题已定位并完成首版实现：模型自带 physics 的映射完整，但动画头部覆盖发生在 physics
之后，因此物理层看不到吉他态头部运动。新增统一次级运动层临时接管鬓发、刘海、双马尾和双发带
共 9 个参数，以最终头部位置/速度生成分组阻尼和回弹，不修改任何乐句或 Motif。自动化确认全部
参数有响应、左右不刚性同步、停手后继续余动并衰减、30/60 FPS 结果接近，退出时覆盖完整释放；
下一步只需在 Windows dev 观察方向、幅度与回弹速度，按视觉反馈调参。

动画分支使用独立 Windows 验收镜像
`D:\VibeTool\BongoCat-animation`；镜像不含 `.git`、设计源目录和缓存副本，`node_modules` 与
`target` 通过目录联接复用 `D:\VibeTool\BongoCat` 的现有缓存。原状态机验收仓库源码未被覆盖。
管理员 PowerShell 重建可信目录联接并为当前会话关闭 pnpm 11 的运行前依赖自动修复后，Windows
dev 已成功启动。两个工作副本不得同时使用共享 `target` 编译或运行 dev。

Plan 022 已建立 `GuitarEffectEngine`：它直接接收与状态机兼容的 `press / accent / input-rest` cue，
负责 generation/sequence 淘汰、十三种符号、十组配色、七类轨迹、节流、容量、TTL 与回收，不保存
输入时间或判断静默。旧 `GuitarNoteEffect` 已收缩为维持现有页面预览的 POC 适配器；正式总线接入时
必须整体删除该适配器以及页面休止计时器。特效机保持独立推进，不改变上述动画机下一动作。

两轮满幅探针已确认：V2 素材按角色自身的解剖学方向命名，`Param21 / Param22`（解剖学左手）是
拨弦手，`Param23 / Param24`（解剖学右手）是按弦手。临时探针已删除；动画数据和快照改用
`strummingHand / frettingHand` 演奏角色，正式自主乐句已恢复。下一步在 Windows dev 观察角色
修正后的实际拨弦幅度、方向与按弦手配合，再进入 Base / Gesture 混合层。

Windows dev 的临时调试入口仅在开发构建存在。无需 DevTools 时，先关闭鼠标穿透，再右键主猫，
通过 `Guitar profile (dev)` 选择速度/强度，通过 `Guitar template (dev)` 选择 `CONTINUE / SOFT CLOSE /
ACCENT CLOSE`，`PROFILE DEFAULT` 会清除强制模板。`Guitar motif insertion (dev)` 可选择
具体 Motif 或 `AUTO (PLANNER)`；强制预览会在乐句边界进入/退出并使用动作自己的固定上下文，选择
`AUTO (PLANNER)` 后则在下一乐句边界返回当前 Profile 的自动规划器。点头动作的预览固定循环
`A → A → A′ → Motif`。也可以在
DevTools Console 执行：

```js
__BONGO_CAT_GUITAR_DEBUG__.set('autonomous')
__BONGO_CAT_GUITAR_DEBUG__.set('engaged')
__BONGO_CAT_GUITAR_DEBUG__.set('groove')
__BONGO_CAT_GUITAR_DEBUG__.set('drive')
__BONGO_CAT_GUITAR_DEBUG__.set('drive', 0.55, true) // 请求释放
__BONGO_CAT_GUITAR_DEBUG__.set('drive', 0.8, false) // 恢复 ACTIVE
__BONGO_CAT_GUITAR_DEBUG__.setTemplate('input-continue-baseline')
__BONGO_CAT_GUITAR_DEBUG__.setTemplate('input-soft-close-baseline')
__BONGO_CAT_GUITAR_DEBUG__.setTemplate('input-accent-close-baseline')
__BONGO_CAT_GUITAR_DEBUG__.setTemplate() // 恢复 Profile 默认模板
__BONGO_CAT_GUITAR_DEBUG__.previewMotif('immersed-double-nod')
__BONGO_CAT_GUITAR_DEBUG__.previewMotif() // 在下一乐句边界退出预览并返回自动规划器
__BONGO_CAT_GUITAR_DEBUG__.snapshot()
```

Profile 和模板切换都发生在当前乐句结束时；`snapshot()` 中 `requestedIntent.profile` 或
`templateOverride` 会先变化，`profile` / `plan.templateId` 在真正采纳后变化。这是分离动作验收
工具，不是临时状态机。

首轮观察还发现拨弦手沿屏幕横向移动，与约 40° 倾斜的琴弦不匹配。拨弦片段现保留局部动作数据与
总行程，通过 -50° 旋转映射为跨琴弦的斜向轨迹；用户已在 Windows dev 确认拨弦方向和幅度正常。
随后观察到按弦手幅度过小、连续头部关键帧逐点刹停，以及身体/脚部律动不明显。本轮已放大按弦手与
身体通道，连续关键帧改为携带相邻轨迹切线，同时保留重复姿态所表达的有意停顿；`rolling-strum`
的大转角结尾也改为回收姿态。第二轮调参继续把按弦手主轴旋转到约 40° 琴颈方向，将按弦手行程
提高到约 15.4，并把 `GROOVE` 身体行程提高到约 37.7；`DRIVE` 另有 1.28 倍身体增益，实测行程约
49.3，不再只是节奏更快。各参数轴仍处于 ±30 范围内。自动化检查通过，等待下一轮 Windows dev
视觉验收角度、幅度和 `DRIVE` 的夸张程度。

用户录像进一步确认两个层级缺口：头部与身体虽共享乐句总时长，却由两组绝对轨迹直接输出；吉他与
双手也各自写绝对参数，导致琴身摆动时握点在琴颈上漂移。动画机现增加运行时组合层：最终头部为
`head gesture + body base`，最终双手为各自 `hand gesture + guitar base`，并在写入前统一裁剪到参数
范围。调试快照同时保留局部 Gesture 与最终姿态，便于继续视觉调参。26 项吉他目标测试、全部 10 个
utils 测试文件、TypeScript、定向 ESLint 和差异检查通过，等待 Windows dev 验收接触点和整体协调性。

输入态首个阶段性特色动作曾根据视觉反馈重编排为跨两句的“左二、右二”点头，并增加概率与冷却
约束；进一步验收确认问题不只是这个动作的速度，而是所有普通乐句仍由随机选择串联，缺少建立、
重复、变化与收束。该动作数据和调度能力暂时保留为未来 Fill 候选，但输入 Profile 的抽取概率现为
零；它不会干扰 A 的首次验收。

V2.1 最新运行导出已完成反向审计并采用：只同步 `moc3 / cdi3 / physics3`，保留规范化运行目录中的
`model3`、中文表情名称、无空格 `angry` 引用、许可证和相同纹理。额外变化限定在左右脚网格与腿部
物理，耳朵、眨眼、头身、双手和吉他参数契约均未改变。4 项素材检查通过；临时未跟踪目录
`mikucat-lived2d-v2.1/` 已由用户清理，WSL 与 Windows 验收副本均无残留，内置运行资源不受影响。

素材 v2.1 的差异已完成选择性合并：设计源 v2 与运行资源现在都让左右耳 physics 消费头部角度而非
眼睛开闭，`EyeBlink` 只包含双眼；设计源的 `angry` 文件名、Name 和引用也已去除尾随空格。审计发现
同批导出还改变了脚部 physics、删除 CDI 右脚分组并重导出不透明 `moc/cmo`，这些未声明差异均未
合入。新增资源测试固定耳朵输入/输出和 26 项输入元数据，等待 Windows dev 验收默认态眨眼、双耳
跟头以及吉他态耳朵动画能否和平共存。

## Cross-branch Dependencies

- 最终顶层表现消费者须接受 Plan 020 的持续快照和瞬时提示，但不解释原始按键、deadline 或多
  Session；吉他动画核心只消费 durable intent，瞬时提示由特效机优先消费；
- 状态机分支止于状态输出，不再修改动画或特效；本分支分别实现两个并列表现消费者；
- 状态机分支与本分支先固定字段含义，实际页面扇出和最终接线留给 integration plan；
- 两个分支可能同时修改 `live2d.ts`、主窗口或输入接线，最终合并必须在目标分支单独建立
  integration plan，不能整文件覆盖任一侧。

## Verification Baseline

最终 23 个 utils 测试文件（含 `src/utils/guitarMotifs/*.test.ts`）、TypeScript、定向 ESLint、
`git diff --check` 和 Vite
生产构建通过；构建只有既有动态导入与大 chunk 警告。本轮 Profile 测试先因消费端口不存在按预期
失败，最小实现后全部通过；首次用 `pnpm exec` 调用 TypeScript / ESLint 时 Corepack 尝试联网失败，
随后直接使用现有 `node_modules/.bin` 完成验证，不涉及依赖缺失或源码故障。此前首次 Vite 尝试因
复用的依赖目录只读而失败，在获准写入其临时配置缓存后成功完成，不是源码故障。Windows 独立验收
镜像已同步并复用原缓存，此前 6 个源码/测试文件连同拨弦旋转与右键 Profile 菜单均已增量同步并
核对 SHA-256。dev 启动链此前已通过。本轮按弦手、身体和头部连续性修改通过全部 10 个 utils 测试
文件、TypeScript、定向 ESLint 与 `git diff --check`；尚未完成四种 Profile 动作观感和其他模型
回归验收，自动化结果不能替代 Live2D 视觉验收。

基础句 A 的测试先因 `GUITAR_ESTABLISH_PHRASE_ID` 不存在按预期失败；实现后 30 项吉他目标测试
通过，覆盖四拍因果顺序、三个输入 Profile 的零随机确定性重复、Motif 禁用、固定调音、七条局部
轨道在 A/A 边界的位置连续，以及拨弦与头部速度不归零。TypeScript、三文件定向 ESLint 与差异
检查通过；当前共享工作树的全量 11 个 utils 测试也通过。Windows dev 随后确认 A 连续重复时稳定、
可预期且无句边界卡顿，基础句视觉基线通过。

A′ 与四句结构的测试先因新导出不存在按预期失败；实现后 32 项吉他目标测试通过，覆盖 A′ 的后半句
变化、通道因果、与 A 共用的入口/出口、三个输入 Profile 的 `A → A → A′ → A` 零随机循环，以及
A/A′ 双向边界不重置。当前共享工作树的全量 11 个 utils 测试、TypeScript、三文件定向 ESLint 和
差异检查均通过。Windows dev 随后确认 A′ 表现为一次可辨识的更短、更快变化，双向衔接均无断裂感，
第二次语法实验通过。

Fill 与四句收束的测试先因新导出不存在按预期失败；实现后 33 项吉他目标测试通过，覆盖单次重音、
显式停稳、末尾 pickup、三个输入 Profile 的 `A → A → A′ → Fill` 零随机循环，以及
`A′ → Fill → A` 不重置任何局部轨道。当前共享工作树的全量 11 个 utils 测试、TypeScript、三文件
定向 ESLint 和差异检查均通过。首轮 Windows 录像显示的左右拉扯被定位为 Fill 内部横向轨迹，而非
乐句边界：身体归一化 X 行程 `1.03` 又被 DRIVE 的 `1.28` 增益及 body→head / guitar→hands 组合层
放大。新增约束测试首次按预期失败；压缩身体与琴体 X 行程、把重拍前按弦准备改为单向后，33 项
吉他目标测试、全量 11 个 utils 测试、TypeScript、定向 ESLint 和差异检查重新通过，等待 Windows
dev 视觉复验。第二轮录像仍能辨识一次短促来回；新增“身体单向蓄力、琴体只滞后一次且最终与身体
同向”约束后，测试先因现有反相轨迹按预期失败，修改横向关键帧后 33 项吉他目标测试通过。第三轮
录像暴露的约 300ms 假卡顿进一步定位为 Fill 内部重复姿态与 `rest` 同期锁死，而不是 A 边界；新增
停稳跨度、四分之一拍休止和双耳余韵约束后，测试先按预期失败，缩短并错开停稳后 33 项目标测试
恢复通过。DRIVE 与 ENGAGED 的最终 Windows 视觉复验均通过，输入态四句基础演奏正式冻结。

规划器测试先因模块不存在按预期失败；实现后 2 项纯规划测试和原 33 项吉他动画测试通过，确认
固定模板连续展开、审计元数据、重置行为、三个输入 Profile 的原序列及 Profile 边界均不回归。
当前全量 12 个 utils 测试文件、TypeScript、五文件定向 ESLint 与差异检查通过。

Plan 022 的特效测试先因新模块不存在按预期失败，TTL 用例也先因生命周期接口缺失失败。实现后
新特效机 6 项行为、旧 POC 5 项回归、全量 11 个 utils 测试文件、TypeScript、定向 ESLint、Vite
生产构建及 `git diff --check` 均通过；构建只有既有动态导入与大 chunk 警告。首次 Vite 调用因共享
`node_modules` 只读而不能写临时配置，获准写入现有缓存后成功。未同步 Windows，也未进行总线或
联合视觉验收。

基础视觉池随后增加手绘升半音与降半音组合符号，旧 POC 无需增加输入语义即可通过现有随机路径
触发。两项测试先因缺少 `sharp / flat` 按预期失败；实现后特效目标测试、全量 12 个 utils 测试、
TypeScript、定向 ESLint 与差异检查通过，等待 Windows dev 观察字形、尺寸和出现频率。

Plan 025 的 releasing 路径已完成 Windows dev 验收：当前乐句、待播 Motif 取消、一次
SoftCadence、保持 A 与 ACTIVE 恢复均没有观察到断裂。吉他动画阶段因此正式关闭。收尾时又与
状态机分支复核唯一输出契约：`GuitarInteractionSnapshot.interaction / activity / releasing` 在合并
时一对一映射为 `GuitarPerformanceIntent.profile / activity / releasing`；动画核心不复制
`CharacterStateUpdate`，不处理 generation/revision/sequence，也不把瞬时 cue 纳入已冻结的第一版
规划器。Plan 021 与 Plan 025 已生成 Summary；全部 23 个 utils 测试文件、TypeScript、吉他相关
ESLint、差异检查与 Vite 生产构建通过。真实总线接线留给后续 integration plan。

## Known Boundaries

- V2.1 原始 `model3` 带临时路径和 `angry ` 尾随空格，只能采用经过规范化的运行目录版本；
- v2.1 默认态耳朵 physics 新增 `Param6 / Param7` 输出，而吉他动画仍显式控制 `Param16 / Param19`；
  两层设计上可并存，但必须在 Windows dev 中确认不会产生过度叠加；
- 退出动画必须真正释放外部参数覆盖，不能用写零代替；
- `ANGRY` 和豆豆 `all-sessions-done` 一次性动画不属于已完成的 Plan 021；Plan 022 只抽取模型外
  特效核心，最终总线接线仍等待后续表现能力稳定后统一实施。
