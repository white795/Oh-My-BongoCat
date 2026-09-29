# Summary 025: Guitar Performance Planner

- Plan: [Plan 025](../plans/plan-025-guitar-performance-planner.md)
- Branch: `feat/mikucat-v2-animation-engine`

## Delivered

- 将固定模板展开器升级为确定性 `GuitarPerformancePlanner`，统一输出乐句/Motif 身份、角色、
  Profile、`gain`、插槽、迭代和选择原因；
- 以连续 `activity` 生成 A/A′/Cadence 载体强度，只在乐句边界采纳，冻结 Motif 始终保持标准曲线；
- 按 `homeProfile / minimumProfile` 建立累计动作资格：高强度可复用低强度动作，低强度不能选择
  高强度动作；
- 建立主动作/支撑动作交替、禁止 Motif 连续、拒绝立即重复和特殊点头铺垫等确定性四句语法；
- 完成 `releasing` 收束：当前句自然结束、待播队列撤销、SoftCadence 恰好一次、随后保持 A，恢复
  后从新的 establish A 重新建立。

## Decisions

- 状态机只提供 durable intent，规划器拥有动作资格、历史、乐谱选择和载体强度，播放器只执行结果；
- `GuitarInteractionSnapshot.interaction / activity / releasing` 在合并时一对一映射到
  `GuitarPerformanceIntent.profile / activity / releasing`；
- 吉他动画核心不复制 `CharacterStateUpdate`，不保存 generation/revision/sequence，也不消费
  `PRESS / ACCENT / INPUT_REST`；真实接线统一留给目标分支的顶层表现消费者；
- 八项冻结动作、A/A′、SoftCadence 和 AccentCadence 不再因规划器收尾而重编。

## Verification

- Red-Green 行为测试覆盖 gain 单调性与边界采纳、累计资格、主/支撑交替、近期历史、Profile 降级、
  Motif 不被中断、释放只收尾一次和 ACTIVE 恢复；
- Windows dev 已确认低/中/高载体层级、四档自动编排、动作前后衔接及释放/恢复路径均无明显断裂；
- 正式收尾时全部 23 个 utils 测试文件、TypeScript、吉他相关 ESLint、差异检查和 Vite 生产构建
  均通过，完整结果同时记录在父级 Summary 021。

## Known Limitations

- 第一版规划器不消费瞬时 cue，未来若让 `ACCENT` 改变动作，必须新增安全拍点量化计划；
- `burst` 尚未进入动画规划输入，仍可由特效机或未来扩展使用；
- 真实 `CharacterStateUpdate`、生命周期仲裁和跨模式抢占需在状态机与动画分支合并后接入。
