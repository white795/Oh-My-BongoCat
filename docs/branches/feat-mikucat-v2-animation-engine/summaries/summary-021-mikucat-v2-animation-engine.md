# Summary 021: MikuCat V2 Multi-channel Animation Engine

- Plan: [Plan 021](../plans/plan-021-mikucat-v2-animation-engine.md)
- Branch: `feat/mikucat-v2-animation-engine`

## Delivered

- 将 MikuCat V2 的头、身体、双耳、双手、吉他及九个头发参数纳入单 ticker、多通道动画机，补齐
  原子参数所有权、范围裁剪、释放后鼠标/physics 接管和模型生命周期清理；
- 冻结 A、A′、SoftCadence、AccentCadence 及八项具有明确语义的 Motif，并完成独立动作与
  `A/A′ → Motif → A` 上下文视觉验收；
- 将动作规则、历史、Profile 累计资格、载体 gain、确定性四句语法和 releasing 收束集中到
  `GuitarPerformancePlanner`，播放器不再随机决定演奏策略；
- 保留开发态 Profile、模板、Motif 和 release 入口，使动画核心在状态机合并前仍可独立审计；
- 冻结 `GuitarPerformanceIntent` durable 端口及其与状态机快照的一对一语义映射。

## Decisions

- 动作采用“独立资产验收 → 确定上下文验收 → 规划器受控调度”的流程，禁止重新退化为随机动作池；
- 同一时刻每个 Live2D 参数只有一个动画写入者，头发作为统一次级运动层，不复制到各 Motif；
- 吉他动画机是状态机的被动消费者，不读取按键、不计算输入密度、不维护 deadline；
- 本计划不实现 ANGRY、豆豆完成动作、模型外特效接线或真实 `CharacterStateUpdate` 桥接。后三者在
  后续表现计划和最终 integration plan 中处理。

## Verification

- 动作、注册表、规划器、播放器、参数所有权、模型资源和 Live2D 生命周期均有定向行为测试；
- 用户已在独立 Windows dev 镜像逐项确认模型、八项动作、上下文边界、Profile 层级、自动规划及
  releasing 收束，没有观察到跳变、卡顿或异常中断；
- 正式收尾时全部 23 个 utils 测试文件、TypeScript、吉他相关 ESLint、`git diff --check` 与 Vite
  生产构建均通过；Vite 只有既有动态/静态混合导入与大 chunk 警告。

## Known Limitations

- Plan 022 特效核心仍等待与状态总线联合接线，页面旧 POC 适配器尚未删除；
- `PRESS / ACCENT / INPUT_REST` 不进入第一版吉他动画规划器；
- 顶层模式仲裁、generation/sequence 淘汰、ANGRY 动画和 `all-sessions-done` 豆豆一次性动画仍属于
  后续计划，不影响吉他动画核心完成状态。
