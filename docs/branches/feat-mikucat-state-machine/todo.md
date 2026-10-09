# Project Todo — feat/mikucat-state-machine

## Current Focus

`feat/mikucat-state-machine` 已整合表现分支 `feat/mikucat-v2-animation-engine`（`cac39b6`），
状态基线为 `5a8d4a4`。源码与 Windows 联合 dev 验收完成，结果见
[Summary 029](summaries/summary-029-mikucat-state-presentation-integration.md)；来源分支历史保留。

三个冲突文件已按两侧职责整合：主窗口保留 Ambient 监听、缓存恢复、接管开关与手动仲裁；
Live2D 保留 V2 参数所有权、安全升级、latest-wins 交接与豆豆完成动画。主窗口现使用
Controller -> Coordinator -> `CharacterStateUpdate` -> PresentationConsumer 的唯一生产链路，
按键和语义 deadline 都走该链路；两套特效层只渲染消费者快照。旧 `GuitarNoteEffect` POC、
页面休止 timer、逐音符 timer 和独立生气特效预览生命周期已移除，语义与特效共用
`performance.now()`，各自维护至多一个 deadline timer。

连接测试覆盖真实宿主、输入休止、8 秒/25 秒等待升级、重复 hook、旧 generation、
完成去重/抢占、手动交还、模型替换及页面卸载。2026-10-09 用户确认联合 dev 全部通过，
包括退出及重启后的真实 hook 联动，Plan 019/020/029 已闭环。
用户已完成合并提交 `fe4fbd2`；版本配置已从 `1.4.1` 升级为 `1.5.0` 并同步至 Windows。
用户反馈安装包已发布，功能源码与内置运行素材保持已验收版本。本地版本改动和收尾文档尚未
提交；当前先由用户提交并推送本分支，再开始 Windows 原生连接件开发。

## Active Plan

暂无新的功能实施计划。当前只收尾已发布的 `1.5.0`，不改变模型能力识别、许可证或 Git 跟踪规则。
下一阶段范围已确认：独立 Windows Codex hook 发送器，读取 stdin、归一化并写入现有 named pipe；
hook 注册交给远端 Codex，暂不实现安装器、Claude 适配或常驻服务。本轮提交前不开始该开发。

## Earlier Stage Records

以下保留原阶段开放记录，不据本轮 V2 联合验收追认其所有历史检查，也不作为本次合并提交阻塞：

- [Plan 018](plans/plan-018-mikucat-guitar-performance.md)（active，重音提速与动静对比试调已同步；
  动画机实现与后续 dev 视觉验收移交表现层支线）
- [Plan 015](plans/plan-015-mikucat-test2-assets.md)（active，素材迁移与兼容移除已同步，待 dev 验收）
- [Plan 014](plans/plan-014-mikucat-builtin-preset.md)（active，内置注册已同步，待 dev 验收）
- [Plan 011](plans/plan-011-mikucat-model-baseline.md)（基线记录开放，表情复位等未逐项确认）

## Next Action

WSL 的 `package.json`、`src-tauri/Cargo.toml` 及根 `Cargo.lock` 中应用版本已统一为 `1.5.0`，
三个文件已增量同步至 Windows 并逐项核对一致；Tauri 引用 package 版本，无需重复维护。
由用户提交三个版本文件及本 todo，并推送到 `origin` 的 `feat/mikucat-state-machine` 分支，
不再发起 merge。提交推送完成、工作区干净后，再记录下一阶段连接件计划并开始实施。

远端 `white795/BongoCat` 为公开仓库。内置运行资源已存在于提交历史；如果改为外置导入，
只删除最新目录不能移除历史素材，还需单独设计导入模型的 Agent 能力识别。用户现已明确要求
推送当前分支；本轮保留内置素材及专有许可证，不实施外置导入或仓库可见性调整。

## Earlier Verification Records

Plan 029 当前源码检查：33 个 utils 测试文件通过；真实宿主 29 项和页面 setup 3 项连接测试
通过，TypeScript、合并范围 ESLint、Vite 生产构建与工作区差异检查通过。构建只有既有动态导入/
大 chunk 警告。Windows 已增量同步并核对 85 个路径，旧文件备份位于
`/tmp/bongocat-integration-sync.SYGd2B/before/`；dev 编译与人工验收由用户执行，助手未替用户
暂存、提交或打包。

2026-10-09 联合 dev 确认：默认显示、吉他自治/键盘/休止、真实等待三档/批准恢复、
多会话优先级/最后完成、豆豆抢占、独立开关/手动交还、换模、退出及重启联动均无异常。
Plan 019 的完整清理与 Plan 020 的主窗口回归已关闭，详细结果见 Summary 029。

以下是各独立步骤当时的验证记录，其中“尚未接线/待实机”等描述不再代表当前集成路径。
Plan 018 的早期曲线观察由 V2 表现支线接替；Plan 014/015 的原阶段记录仍保留，不作额外追认。

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

- [Plan 029](plans/plan-029-mikucat-state-presentation-integration.md)（completed，合并提交 `fe4fbd2`） — [Summary 029](summaries/summary-029-mikucat-state-presentation-integration.md)
- [Plan 020](plans/plan-020-guitar-mode-animation-contract.md)（completed） — [Summary 020](summaries/summary-020-guitar-mode-animation-contract.md)
- [Plan 019](plans/plan-019-mikucat-guitar-notes.md)（completed） — [Summary 019](summaries/summary-019-mikucat-guitar-notes.md)
- [Plan 016](plans/plan-016-mikucat-guitar-input.md)（completed） — [Summary 016](summaries/summary-016-mikucat-guitar-input.md)
- [Plan 013](plans/plan-013-mikucat-runtime-assets.md)（completed） — [Summary 013](summaries/summary-013-mikucat-runtime-assets.md)

## Queued Plans

- Windows 原生 Codex 连接件待本轮提交推送后建立计划；输入阈值与后续视觉调优另行确认。
- relay 同来源多 payload 参数绑定风险：连续两天真实使用未复现，不阻塞当前发布；仅在出现
  真实故障或修改相关链路时建立修复计划。
