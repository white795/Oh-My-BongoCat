# Plan 029: MikuCat State / Presentation Integration

- Status: completed（统一接线与联合 Windows dev 验收完成；Git 合并提交由用户执行）
- Summary: [Summary 029](../summaries/summary-029-mikucat-state-presentation-integration.md)
- Target branch: `feat/mikucat-state-machine`
- Target baseline: `5a8d4a4`
- Source branch: `feat/mikucat-v2-animation-engine`
- Source baseline: `cac39b6`
- State contract: [Plan 020](plan-020-guitar-mode-animation-contract.md)
- Presentation contract: [Plan 028](../../feat-mikucat-v2-animation-engine/plans/plan-028-presentation-transitions.md)

## Goal

把已提交的状态机与表现分支合并到当前目标工作树，将真实 Agent 快照、键盘 press 和语义 deadline
统一送入 `CharacterStateCoordinator`，由 `MikuCatPresentationConsumer` 消费其 `CharacterStateUpdate`。
让吉他、生气和豆豆完成动作使用已验收的动画与特效，并完成联合 Windows dev 验收。

## Scope

- 合入 V2 运行素材、动画规划器、ANGRY 安全升级、跨模式交接、豆豆完成动画和两套特效机；
- 保留状态分支的 Ambient 监听、快照恢复、接管设置、内置模型能力识别与手动 Expression / Motion 仲裁；
- 替换页面 `CharacterPresentationAdapter` 接线，实例化唯一的真实状态协调器与表现消费者；
- 移除 `GuitarNoteEffect` POC、页面休止 timer、逐音符 timer 和独立 ANGRY 特效预览生命周期；
- 保留开发态动画预览能力，预览须遵守统一表现入口，不维护另一份生产状态或计时阈值；
- 以同一个 `performance.now()` 时钟驱动状态与特效 runtime，并在换模、关闭接管和卸载时清理；
- 正式接线完成后，仅从目标工作树增量同步 Windows `D:\VibeTool\BongoCat`。

本阶段不调整输入阈值、动作曲线、特效外观、应用版本、依赖、Rust 接收协议或仓库外 hook。
Git 状态操作和 Windows dev / 安装包构建继续由用户执行。

## Data Flow and Ownership

```text
Ambient snapshot -> CharacterPresentationController
                                  |
Keyboard press / semantic deadline v
                       CharacterStateCoordinator
                                  | CharacterStateUpdate
                                  v
                       MikuCatPresentationConsumer
                         |                |
                         v                v
                 Live2D animations   Guitar / Angry effects
                 + completion        -> read-only Vue layers
```

语义状态机拥有模式优先级、输入密度、休止、等待升级及 generation。表现层拥有目标到实际动画的
收敛、安全动作边界、参数所有权与连续过渡；实际入场通知只用于表现层内的特效交接，不回写语义。
状态 runtime 管理语义 deadline，消费者 runtime 管理特效 TTL / cadence，各自至多一个 timer。

## Tasks

1. [x] 核对两侧已提交基线与工作区；确认 `.gitignore` 重叠内容相同，源码重叠集中在主窗口、
       `live2d.ts` 和宿主测试；来源分支已有升级、交接、完成动画与统一消费者。
2. [x] 用户在目标工作树执行 `git merge --no-commit --no-ff feat/mikucat-v2-animation-engine`，保留
       合并状态，由本阶段处理冲突后再提交。
3. [x] 以动画分支的 `live2d.ts` 与新测试 fixture 为基础整合宿主，保留真实入场通知、参数所有权、
       latest-wins 交接、Agent 接管和非 MikuCat 模型行为。
4. [x] 先建立真实状态机到表现消费者的集成测试，覆盖输入、deadline、快速模式切换、旧 generation、
       完成 cue、manual 交还与清理，再接入主窗口；所有更新均通过 `CharacterStateUpdate` 交付。
5. [x] 替换页面 POC 与其计时路径；两套 Vue 特效层只渲染消费者的不可变快照。复核模型加载期间的
       更新恢复、开发入口仲裁、监听与两类 timer 的卸载清理。
6. [x] 运行集成目标测试、完整 utils（含 `guitarMotifs/*.test.ts`）、TypeScript、定向 ESLint、Vite
       构建与差异检查，检查冲突标记和资源引用。
7. [x] 增量同步正式 Windows 工作副本，由用户完成真实 hook、输入休止、等待升级、模式交接、
       豆豆完成及抢占、关闭接管/换模/退出的联合 dev 验收。
   - [x] 增量同步源码、V2 运行资源、测试和计划，并按 SHA-256 核对；缺失的状态侧模块一并补齐。
   - [x] 用户启动 Windows dev，逐项完成联合实机验收。
8. [x] 更新目标分支的架构、todo 和阶段结果，核对 Plan 019/020 与来源计划的实际关闭条件，提供
       合并提交命令；未完成的实机验收不得标为通过。

目标分支 architecture、todo、Plan 019/020 和三份阶段 Summary 已对齐实际验收结果。
源码已无冲突标记，用户已暂存解决结果，索引中没有未解决路径；最新收尾文档仍需用户暂存，
merge 尚未提交，本阶段不操作 Git 状态。

## Acceptance

- `CharacterStateUpdate` 可直接传入统一消费者，页面不另建状态语义或依赖动画 phase 判断输入；
- 有 waiting Session 时生气优先于其他 working；同模式重复 hook 不重启动画，连续等待在 8 秒和
  25 秒更新目标强度，动画在既有安全边界采纳；
- 吉他按键、releasing 与单次 `input-rest` 同时到达正确消费者，无输入仍保持自治演奏；
- 所有 Session 真实完成时豆豆只播放一次，旧快照、重连、SessionEnd 和重复 done 不重放；
- 快速模式序列最终收敛到最新目标；旧 generation 特效立即清理，目标效果在实际入场后显示；
- Agent 接管关闭或切到非支持模型后恢复手动控制，氛围灯与模型接管开关保持独立；
- 换模与卸载不残留监听、ticker、语义 timer、特效 timer 或旧视觉实例；
- 冻结动作、音符和怒气特效外观保持既有验收结果，Windows 先 dev 验收再考虑打包。

## Risks / Dependencies

- 三个源码重叠文件涉及生命周期，不能通过整文件选择一侧来完成合并；V2 运行资源必须与动画
  参数所有权代码一起落入目标工作树，设计源目录仍保持忽略；
- 动画分支的 Windows 隔离验收证明表现能力，不代替正式总线接线后的联合验收；
- 来源 Windows 镜像少同步的两份测试和一份计划不影响运行，无需提前补同步；目标工作树完成后
  统一核对本阶段实际同步文件；
- 来源分支的历史文档与总结保留；最终集成进度记录在目标分支，不覆盖来源分支的历史计划。

## Verification

合并准备时确认状态分支 HEAD 为 `5a8d4a4`、动画分支 HEAD 为 `cac39b6`，两侧原工作区均干净。
来源分支简报报告 27 个 utils 测试文件、TypeScript、定向 ESLint、Vite 构建及 Windows 隔离视觉
验收通过。用户已执行 merge；目标工作树的页面接线、源码验证与 Windows 联合 dev 验收均已完成。

额外以两侧真实模块完成只读契约冒烟：Controller 与 Coordinator 的输出直接传入来源消费者，
验证吉他按键、三档等待目标、完成 cue 去重、manual 交还及旧 generation 拒绝。模拟的 Live2D
目标只用于核对模块边界，结果不代替合并后的宿主测试、页面接线或 Windows 实机验收。

合并后的验证结果：

- `live2dGuitar.test.ts` 直接运行的 29 项通过，保留两侧宿主用例并新增 4 项真实 Controller /
  Coordinator / Consumer / Live2D 连接测试。覆盖共享单调时钟、按键/休止、等待优先级与
  8 秒/25 秒升级、旧 generation/callback、完成去重和抢占、手动交还及模型替换。
- `mainPresentation.test.ts` 的 3 项通过；执行真实页面 setup 与真实状态/消费者模块，仅替代
  Vue 生命周期注册、store、native IPC 和 WebGL 目标，验证生产接线、手动仲裁、deadline、
  重复快照、完成 cue，以及卸载后异步加载不得复活资源。该测试不代替真实 DOM/Windows 画面。
- `node --import tsx --test src/utils/*.test.ts src/utils/guitarMotifs/*.test.ts`：33 个测试文件通过。
- `node_modules/.bin/tsc --noEmit` 与合并范围全部 TypeScript / Vue 文件的 ESLint 通过。
- `node_modules/.bin/vite build` 通过，只有既有 Vue 动态/静态导入与大 chunk 警告。
- `git diff --check` 通过；`src/` 和 `docs/` 无 Git 冲突标记；V2 资源契约由 assets 测试覆盖。

仅移除已由正式特效机替代的 `guitarNoteEffect.ts` 与其原型测试；旧实现可从来源 Git 历史恢复。
未调整语义阈值、动作/特效数值、Rust、版本或仓库外 hook；Windows 同步结果见下，未替用户构建。
手动 Expression / Motion 与开发态动画预览仍可用；按冻结契约，manual 的子状态为 `null`，
手动选吉他不生成 Agent 输入联动特效。`CharacterPresentationAdapter` 的历史模块/测试保留，但
已不参与生产接线。最终清理、真实 hook 与观感验收已按任务 7 完成。

### Windows Incremental Sync

- 已确认 BongoCat 进程退出，从当前合并目标工作树增量同步到 `D:\VibeTool\BongoCat`；83 个文件
  更新，补齐此前未同步的 `angryWaiting.ts` 及两份状态侧测试，不只复制三个冲突文件。
- 85 个同步路径（含两项移除）均按 SHA-256 / 不存在性核对。V2 model3 的运行引用及新模块
  依赖需保持完整；未触碰 `node_modules`、`target`、Git 元数据、应用设置或仓库外 hook。
- Windows 原 `guitarNoteEffect.ts` 与其原型测试已移除；全部被覆盖/移除文件的原副本保存在
  `/tmp/bongocat-integration-sync.SYGd2B/before/`，可以恢复。
- 两处 Rust 以及原氛围灯/偏好页的独立格式差异保持原样，不扩大本次同步范围。
- 助手只执行增量同步和只读测试命令；Windows dev 启动、Rust 编译和画面验收由用户执行，
  联合验收结果如下。本阶段没有生成安装包。

### Windows Joint Dev Acceptance

2026-10-09 用户完成 `D:\VibeTool\BongoCat` 的联合 dev 验收，并逐项确认以下结果：

- 启动与默认显示正常，内置模型完整，鼠标跟随、拖动和缩放无异常。
- WORKING 进入吉他，停手仍自治演奏；键盘产生音符，停止输入约 1 秒只产生一次休止符，
  鼠标不接管；任务完成后回默认态。
- 真实权限等待进入生气，连续等待约 8 秒、25 秒逐档增强；批准后恢复吉他，旧生气特效清除。
- 另一个智能体仍在工作时 WAITING 不被覆盖；只有最后一个工作会话完成才播放一次豆豆，
  随后回默认态，不重复播放。
- 豆豆完成动画可被新任务抢占；旧完成回调不把正在工作的模型拉回默认，新任务完成仍正常收尾。
- 关闭 Agent 接管后吉他与音符收起，恢复鼠标和手动表情；氛围灯仍独立显示状态，任务完成
  不覆盖手动选择。
- 切到原 BongoCat 不残留特效或被 Agent 切表情，原有输入正常；切回内置 MikuCat 恢复吉他
  与音符，没有重复特效或报错。
- 彻底退出后人物、音符和氛围灯均消失；重启 dev 后真实 hook、键盘联动及完成动画正常。

内部 deadline、ticker、监听和晚到异步加载的清理由连接测试覆盖；实机验收确认可见行为，
不据此宣称已完成性能测量或安装包验收。来源 Plan 022 的最终接线、Plan 026 的联合回归与
Plan 028 的消费者/生命周期关闭条件在本目标工作树满足；来源分支记录保持原样，不反写其历史。
