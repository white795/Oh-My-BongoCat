# Summary 020: Character Guitar and Angry State Machines

- Plan: [Plan 020](../plans/plan-020-guitar-mode-animation-contract.md)
- Status: completed
- Final integration: [Plan 029](../plans/plan-029-mikucat-state-presentation-integration.md)

## Delivered

- 父级遍历完整 Agent Session 快照，按 `WAITING > WORKING > RELAXED` 归约角色，集中仲裁
  `MANUAL / AGENT` 所有权；仅内置 MikuCat 支持接管，氛围灯与模型控制独立。
- 吉他子状态提供 `autonomous / engaged / groove / drive`、正交的 `releasing` 与
  `press / accent / input-rest` cue；生气子状态按连续等待的 8 秒、25 秒升级三档强度。
- `CharacterStateCoordinator` 统一父子快照、带来源的 cue 和 deadline，自持至多一个单次语义 timer。
- `CharacterStateUpdate` 是表现层唯一生产入口；Plan 029 已接入统一消费者，移除旧页面语义计时。
- 全部会话真实完成时只产生一次完成 cue，由表现层播放可抢占的豆豆动作。

## Decisions

- 状态机拥有语义，表现层拥有播放 phase、安全边界、参数交接和视觉实例；实际入场不回写语义。
- 当前演奏输入仅为键盘 press edge；鼠标坐标保留给手动跟随和退出目标，不触发输入意图。
- `interaction` 是显式四档，`activity / burst` 是连续的归一化值；不另设音符密度字段，特效只作视觉映射。
- 语义与特效注入同一个 `performance.now()`，各自管理一份 deadline，旧 generation 与 callback 均可淘汰。

## Verification

- 父级、控制器、吉他、生气、连接器与 deadline 的纯逻辑验证见 Plan 020 各阶段记录。
- 合并后 33 个 utils 测试文件、TypeScript、定向 ESLint、Vite 构建通过；宿主目标测试 29 项与
  页面 setup 3 项连接测试覆盖统一生产链路、旧事件淘汰、完成去重及生命周期。
- 2026-10-09 用户完成真实 hook、多会话优先级、输入/休止、等待升级、完成/抢占、手动交还、
  模型切换、退出及重启的 Windows dev 回归，最终主窗口关闭条件满足。

## Known Limitations

- 当前快照没有 `waitingSince`，重启或延迟开启接管时从本地观察到 ANGRY 开始等待计时。
- 输入阈值保持首版基线；本阶段不调整模型曲线、特效外观、原始 hook 或 named pipe 协议。
- 安装包与安装版验收不属于本计划的状态契约关闭条件。
