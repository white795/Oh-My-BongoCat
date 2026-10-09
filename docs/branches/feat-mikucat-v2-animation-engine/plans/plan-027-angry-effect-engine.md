# Plan 027: MikuCat Angry Effect Engine

- Status: complete
- Summary: [Summary 027](../summaries/summary-027-angry-effect-engine.md)
- Branch: `feat/mikucat-v2-animation-engine`
- Animation baseline: [Plan 026](plan-026-angry-animation-engine.md)
- State contract: [Plan 020](../../feat-mikucat-state-machine/plans/plan-020-guitar-mode-animation-contract.md)

## Goal

为 MikuCat V2 的 ANGRY 模式增加独立模型外特效机。特效机直接消费状态机已经归约好的
`annoyed / impatient / furious` durable intensity 和一次性 `anger-escalated` cue，以头部附近的弧形
压力线、四圆弧怒气结、手绘 X、蒸汽和热火花强化三档语义；它不读取原始等待时间、不复制 8 秒/25 秒
阈值，也不调用已冻结的 `AngryAnimation`。

## Scope

- 建立与 `AngryWaitingSnapshot`、`AngryWaitingCue` 结构兼容的最小输入端口；不复制状态机实现；
- durable snapshot 只控制当前持续强度和低频环境特效，`anger-escalated` cue 只控制一次性升级强调；
- 特效机负责 generation/revision/sequence 淘汰、实例容量、TTL、持续特效 cadence 和退出清理；
- `annoyed` 使用克制压力线与稀疏单侧蒸汽，`impatient` 增加四圆弧怒气结、错峰双侧蒸汽和成组 X，
  `furious` 再提高 X 密度并加入热火花；
- 使用内联 SVG 和 CSS 动画，不新增位图、生产依赖、模型参数或 Live2D 资源；
- 提供开发态独立预览入口，在接状态总线前逐档观察特效与冻结动画的叠加结果。

不在本计划中：

- 不接真实 `CharacterStateUpdate` 总线，不实现等待计时或生成 `anger-escalated`；
- 不修改 Plan 026 已冻结的三档模型动画曲线、参数所有权或表情素材；
- 不修改既有全屏 WAITING 边缘提醒，也不以新的全屏红光重复承担通知职责；
- 不处理豆豆完成特效、吉他音符接线、Rust/Tauri 或仓库外配置。

## Tasks

1. [x] 以失败测试固定 active/inactive snapshot、revision、generation、cue sequence、晚唤醒和退出语义。
2. [x] 实现 `AngryEffectEngine`，包含三档持续 profile、一次性升级 burst、容量、TTL 与 deadline。
3. [x] 实现只读 `AngryEffectLayer.vue`，用内联 SVG 绘制压力线、四圆弧怒气结、手绘 X、蒸汽和热火花。
4. [x] 增加开发态独立预览入口和单 deadline 调度；不得把开发预览伪装成生产状态机。
5. [x] 运行定向测试、完整 utils、TypeScript、ESLint、Vite 构建与差异检查。
6. [x] 增量同步 Windows 动画镜像，由用户逐档验收位置、亮度、密度和与冻结动画的叠加效果。

## Acceptance

- durable intensity 变化本身不重复播放升级 burst；只有合法、未消费的 `anger-escalated` cue 触发强调；
- 同 generation 的重复或倒序 revision/cue 不重复生成实例，旧 generation 不影响当前画面；
- 晚唤醒直接收到 `furious` 时只播放 furious 语义，不补演 impatient；
- 长时间暂停后最多补发一次当前持续特效，不追赶堆积所有错过 cadence；
- 退出、切换 generation 和组件卸载会清空实例与 deadline，不残留透明交互层；
- 三档可从密度与符号层级辨识，但模型本身仍是主体，特效不遮挡脸部和持葱动作；
- 页面只渲染特效快照，不计算 8 秒/25 秒等待阈值，也不直接驱动 `AngryAnimation`。

## Risks / Dependencies

- 当前分支没有状态总线；开发预览只负责构造合法快照/cue，正式扇出必须留给目标分支 integration plan；
- 模型缩放、镜像和不同窗口比例会影响头部锚点，需在 Windows dev 以当前内置 MikuCat 视觉验收；
- `furious` 模型动画本身动作较大，火花容量与锚点必须克制，避免覆盖脸、葱和双手；
- CSS 动画结束与引擎 TTL 必须使用同一 duration/deadline，避免 DOM 已透明但实例长期残留。

## Progress

首个 Red-Green 增量已完成。`AngryEffectEngine` 接受与状态机分支结构兼容的 active/inactive snapshot
和 `anger-escalated` cue；snapshot 只切换持续 profile，cue 才产生升级 burst。引擎淘汰旧
generation、重复 revision 和倒序 cue sequence，晚唤醒只消费最终档 cue；长时间暂停后最多补发一次
当前持续特效。实例 ID 跨 generation 单调递增，避免 Vue 复用旧 DOM 导致 CSS 动画不重新播放。

首轮 Windows 观察确认状态和生命周期正常，但固定锚点、固定 cadence、镜像蒸汽以及四向粗线怒气
符号显得僵硬且不符合角色画风。第二版已删除该符号，改为三种耳侧弧形压力线、三种蒸汽和三种
火花；持续表现按三套受控短乐句轮换，不使用完全随机。`annoyed` cadence 在
4.3 / 5.2 / 4.7 秒间轮换，`impatient` 为 2.5 / 3.1 / 2.75 秒，`furious` 为
1.45 / 1.9 / 1.65 秒；各乐句同时改变锚点、高度、中段曲线、尺度、左右顺序和错峰时间。升级强调
使用“压力线蓄气—双侧错峰喷气—高档余火”的短序列。页面仍只维护一个最近 deadline timer，并
提供 `Angry effect preview (dev)` 菜单；该入口生成合法测试快照/cue，但不模拟 8 秒/25 秒状态机计时。

根据第二轮视觉反馈，符号池继续增加 `anger-knot` 与 `cross-pop`。`anger-knot` 由四段圆润弯弧
逐段绘制并回弹，不恢复首版已经淘汰的四向粗直线符号；`cross-pop` 有三种手绘比例与笔画轨迹，
通过错峰成组出现避免单个 X 像固定贴纸。`annoyed` 继续保持克制，`impatient` 升级强调加入一个
怒气结与两个 X，`furious` 加到三个 X；持续短乐句也只在后两档按受控组合投放，密度层级仍由状态
档位决定而不是完全随机。

参考图复核后确认第二版仍把所有锚点挤在耳侧，且怒气结的弧线过细、过长。第三版将锚点明确拆为
`crown / ear / face-side` 三个舞台区：升级强调必须同时覆盖头顶、耳侧和脸侧，持续短乐句再在三处
受控轮换。怒气结按参考图重画为围绕空心中心的四段粗短圆弧，统一主色并保留圆头、逐段显现和轻微
回弹；它不再被表现成向外伸展的细线结。

自动化方面，新增 7 项特效机行为测试后，25 个 utils 测试文件全部通过；TypeScript、定向 ESLint、
Vite 生产构建和 `git diff --check` 通过。Vite 仅保留项目既有的动态导入与大 chunk 警告。三个运行
源文件已增量同步到 Windows 动画镜像并逐项校验 SHA-256；第二版修改的特效机与 SVG 层也已再次
同步并核对一致。X 与四圆弧怒气结增量已通过目标行为测试、完整 utils、TypeScript、定向 ESLint 和
Vite 构建，两个运行源文件也已增量同步 Windows 镜像并核对 SHA-256。第三版锚点与参考图弧线也已
同步并核对一致；用户完成 Windows dev 视觉复验后确认特效部分可以封板，本计划据此完成。真实状态
总线接线仍由后续 integration plan 负责。
