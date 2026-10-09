# Plan 028: MikuCat Presentation Transitions

- Status: active
- Summary: pending
- Branch: `feat/mikucat-v2-animation-engine`
- State contract: [Plan 020](../../feat-mikucat-state-machine/plans/plan-020-guitar-mode-animation-contract.md)
- Builds on: [Plan 025](plan-025-guitar-performance-planner.md), [Plan 026](plan-026-angry-animation-engine.md), [Plan 027](plan-027-angry-effect-engine.md)

## Goal

补齐 MikuCat V2 已冻结表现能力之间的连续过渡：让 ANGRY 三档在同一播放器中安全升级，让
`RELAXED / GUITAR / ANGRY` 通过单一顶层协调器完成参数所有权交接，并实现可被新任务抢占的
`all-sessions-done` 豆豆一次性完成动作。动画与模型外特效共享同一模式生命周期，但保持并列消费者，
不得互相调用。

## Scope

- `annoyed / impatient / furious` 在当前循环闭合边界采纳最新 durable intent，并以连续位置和速度
  过渡到新档位；不重启 ticker、头发弹簧或已冻结动作曲线；
- 建立唯一的 presentation 协调入口，记录 latest-wins 的目标模式，在旧动画释放参数后启动目标
  表情、动画与特效；
- 默认态、吉他态和生气态之间所有方向均可收敛，快速反向切换不会丢失最后目标；
- 编排 `all-sessions-done` 豆豆一次性动作，动作完成后回到默认态，并允许新的 `GUITAR / ANGRY`
  请求抢占；
- 吉他特效改为消费状态机正式 `PRESS / ACCENT / INPUT_REST` cue，移除临时适配器中的输入窗口与
  休止计时；
- 模式退出立即使旧 generation 的特效 cue 失效，目标特效只在目标模式正式入场时激活。

不在本计划中：

- 不修改状态机的多 Session 优先级、8 秒/25 秒阈值、输入密度或 generation 生成规则；
- 不修改已冻结吉他 Motif、ANGRY 三档动作曲线或两套现有特效视觉语汇；
- 不为豆豆预先新增粒子、声音或新的模型素材；
- 不接 Rust/Tauri、氛围灯、仓库外 hook 或打包流程。

## Tasks

1. [x] 以失败测试固定 ANGRY 播放中 intensity 更新：当前动作自然闭合、latest-wins、姿态与速度连续，
       不创建第二个 ticker、不重置头发弹簧，退出仍可立即抢占升级。
2. [x] 实现 ANGRY 安全升级并提供开发态实时切换入口；完成 Windows dev 三档顺序升级与快速目标覆盖
       验收后冻结播放器行为。
3. [x] 以失败测试固定 `default ↔ guitar`、`default ↔ angry` 及 `guitar ↔ angry` 的完整交接矩阵，
       特别覆盖旧引擎退出后必须自动启动 pending target，以及快速反向请求 latest-wins。
4. [x] 实现单一 presentation 协调器；第一增量先集中表情、参数所有权、鼠标恢复及动画 start/stop，
       完成 Windows dev 跨模式验收；目标特效 activate/deactivate 在任务 6 接入同一入口。
5. [x] 设计并隔离验收豆豆 `all-sessions-done` 一次性动画，再验证从 GUITAR/ANGRY 进入、自然返回
       默认态以及被新一代 WORKING/WAITING 抢占。
6. [ ] 用状态机正式 cue 替换 `GuitarNoteEffect` 临时输入语义，并把吉他、生气和豆豆特效生命周期接入
       同一协调器；同模式 durable 更新不得重启消费者。
7. [ ] 运行定向测试、相关 utils、TypeScript、ESLint、Vite 构建和差异检查；按增量同步 Windows 镜像，
       分别完成 ANGRY 升级、跨模式交接、豆豆完成动作及联合生命周期视觉验收。

## Progress

第一增量已完成 Red-Green 实现，等待 Windows dev 视觉验收。新增行为测试先确认旧播放器只更新
`requestedIntent`、不会在播放中采纳档位而按预期失败；实现后，播放器在当前循环闭合点读取最新
目标，以 420ms、携带当前位置和速度的 Hermite 过渡进入新档位。过渡期间仍保持 `playing` 生命周期
和原 ticker，头发弹簧持续积分；更新中的目标可以 latest-wins 重定向，退出则立即取消升级并从当前
姿态收束。三套已冻结动作关键帧均未修改。开发菜单已从“next entry”改为实时 intensity 入口。

播放器与真实 `Live2d` 宿主共 23 项定向测试通过，覆盖循环边界连续性、最新目标、过渡中退出和
单 ticker；下一步只同步 Windows 镜像，依次观察 `annoyed → impatient → furious` 的等待边界和
420ms 衔接。Windows dev 随后确认三档动作切换连贯，任务 1–2 据此冻结。

第二增量已完成 Red-Green 代码，等待 Windows dev 视觉验收。两条宿主测试先复现
`guitar → angry` 与 `angry → guitar` 在旧引擎退出后停在目标引擎 `idle`；实现后，`Live2d` 以一个
latest-wins 的 `requestedAnimationMode` 统一 reconcile。旧引擎完整执行既有退出段并释放参数，随后
自动获取目标所有权、保持鼠标禁用并启动目标引擎；表情仍沿用既有即时淡入行为。退出期间返回原模式
会直接从当前姿态取消退出，目标改为普通表情则不再启动旧 pending target。40 项动画、宿主、鼠标与
参数所有权定向测试通过，TypeScript、定向 ESLint 和差异检查通过；下一步只同步 Windows 运行文件，
按完整矩阵观察两段式交接是否存在可见中立停顿或表情/身体错拍。

Windows dev 随后确认 default / guitar / angry 的直接切换动作连贯，旧模式释放与目标模式进入之间
没有可见断裂，任务 3–4 据此冻结。第三增量现进入豆豆完成动作：新增独立单 ticker
`CompletionAnimation`，以 1.8 秒“短促蓄力—豆豆抬起—两次递减回弹—停稳”编排头、身体、双耳与
公共头发，再用 420ms 回到最新鼠标头部目标。动作不写双手、吉他、脚或表情参数；豆豆/默认表情
仍由宿主在动作入场和自然回收边界切换。

行为测试先因宿主没有完成动作入口按预期失败；实现后确认 relaxed 可单次播放并自动回默认，
guitar 会先完整退出再开始豆豆，新 angry 请求可用 280ms 收势抢占且不会被迟到的默认表情覆盖。
动作、宿主、鼠标与共享参数所有权共 97 项定向测试通过；额外覆盖一次延迟帧跨过动作与回收段时仍
只完成一次，不会漏掉默认表情后重启。完整 26 个 utils 测试文件、TypeScript、定向 ESLint 与差异
检查通过；当前只增加开发菜单 `Play completion animation (dev)`，等待 Windows dev 隔离观察动作
节奏和幅度。Windows dev 随后确认动作、自然返回及抢占均无问题，任务 5 据此冻结。

第四增量已建立统一表现消费者的可合并边界，但尚未替换页面 POC。新增
`MikuCatPresentationConsumer`，以真实 `CharacterStateUpdate` 的结构子集接收 presentation、child
snapshot 与三类 cue；它只负责 generation/revision 交付和扇出，不复制状态机的输入窗口、等待阈值、
优先级或 deadline 调度。durable 吉他/生气状态映射到已冻结动画 intent，同 generation 更新不会重启
顶层 presentation；旧 generation 的模型外特效在模式切换请求到达时立即清空，目标 cue 则排队到
目标动画实际入场后再消费。

为区分“收到目标请求”和“完成参数所有权交接”，`Live2d` 新增只读实际入场模式与观察接口。
`guitar → angry` 等两段式切换在旧动画退出期间仍报告旧模式，目标引擎真正启动后才报告新模式；
completion 也作为瞬时实际模式报告，完全回到鼠标态后才恢复 relaxed。行为测试覆盖正式吉他 cue
排队、跨 generation 立即清理、ANGRY 入场后激活、完成 cue 去重、manual 释放及真实宿主的两段式
交接。完整 27 个 utils 测试文件、TypeScript、定向 ESLint、Vite 生产构建与差异检查通过；构建仅有
既有动态导入和大 chunk 警告。任务 6 仍未完成：需在
最终合并工作树接入真实状态总线、删除页面 `GuitarNoteEffect` POC 与休止计时器，并实现页面对统一
特效 deadline 的单计时器驱动。

第五增量把上述单计时器能力下沉到统一消费者本身。可选 `MikuCatEffectRuntime` 会收到吉他音符、
怒气实例和下一 deadline 的不可变快照；消费者始终只保留一个最早 deadline，触发后同时推进两套
特效机并按新最早时间重排，generation 切换或 dispose 会取消旧 timer。页面最终不再需要为每个音符
维护 timer，也不需要理解怒气 sustain cadence。Red 测试同时发现同模式 generation 换代会先以新
generation deactivate、继而无法重新 activate；现改为同模式由新 snapshot 原子替换，只有退出或
切到另一模式才提前停用旧引擎。吉他实例 ID 也改为引擎生命周期内单调递增，防止 Vue 在换代时复用
相同 key 而不重播 CSS 动画。完整 27 个 utils 测试文件、TypeScript、定向 ESLint 与差异检查通过。
页面 POC 尚未删除，任务 6 继续等待真实状态机合并。

## Acceptance

- ANGRY 三档升级只在安全闭合边界开始，过渡前后头、身体、双耳、双手和头发无跳变；
- 任意快速模式序列最终收敛到最后一个有效目标，旧模式释放后不会停在只有表情、没有动画的半状态；
- 任一时刻共享 Live2D 参数只有一个动画写入者，退出后鼠标与 physics 能完整恢复；
- 模式退出后旧 generation 的音符、怒气 cue 和定时持续特效均不能重新出现；
- 豆豆只响应有效的 `all-sessions-done` 边沿，播放一次后消失，新任务可以随时抢占；
- 动画、特效和状态机保持单向数据流，任一消费者延迟或清理不阻塞另一消费者。

## Risks / Dependencies

- Guitar 与 ANGRY 参数集合重叠，第一版必须串行交还所有权；不得用同时播放两个动画机实现视觉混合；
- ANGRY 模型动作允许延迟到安全闭合点，而 `anger-escalated` 特效应立即反馈；两者时间差是明确设计，
  不是状态不一致；
- 真实 `CharacterStateUpdate` 位于状态机分支。当前分支先冻结播放器与协调接口，最终总线接线需在
  合并工作树的新 integration plan 中完成；
- 豆豆动作的视觉节奏需要 Windows dev 人工验收，自动化只保护生命周期、抢占和参数连续性。
