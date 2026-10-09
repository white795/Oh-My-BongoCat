# Summary 027: MikuCat Angry Effect Engine

- Plan: [Plan 027](../plans/plan-027-angry-effect-engine.md)
- Branch: `feat/mikucat-v2-animation-engine`

## Delivered

- 新增独立 `AngryEffectEngine`，以 durable snapshot 控制 `annoyed / impatient / furious` 持续强度，
  以 `anger-escalated` cue 触发一次性升级强调；
- 引擎统一管理 generation/revision/sequence 淘汰、实例容量、TTL、持续 cadence 和单 deadline，支持
  晚唤醒、长时间暂停及退出清理；
- 新增只读 SVG/CSS 特效层，包含弧形压力线、四圆弧怒气符号、三种手绘 X、三种蒸汽和三种热火花；
- 将空间布局拆为 `crown / ear / face-side` 三个受控舞台区，并以三套确定短乐句轮换位置、轨迹、
  尺度、左右顺序和错峰时间；
- 在主窗口加入仅开发态的独立预览入口及调试 API，不接真实状态总线，也不修改冻结的 ANGRY 模型
  动画。

## Decisions

- 状态机继续独占 8 秒/25 秒等待阈值和强度归约；特效机只消费已归约快照与 cue；
- durable intensity 更新本身不补播瞬时升级，只有合法且未消费的 `anger-escalated` cue 产生 burst；
- 持续表现使用确定短乐句轮换而非完全随机，既避免固定贴纸感，也保持结果可复现；
- `annoyed` 保持克制，`impatient` 增加怒气结和成组 X，`furious` 再提高 X 密度并加入热火花；
- 四圆弧符号采用参考图所示的粗短圆头弧线，围绕空心中心逐段显现，不恢复首版四向粗直线符号。

## Verification

- 7 项特效机行为测试覆盖快照/cue 分工、旧 generation、重复 sequence、晚唤醒、延迟推进、短乐句
  轮换、容量、TTL、退出清理及三舞台区分布；
- 全部 25 个 utils 测试文件、TypeScript、定向 ESLint、Vite 生产构建和 `git diff --check` 通过；
- 两个运行源文件按增量同步至 Windows 动画镜像并核对 SHA-256 一致；
- 用户在 Windows dev 逐轮验收三档密度、符号形状、位置、轨迹与冻结模型动画的叠加效果，最终确认
  特效部分可以封板。

## Known Limitations

- 当前只提供开发预览；真实 `CharacterStateUpdate` 扇出及与动画机的联合生命周期留给目标分支的
  integration plan；
- 三个舞台区使用当前内置 MikuCat 的窗口百分比坐标，不承诺适配其他模型、多显示器或不同构图；
- 豆豆完成特效和吉他音符的真实状态总线接线不属于本计划。
