# Plan 026: MikuCat Angry Animation Engine

- Status: waiting-integration
- Summary: pending
- Branch: `feat/mikucat-v2-animation-engine`
- State contract: [Plan 020](../../feat-mikucat-state-machine/plans/plan-020-guitar-mode-animation-contract.md)
- Builds on: [Plan 021](plan-021-mikucat-v2-animation-engine.md)
- Follow-up: [Plan 027](plan-027-angry-effect-engine.md)

## Goal

为 MikuCat V2 增加独立的 ANGRY 动画机。动画机只消费状态机已经归约好的
`annoyed / impatient / furious` durable intensity，在现有生气表情之上编排头、身体、双耳、头发和
双手，
并在同一 ticker 中完成进入、升级、退出和参数归还。三档动作先分别隔离验收，再验证升级衔接；
真实 `CharacterStateUpdate` 与模型外特效仍留到后续 integration plan。

## Scope

- 冻结最小输入 `AngryAnimationIntent { intensity }`，与状态机
  `AngryWaitingSnapshot.intensity` 一对一对应；
- 复用现有 `expressions/angry.exp3.json` 作为脸部身份，动画机不得写 `Param9..13`；
- 第一版控制头部、身体、双耳、持葱右手绑定的 `ParamMouseX/Y`、普通左手 `Param25/26` 及九个
  头发次级运动参数，并在运行期间屏蔽实时鼠标输入；
- 不控制吉他双手 `Param21..24`、吉他或脚；`impatient / furious` 中持葱右手承担主动作，普通左手
  只做低幅、延迟的辅助摆动；
- 三档使用同一播放器和时间轴，通过可审计动作段表达不同语义，而不是复制三套循环；
- 提供仅开发态的 intensity 入口和快照，使状态机合并前可以逐档验收；
- 进入、升级和退出均保持位置/速度连续；当前档位自然完成安全动作段后再采纳下一档 durable intent；
- 复用一份与角色状态无关的头发次级运动实现，保持已冻结吉他动画行为不变。

不在本计划中：

- 不复制 `AngryWaitingMachine`，不计算 8 秒/25 秒 deadline，不生成 `anger-escalated` cue；
- 不接 `CharacterStateUpdate`，不处理 parent generation、revision 或 cue sequence；
- 不实现豆豆 `all-sessions-done` 完成动作；
- 不在第一轮加入烟雾、火花、气场或屏幕特效；动画通过后再与独立特效机联调；
- 不新增模型资源、生产依赖、声音、Rust/Tauri 行为或仓库外配置。

## Visual Semantics

- `annoyed`：克制的不耐烦。保持生气脸，以轻微前倾、偏头和不对称耳朵反馈维持生命感；允许短暂
  接近静止，不能只是普通待机换色，也不能提前表现为发抖；
- `impatient`：明确催促。先停稳，再以两次短促头身动作配合一轻一重的挥葱，动作之间有明确回弹；
  不能只把 annoyed 等比加速或放大；
- `furious`：受控爆发。五秒内安排“停稳—抬手蓄力—约 2.4 秒多方向持葱乱舞—最终重砸—回稳”；
  连续挥击必须具有不同方向、长短和重音，不能退化为等幅钟摆、全程高频抖动或依赖裁剪形成力度。
  未来模型外烟雾/火花只加强这一语义，不替代主体动画。

## Tasks

1. [x] 对照状态机分支冻结 `AngryWaitingSnapshot` 与 `anger-escalated` cue 语义，审计生气表情、V2
       参数、physics 和现有所有权；首轮排除手、脚、吉他和表情参数，后续以 moc3 网格差异确认
       `ParamMouseX/Y` 只直接变形持葱右手和葱；继续排除吉他手轴 `Param21..24`，普通左手
       `Param25/26` 则在持葱右手实机验收后按反馈开放为低幅辅助轨道。
2. [x] 以失败测试固定 `AngryAnimationIntent`、单 ticker、参数范围及 start/update/stop 生命周期；
       测试不得复制状态机 deadline。多档 latest-wins 与安全边界采纳统一留给任务 7。
3. [x] 把吉他专用命名的头发次级运动抽成 MikuCat 公共能力，以兼容导出保持吉他测试和视觉行为
       不变，再由 ANGRY 复用。
4. [x] 实现并隔离验收 `annoyed`。先固定克制姿态、轻微非对称运动、停稳区间和循环边界，再同步
       Windows dev 观察；通过前不实现后两档。
5. [x] 实现并隔离验收 `impatient`。必须增加一种可辨识的催促动作，而不是只改速度/幅度。
6. [x] 实现并隔离验收 `furious`。必须包含清楚的爆发、保持和收势，不得持续机械抖动。
7. [x] 验证 `annoyed → impatient → furious` 只在安全动作段边界升级，不重置 ticker、头发弹簧或
       当前姿态；退出和新 generation 重新进入时从明确的进入动作开始。
8. [x] 接入内置 MikuCat 的生气表达式生命周期和开发菜单；验证 default/guitar/angry 快速切换时
       参数所有权互斥，最终均能归还鼠标与 physics。实际状态机接线仍不在本计划中。
9. [x] 与 Plan 022 / Plan 027 复核并列消费者边界：durable intensity 驱动模型动画，
       `anger-escalated` cue 驱动一次性模型外强调；本计划不让两台引擎互相调用。
10. [ ] 运行定向测试、完整 utils、TypeScript、ESLint、Vite 构建和差异检查；增量同步 Windows
        镜像并完成三档、升级边界、退出及吉他回归验收。

## Progress

首个 Red-Green 增量已经完成。`AngryAnimation` 当时只接受 `annoyed`，以 4.6 秒闭合轨迹编排克制
前倾、缓慢侧看和不对称双耳；进入与退出使用携带位置和速度的 Hermite 过渡。它只写头、身体、
双耳和公共头发弹簧，测试明确排除 `Param9..13`、双手与吉他。`impatient / furious` 在各自动作尚未
设计前会被端口拒绝，避免用同一动作的简单倍速伪装升级。

内置 MikuCat 的 `angry.exp3.json` 已接入该首档动画，退出时用零权重释放完整所有权并恢复缓存的
鼠标目标；其他预设和导入模型不会启动。这个宿主接线目前只服务 `default → angry → default` 的
隔离视觉验收。`guitar ↔ angry` 的直接快速切换与开发态 intensity 菜单仍属于任务 8，尚不能据此
判定完整模式仲裁已经完成。

公共头发实现已改名为 `MikuCatHairMotion`，原 `GuitarHairMotion` 保留兼容导出；逐项比较确认只有
类型和命名变化，弹簧常量与积分算法未改。5 个相关测试文件、TypeScript、定向 ESLint 和差异检查
已经通过。Windows dev 首轮反馈认为动作幅度不可辨识；放大侧看、前倾、身体承力与耳朵行程后，
用户确认新版明显改善，`annoyed` 视觉基线据此冻结。

第二个 Red-Green 增量及视觉验收已经完成。`impatient` 使用独立 4.0 秒闭合时间轴：先停稳
约 0.75 秒，再执行两次分离的短促前探，第一次后明确回弹，第二次更重；身体在头部之后承接重量，
最后恢复停稳，避免全程机械发抖。视觉反馈指出静止手部削弱了状态差异，因此同一时间轴现加入
持葱右手所绑定的 `ParamMouseX/Y`：第一次小幅挥动、回收，第二次接近完整参数范围挥动并跟随收势。
此前先后尝试的 `Param23/24`、`ParamMouseRightDown` 与 `Param25/26` 均经实机或 moc3 检查排除：
前者属于吉他右手，右键参数不改变任何网格，后者只改变空着的普通左手。核心模型差异检查确认
`ParamMouseX/Y` 只改变 `dacong` 与相邻手部网格。持葱手首版实机幅度过大，现保持节拍和方向不变
并缩至约七成；普通左手 `Param25/26` 增加低幅延迟跟随，峰值不超过参数范围约四分之一。`annoyed` 的
持葱手始终保持中立，吉他双手与吉他仍不属于 ANGRY。它与 `annoyed` 共用播放器、所有权和头发
弹簧，不通过倍速或统一倍率生成。当时开发菜单以 `Angry intensity — next entry (dev)` 在下一次进入
生气表情前预设 `ANNOYED / IMPATIENT`，不会中途打断当前档位；Plan 028 完成安全升级后，该入口已改为
实时 `Angry intensity (dev)`，在循环闭合点采纳。Windows dev 最终确认持葱右手幅度合适、
普通左手的从属摆动自然，第二档据此冻结。

第三个 Red-Green 增量已完成代码，等待视觉验收。最初尝试的单次起跳在 Windows dev 中暴露模型
能力边界：身体 Y 与脚部参数只造成局部网格拉伸/折叠，无法表达整体离地，因此该方案被完整撤销，
ANGRY 不再获取或写入 `Param36..41`。当前 `furious` 改为 5.0 秒、25 个等距控制点的闭合时间轴：
先保持稳定怒姿并抬葱蓄力，随后在约 2.4 秒内完成多方向连续乱舞，以一次幅度最大的向下重砸结束，
最后让头身、左手和头发逐层回稳。相邻挥击采用不等幅轨迹与一次短换气，避免机械钟摆；身体始终
向下承力，不再模拟整体位移。开发菜单现暴露三档。四个定向测试文件、TypeScript、定向 ESLint
与差异检查通过。首轮乱舞实机确认主体效果成立，但最终重砸被前面的连续挥击淹没，普通左手也仍
过度逐击跟随；当前在重砸前增加一个短暂抬手保持、砸下后增加压住姿态，并把左手改为低频承力弧线。
Windows dev 复验确认修改后整体效果良好，`furious` 据此冻结。`annoyed / impatient / furious` 三档
隔离动画资产现已全部完成；后续不再调动作曲线，下一阶段转入模型外特效边界与强度升级衔接。

Plan 028 随后补齐播放中的安全升级：durable intensity 在当前循环闭合点采纳，以 420ms Hermite
过渡到最新目标；过渡保持原 ticker 和头发弹簧，允许 latest-wins 重定向，退出可以立即抢占。
同一计划进一步把 default / guitar / angry 收敛到一个 latest-wins 宿主入口，旧引擎释放共享参数后
自动启动 pending target。Windows dev 已确认直接跨模式切换动作连贯、鼠标与 physics 可正常归还，
任务 8 据此完成；真实 `CharacterStateUpdate` 接线仍保留给合并阶段。
定向测试与 Windows dev 均确认 `annoyed → impatient → furious` 连贯，任务 7 至此完成。

## Acceptance

- 选择生气表情后只有一个 ANGRY ticker，重复设置同一 intensity 不重启动画；
- 三档在静态截图和运动节奏上均可辨识，但保持同一角色与同一动作体系；
- intensity 更新不在帧中途跳姿态，升级不会重置到零或造成头发反弹；
- 生气脸由 expression 持有，动画只写声明过的姿态通道；表情切换不会留下 `Param9..13` 外部覆盖；
- 头、身体、耳朵、持葱手和头发有清楚的主从关系，近静止时仍有微弱余动，高强度时不触及参数
  裁剪边界；
- ANGRY 不写吉他双手、吉他或脚；普通左手只允许作为持葱主动作的低幅从属轨道，不创建第二个
  参数写入者；
- 退出、切换模型和组件卸载后全部覆盖释放，鼠标与 physics 恢复；
- 已冻结吉他动作、规划器、特效 POC 和其他模型行为无回归。

## Risks / Dependencies

- 外部头部覆盖发生在 physics 之后，模型自带头发、耳朵和脚部 physics 看不到同帧 ANGRY 头部值；
  第一版显式控制耳朵并复用公共头发次级运动，脚部始终归模型 physics；
- 状态机只会单向升级强度，但开发菜单允许任意切换用于隔离观察。生产语义不得因调试入口而增加
  降级规则；
- 生气 expression 的 300ms fade 与动画进入段同时发生，若视觉互相抢拍，应调整动画进入包络，不
  修改素材表情值；
- guitar 与 angry 会竞争头、身体、耳朵、头发和鼠标通道；ANGRY 将 `ParamMouseX/Y` 解释为
  持葱右手动作轴，并另取普通左手 `Param25/26`，但继续排除吉他手轴与点击输入。最终必须由同一内部动画
  仲裁器串行交还，
  不能依靠 acquire 失败后静默丢失新状态；
- 自动化只能保护所有权、连续性和边界，三档是否真正表达不耐烦仍依赖 Windows dev 视觉验收。
