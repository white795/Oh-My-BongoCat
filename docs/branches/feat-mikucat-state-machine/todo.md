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
Plan 020 现采用两级状态机：父级读取现有 Agent 多 Session 快照，以
`WAITING > WORKING > RELAXED` 归约 `ANGRY | GUITAR | RELAXED`；只有进入 `GUITAR` 才激活
子级键盘交互状态机。子级只发送持续状态和瞬时提示，动画机与特效机是同级消费者，无输入显式
归约为 `AUTONOMOUS`。现有 hook、bridge、named pipe 和 Rust Session reducer 保持不变。
本轮已完成父级纯 TypeScript 归约器及 5 个行为测试，尚未接通主窗口、持久化接管开关、Live2D
映射或特效。脸部和头发素材暂不改。

## Active Plan

- [Plan 020](plans/plan-020-guitar-mode-animation-contract.md)（active，父级角色归约器已实现；下一步
  拆分接收生命周期并向主窗口发布快照）
- [Plan 019](plans/plan-019-mikucat-guitar-notes.md)（active，视觉已通过 dev 验收，待补齐退出清理记录）
- [Plan 018](plans/plan-018-mikucat-guitar-performance.md)（active，重音提速与动静对比试调已同步，待 dev 视觉验收）
- [Plan 015](plans/plan-015-mikucat-test2-assets.md)（active，素材迁移与兼容移除已同步，待 dev 验收）
- [Plan 014](plans/plan-014-mikucat-builtin-preset.md)（active，内置注册已同步，待 dev 验收）
- [Plan 011](plans/plan-011-mikucat-model-baseline.md)（基线记录开放，表情复位等未逐项确认）

## Next Action

进入 Plan 020 任务 2：把 Rust runtime 当前单一的 `enabled` 拆成接收生命周期与两个独立消费者，
并把最新 Ambient snapshot 定向发布给主窗口。接收条件为“氛围灯显示或 Agent 模型接管任一开启”；
关闭其中一个消费者不得清空另一个仍需要的 Session。随后建立主窗口 Presentation Controller，
集中仲裁手动 Expression / Motion，并只允许声明能力的内置 MikuCat 被 Agent 接管。

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

Plan 020 本轮进一步固定为“父级角色状态机 -> 吉他子状态机 -> 动画机 / 特效机”。父级测试先因
模块不存在按预期失败；首次实现又由测试捕获内部缓存形状错误，修正后 5 个行为测试通过。尚未
同步 Windows、运行 dev 或构建。

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
