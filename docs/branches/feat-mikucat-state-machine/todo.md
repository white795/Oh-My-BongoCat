# Project Todo — feat/mikucat-state-machine

## Current Focus

当前位于 `feat/mikucat-state-machine`。用户已确认 Plan 013 的素材呈现效果可用，同时明确
模型可用与动画表现应分开验收。Plan 014 的第四个内置模型保持不变；Plan 015 已将
素材来源切换为新导出（原 test-2，现已重命名为 `mikucat-lived2d`），更新 Windows 运行副本并
移除已无必要的鼠标 Y 别名兼容。Windows 旧导入副本和旧源文件已完成一次性清理。
用户已确认 Plan 016 的吉他默认脸与鼠标解耦符合预期，但 Plan 017 固定循环的视觉验收未通过。
当前 Plan 018 将其替换为手部演奏动画机：动作片段、乐句、强弱编排与连续过渡。
用户已确认整句 AngleX/Y 轨迹的幅度和流畅度明显改善，最新要求是重音更短促、其余时段不要持续扭动。
本轮重编头身曲线的动静层次：轻奏/放松停稳或微动，常奏分轻缓与活跃乐句，重音快速下压后慢收。
只改头身数据，保留参数幅度上限、手部动作、选句调度和现有素材，不做整模画布变换。
Plan 019 已在吉他表情中接入去重后的键盘按下信号，作为特效机的首个视觉原型；用户确认首版
音符观感很好，本轮在不改变
70 ms 节流、最多 6 个和 820 ms 生命周期的前提下扩为十一种 SVG：8 种基础谱面符号随机且不
连续重复，3 秒滚动输入量分级提高十六分音符占比，停键 1 秒从两种休止符中选取一次并重置乐句；
颜色扩为 10 组不连续重复的双色方案，轨迹仅使用右上、右下、左下和近水平向右，排除左上穿脸。
用户已确认扩充后的符号、配色、高光和三象限轨迹观感非常满意；Plan 019 仍保留完整退出清理等
验收项，未在本轮提前关闭。当前 `GuitarNoteEffect` 同时保存输入语义和视觉实例，页面还维护休止
计时并依赖动画 phase；这些是为了快速验证留下的已知耦合，不作为最终架构。
Plan 020 现采用分层状态机：父级读取现有 Agent 多 Session 快照，以
`WAITING > WORKING > RELAXED` 归约 `ANGRY | GUITAR | RELAXED`；`GUITAR` 激活键盘交互状态机，
`ANGRY` 激活纯等待计时状态机，`RELAXED` 不需要子状态。子状态机只发送持续状态、瞬时提示与
deadline；动画机与特效机是同级消费者，但两者的实现、接线与 Plan 019 语义拆分全部由表现层支线
承担；无输入显式归约为 `AUTONOMOUS`。现有 hook、bridge、named pipe 和 Rust Session reducer
保持不变。
父级纯 TypeScript 归约器及 9 个行为测试已完成。第二层已把 Rust runtime 拆为 indicator 与
presentation 两个消费者，新增默认关闭的持久化接管字段和 command，并将 presentation snapshot
定向发布给主窗口；5 个源文件已增量同步，Windows dev 已由用户确认无异常。第三层 Presentation
Controller 已完成纯逻辑与主窗口接线：先恢复 snapshot 再接管，只有内置 MikuCat 支持接管，现有
手动 Expression / Motion 在中央入口统一仲裁，换模或关闭开关会立即交还；Windows dev 已确认
依赖补齐后编译恢复正常。第四层父级表现适配已通过 Windows dev 视觉验收：新增设置开关，按语义
文件映射默认/生气/吉他，generation 去重，WORK/WAIT 锁定鼠标，RELAXED/手动交还恢复鼠标。
父级另已补齐一次性的 `ALL_SESSIONS_DONE` cue：只有同一 Session 从 WORK/WAIT 真实进入 DONE 且
所有 Session 均为 DONE 时触发；移除、重复快照、重连和延迟接管不重放。豆豆只作为该 cue 的
未来完成动画，不成为稳定角色状态。父级角色状态机已形成最小端到端闭环。动画机在独立 worktree
`feat/mikucat-v2-animation-engine` 开发，本 worktree 不修改其文件。吉他子状态机的纯逻辑层也已
完成：lifecycle、interaction 与 releasing 正交，持续 activity、600 ms burst、迟滞、ACCENT 冷却、
400 ms 释放、1 秒单次休止及 generation 淘汰旧任务均由 `GuitarInteractionMachine` 统一归约。
`AngryWaitingMachine` 也已完成纯逻辑：进入为 ANNOYED，连续 8 秒和 25 秒升级到 IMPATIENT、
FURIOUS；升级 cue 单次发送，漏唤醒直接收敛最终强度，同 generation 不重置，退出后旧 deadline
失效。`CharacterStateCoordinator` 已将父级与两个子状态机连接为统一输出：同时只保留一个活跃
子状态，按来源转发 cue，并只暴露当前子状态的 `nextDeadlineAt`。可选 deadline runtime 依照该值
自持至多一个单次 timer，模式切换、销毁和新 deadline 会取消或替换旧 timer，迟到回调不会复活旧
状态。当前尚未接入动画机或特效机。脸部和头发素材暂不改。

分支职责已经重新划分：本 worktree 只继续父子状态、语义时间、deadline 与公共输出契约；动画机
和特效机仍为同级消费者，但它们的实现、Plan 019 特效拆分和后续改进统一由
`feat/mikucat-v2-animation-engine` 表现层支线承担。

本分支现进入暂停状态：`CharacterStateUpdate` 已冻结为表现层唯一消费入口，父级、吉他、生气与
deadline 不再分别对外接线。状态侧暂无新的开发任务，等待表现层分支完成动画机和特效机后再恢复，
届时只进行契约接线、冲突处理、Windows dev 回归与 merge 收尾。

## Active Plan

- [Plan 020](plans/plan-020-guitar-mode-animation-contract.md)（active，父级归约器与双消费者 runtime
  已验证，两个子状态机、连接器、deadline 调度与标准输出契约已完成；paused，等待表现层消费）
- [Plan 019](plans/plan-019-mikucat-guitar-notes.md)（active，视觉已通过 dev 验收；输入语义拆分与
  退出清理验收一并移交表现层支线，本支线不再演进）
- [Plan 018](plans/plan-018-mikucat-guitar-performance.md)（active，重音提速与动静对比试调已同步；
  动画机实现与后续 dev 视觉验收移交表现层支线）
- [Plan 015](plans/plan-015-mikucat-test2-assets.md)（active，素材迁移与兼容移除已同步，待 dev 验收）
- [Plan 014](plans/plan-014-mikucat-builtin-preset.md)（active，内置注册已同步，待 dev 验收）
- [Plan 011](plans/plan-011-mikucat-model-baseline.md)（基线记录开放，表情复位等未逐项确认）

## Next Action

暂无本分支内的主动开发任务。等待 `feat/mikucat-v2-animation-engine` 完成动画机与特效机；恢复后
由表现层统一消费 `CharacterStateUpdate`，不分别直连父级或子状态机。完成接线后再执行 Plan 020
任务 11 的定向测试、冲突处理和 Windows dev 回归，并据此决定 merge。本分支不拆
`GuitarNoteEffect`、不删除 Plan 019 视觉实现，也不提前实现豆豆完成动画。

Plan 018 仍需在动画机支线继续观察轻奏停稳、常奏动静变化、重音下压和头手衔接；Plan 019 尚需
补齐切回普通表情、切换模型及卸载后不残留的完整生命周期验收。此前 Plan 014 / 015 未逐项确认
的记录继续保留，不将本轮文档调整当作其已经通过。

本轮 15 项动画测试及定向 ESLint / TypeScript 检查通过；对比确认只改头身曲线，
手部数据、调度及幅度上限不变。2 个 TS 文件已增量同步 Windows 并核对一致，差异检查通过。
未运行 dev 或编译；数值检查不替代重音力度、动静对比和头手配合的视觉验收。

Plan 019 的语义状态机先得到 3 项预期失败，随后 5 项音符调度测试、定向 ESLint、TypeScript 与
Vite 生产构建通过；构建只有既有动态导入和 chunk 大小警告。状态机、左右轨迹和页面计时器的
3 个文件已增量同步 Windows 并核对 SHA-256，旧版备份为 `/tmp/bongocat-guitar-note-state.z3JMSd`；
之后的 Windows dev 已由用户运行并确认输入联动观感正常。

十一种符号、10 组双色调色板和三象限轨迹在旧实现上得到 2 项预期失败；实现后 5 项调度测试、
定向 ESLint、TypeScript 与 Vite 生产构建通过，构建仍只有既有警告。3 个相关文件已增量同步
Windows 并核对 SHA-256，旧版备份为 `/tmp/bongocat-guitar-note-variety.Za6qma`；用户随后确认
扩充后的种类、配色、高光和轨迹视觉满意，完整退出清理记录仍待补齐。

此前素材引用/内容、标准参数映射、8 个内置注册测试及相关 ESLint 检查通过；Windows 运行资源和
相关代码已核对 SHA-256。清理前已确认 BongoCat 退出；清理后旧导入目录不再存在，源目录、
源码运行副本与 debug 运行副本校验一致，除 model.dev.json 外其余 14 个应用存储文件未变。
Plan 014 记录的既有 `filterKeys` / TS2353 问题未在本轮修复。
Windows 实机和安装包未由助手运行。

Plan 020 本轮进一步固定为“父级角色状态机 -> 当前模式子状态机 -> 表现层的动画机 / 特效机”。
父级测试先因模块不存在按预期失败；首次实现又由测试捕获内部缓存形状错误，修正后 5 个行为测试通过。双消费者
runtime 已完成 Windows dev 验证。Presentation Controller 的 5 个测试同样先得到预期失败，随后
通过；全量 62 项 utils 测试、定向 ESLint、TypeScript 和 Vite 构建通过，构建只有既有动态导入与
chunk 大小警告。Controller 的 3 个文件已增量同步 Windows；首次 dev 发现该独立副本缺少已提交的
父级归约器，现已补齐 `characterPresentation.ts` 及其测试，5 个文件均核对 SHA-256，等待热重载
后的最终观察；用户随后确认错误消失，任务 3 已关闭。

任务 4 的适配器与 Live2D 所有权测试先得到预期失败；实现后由既有测试捕获并修复一次吉他入场
姿态清零回归。最终 68 项 utils 测试、定向 ESLint、TypeScript、locale JSON 解析和 Vite 构建
通过，构建仅有既有警告。设置、适配器、主窗口、Live2D、测试和 5 份语言文件共 11 个文件已增量
同步 Windows 并核对 SHA-256。用户随后确认实际表现无异常，任务 4 已关闭；父级角色状态机完成
最小端到端闭环。

父级收尾新增 4 项完成边沿测试，并为 transition 增加一次性 cue。新测试先因 `cues` 缺失按预期
失败；实现后全量 72 项 utils 测试、定向 ESLint、TypeScript 与 `git diff --check` 通过。3 个相关
文件已增量同步 Windows 并核对 SHA-256。该 cue 目前尚无视觉消费者，因此本轮不把豆豆完成动画
标记为已验收。

吉他子状态机的 9 项合成时序测试先因实现模块不存在按预期失败；最小实现后目标测试、定向 ESLint、
TypeScript 与全量 81 项 utils 测试通过。状态机只新增两个纯 TypeScript 文件，未接页面或消费者，
两个文件已增量同步 Windows 并核对 SHA-256。因此当前 Windows 视觉行为保持不变；阈值需要等
表现层支线接入消费者后再做实机校准。

生气等待子状态机的 6 项合成时序测试先因实现模块不存在按预期失败；最小实现覆盖初始 ANNOYED、
8 秒 IMPATIENT、25 秒 FURIOUS、每阈值单次 cue、漏唤醒直接收敛、同 generation 不重置、退出清理、
旧 generation 拒绝和单调时钟回退保护。目标测试、定向 ESLint 与 TypeScript 检查通过；该纯逻辑
尚未接页面或消费者，因此不改变当前 Windows 可观察行为。

父子连接器的 6 项测试先因实现模块不存在按预期失败；最小实现覆盖 GUITAR / ANGRY 的互斥激活、
按键路由、RELAXED / MANUAL 清理、同 generation 不重置、旧输入与旧 deadline 淘汰，以及父级 cue
与子级 cue 的来源标记。目标测试、定向 ESLint 与 TypeScript 检查通过。连接器没有创建 timer 或
接入表现层；该阶段的 timer 缺口已由紧随其后的 deadline 调度任务补齐。

deadline 调度的 4 项新增测试先因没有预约 timer 按预期失败；最小实现直接扩展现有连接器，只维护
一个可选单次 timer，没有新增状态机。测试覆盖生气的 8 秒/25 秒唤醒与漏唤醒收敛、吉他输入替换
释放 deadline、releasing 到单次休止的继续预约、模式切换与 dispose 取消，以及被保留旧 callback
的淘汰。目标测试、定向 ESLint 与 TypeScript 检查通过；尚未接表现层，Windows 可观察行为不变。

## Superseded

- [Plan 017](plans/plan-017-mikucat-guitar-hands.md)：固定循环视觉验收未通过，由 Plan 018 的演奏动画机替代。
- [Plan 012](plans/plan-012-mikucat-mouse-y-compatibility.md)：test-2 已修复模型参数名，由 Plan 015 移除临时兼容实现。

## Branch Baseline

- [Plan 010](../feat-input-statistics/plans/plan-010-ambient-edge-alerts.md) 的实现随提交 `bca8bb0`
  继承到本支线；其正式
  NSIS / 安装版关闭条件仍归 `feat/input-statistics` 分支维护，本支线不篡改其状态或补写 Summary。
- Plan 001–009 及对应 Summary 均归档在
  [`feat/input-statistics`](../feat-input-statistics/todo.md)，不在本分支重复维护完成状态。

## Completed

- [Plan 016](plans/plan-016-mikucat-guitar-input.md)（completed） — [Summary 016](summaries/summary-016-mikucat-guitar-input.md)
- [Plan 013](plans/plan-013-mikucat-runtime-assets.md)（completed） — [Summary 013](summaries/summary-013-mikucat-runtime-assets.md)

## Queued Plans

- Plan 018 先验收手部演奏及整句头身联动；头发/独立身体通道是否升级留待观察，脸部动作及 WAIT、DONE、特效另行确认。
- Agent 映射已进入 Plan 020 实施，但仍不把“状态归约通过”当作“动画与特效完成”。
- relay 同来源多 payload 参数绑定风险：连续两天真实使用未复现，不阻塞当前发布；仅在出现
  真实故障或修改相关链路时建立修复计划。
