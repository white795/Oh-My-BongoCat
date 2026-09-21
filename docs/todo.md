# Project Todo

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
下一阶段按 Plan 020 建立三部分结构：状态机只发送持续状态和瞬时提示；动画机保持连续运行并
独占 Live2D 参数；特效机承载音符及未来粒子、贴图和光晕等模型外效果。动画机与特效机是同级
消费者，无输入显式归约为 `AUTONOMOUS`。先在当前支线构建状态机与特效机，另一条动画机支线
接口就绪后再接入。当前只完成文档维护，尚未修改运行时代码。
脸部不改，头发物理暂不改，不直接绑定 Agent 状态。现有 Agent 链路保持不变。

## Active Plan

- [Plan 019](plans/plan-019-mikucat-guitar-notes.md)（active，视觉已通过 dev 验收，待补齐退出清理记录）
- [Plan 018](plans/plan-018-mikucat-guitar-performance.md)（active，重音提速与动静对比试调已同步，待 dev 视觉验收）
- [Plan 015](plans/plan-015-mikucat-test2-assets.md)（active，素材迁移与兼容移除已同步，待 dev 验收）
- [Plan 014](plans/plan-014-mikucat-builtin-preset.md)（active，内置注册已同步，待 dev 验收）
- [Plan 011](plans/plan-011-mikucat-model-baseline.md)（基线记录开放，表情复位等未逐项确认）

## Planned Integration

- [Plan 020](plans/plan-020-guitar-mode-animation-contract.md)（planned，一个状态机向动画机与特效机
  扇出的契约已记录；先实施纯状态归约器和特效机，再接动画机支线）

## Next Action

进入 Plan 020 任务 1：先固定 snapshot、cue、sequence、deadline 和消费者入口的最小 TypeScript
契约。随后按 Red-Green-Refactor 构建纯状态归约器，再构建特效机并迁移 Plan 019 已验收的符号、
颜色、轨迹、节流、容量和 TTL；页面不再判断休止语义，特效机不再依赖动画 phase。现有音符外观
不因契约重构而重新设计。状态机与特效机通过后，再核对动画机支线的安全边界入口。

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

Plan 020 本轮将契约修订为“状态机 + 动画机 + 特效机”，并明确 Plan 019 的迁移边界；未修改源码、
同步 Windows、运行测试或构建。

## Superseded

- [Plan 017](plans/plan-017-mikucat-guitar-hands.md)：固定循环视觉验收未通过，由 Plan 018 的演奏动画机替代。
- [Plan 012](plans/plan-012-mikucat-mouse-y-compatibility.md)：test-2 已修复模型参数名，由 Plan 015 移除临时兼容实现。

## Branch Baseline

- [Plan 010](plans/plan-010-ambient-edge-alerts.md) 的实现随提交 `bca8bb0` 继承到本支线；其正式
  NSIS / 安装版关闭条件仍归 `feat/input-statistics` 分支维护，本支线不篡改其状态或补写 Summary。

## Completed

- [Plan 016](plans/plan-016-mikucat-guitar-input.md)（completed） — [Summary 016](summaries/summary-016-mikucat-guitar-input.md)
- [Plan 013](plans/plan-013-mikucat-runtime-assets.md)（completed） — [Summary 013](summaries/summary-013-mikucat-runtime-assets.md)
- [Plan 009](plans/plan-009-release-documentation-closeout.md)（completed） — [Summary 009](summaries/summary-009-release-documentation-closeout.md)
- [Plan 008](plans/plan-008-codex-notify-decoupling.md)（completed） — [Summary 008](summaries/summary-008-codex-notify-decoupling.md)
- [Plan 007](plans/plan-007-ambient-relay-daemon.md)（completed） — [Summary 007](summaries/summary-007-ambient-relay-daemon.md)
- [Plan 006](plans/plan-006-multi-session-ambient.md)（completed） — [Summary 006](summaries/summary-006-multi-session-ambient.md)
- [Plan 005](plans/plan-005-cross-integrity-ambient-ipc.md)（completed） — [Summary 005](summaries/summary-005-cross-integrity-ambient-ipc.md)
- [Plan 004](plans/plan-004-codex-ambient-integration.md)（completed） — [Summary 004](summaries/summary-004-codex-ambient-integration.md)
- [Plan 003](plans/plan-003-statistics-heatmap.md)（completed） — [Summary 003](summaries/summary-003-statistics-heatmap.md)
- [Plan 002](plans/plan-002-personal-distribution.md)（completed） — [Summary 002](summaries/summary-002-personal-distribution.md)
- [Plan 001](plans/plan-001-input-statistics.md)（completed） — [Summary 001](summaries/summary-001-input-statistics.md)

## Queued Plans

- Plan 018 先验收手部演奏及整句头身联动；头发/独立身体通道是否升级留待观察，脸部动作及 WAIT、DONE、特效另行确认。
- 第二阶段的 Agent 映射在模型适配及动画方案明确后单独设计，不把“模型可加载”当作“动画已完成”。
- relay 同来源多 payload 参数绑定风险：连续两天真实使用未复现，不阻塞当前发布；仅在出现
  真实故障或修改相关链路时建立修复计划。
