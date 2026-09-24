# Plan 022: Guitar Effect Engine Extraction

- Status: active
- Summary: pending
- Branch: `feat/mikucat-v2-animation-engine`
- Visual baseline: [Plan 019](../../feat-mikucat-state-machine/plans/plan-019-mikucat-guitar-notes.md)
- State contract: [Plan 020](../../feat-mikucat-state-machine/plans/plan-020-guitar-mode-animation-contract.md)
- Runs alongside: [Plan 021](plan-021-mikucat-v2-animation-engine.md)（independently active）

## Goal

把 Plan 019 为快速验证而混合在 `GuitarNoteEffect` 内的吉他输入语义与视觉实例拆开，形成不读取
原始键盘、不计算输入窗口或静默时间的独立特效机。首阶段保留已经验收的音符图形、配色、轨迹、
节流、容量和生命周期，不接入 `CharacterStateUpdate` 总线，也不修改动画机；等 Plan 021 恢复并
完成后，再由 integration plan 把两个表现消费者一次性接到同一状态输出。

## Scope

- 新增 cue 驱动的 `GuitarEffectEngine`，其输入结构与状态机分支的 `press / accent / input-rest`
  输出兼容，但当前只由单元测试和 POC 适配器直接调用；
- 特效机接管 generation、cue sequence 去重、视觉节流、符号选择、调色板、轨迹、容量、TTL、
  实例回收和退出清理；
- `press` 只读取 cue 已携带的 `activity`，不保存按键时间戳或重建 3 秒窗口；`input-rest` 到达即播放，
  不自行等待 1 秒；
- `GuitarNoteLayer.vue` 继续只读渲染 effect snapshot，不监听输入、不读取动画 phase；
- 为避免总线接入前破坏已验收的页面预览，旧 `GuitarNoteEffect` 暂时降级为 POC 适配器：它维持旧
  键盘演示行为，但所有视觉实例均委托给新特效机。该适配器不是最终架构，合并状态机时删除；
- 除新增 `sharp / flat` 自身的 SVG 与尺寸规则外，不改既有符号外观、颜色、轨迹参数、动画机、
  Live2D 参数或 Windows 构建配置。

## Tasks

1. [x] 对照同级 `BongoCat` 的 `GuitarInteractionMachine`，固定 cue 字段与状态/表现职责边界。
2. [x] 先增加失败测试，覆盖显式 activity、cue 去重、旧 generation 拒绝、即时休止、重音、容量、
       清理和 TTL。
3. [x] 建立 `GuitarEffectEngine`，迁移十三种符号、十组调色板、七类轨迹、70 ms 节流、6 个容量和
       820 ms 生命周期。
4. [x] 将旧 `GuitarNoteEffect` 收缩为 POC 适配器，并以既有测试确认当前键盘预览行为没有退化。
5. [x] 让 `GuitarNoteLayer.vue` 直接依赖特效机输出类型，不依赖临时 POC 适配器。
6. [x] 完成目标测试、全量 utils 测试、TypeScript、定向 ESLint、Vite 构建与差异检查，并复核未修改
       动画数据。
7. [x] 在不增加状态语义的前提下扩充基础视觉池：新增手绘 `sharp / flat` 组合符号，让现有 POC
       键盘路径可以直接随机触发并用于 Windows 视觉验收。
8. [ ] Plan 021 完成后另立 integration plan：删除 POC 适配器与页面休止计时器，把正式状态总线同时
       扇出给动画机和特效机，再执行 Windows dev 联合验收。

## Acceptance

- `GuitarEffectEngine` 中不存在 `recentPresses`、`lastInputAt`、`restEmitted`、3 秒输入窗口或 1 秒
  静默判断；这些语义只由状态机产生。
- 相同 generation 下重复或倒序 cue 不重复生成实例；旧 generation cue 不影响当前画面；切换或
  退出 generation 会清空旧实例。
- `press` 根据 cue 的 activity 保持原有普通/十六分音符密度；`accent` 和 `input-rest` 不依赖页面
  计时即可生成对应符号。
- 十三种符号、十组双色方案、七类非左上轨迹、70 ms 节流、最多 6 个实例和 820 ms TTL 可用；
  `sharp / flat` 与音符组合绘制，不依赖系统字体。
- 特效机可报告最近 TTL deadline，并能在推进时间后自行回收到期实例；页面只负责显示 snapshot。
- 本阶段不接状态总线、不改变动画 Profile、乐句、Live2D 参数写入或用户已验收的 SVG/CSS 外观。
- 旧页面在正式接线前仍能通过临时 POC 适配器维持原有键盘音符预览。

## Risks / Dependencies

- 当前分支没有状态机源文件，不能在本计划中完成真实总线接线；复制一份状态机到本分支会产生
  第二真相源，因此禁止这样做。
- `main/index.vue` 同时包含动画调试入口和旧 POC 接线，是最终合并的冲突热点；本阶段只调整输出
  类型引用，不重写页面生命周期。
- POC 适配器仍临时保存旧输入历史，目的是保持当前独立 worktree 可预览。它不得被误认为最终
  状态机，也不得继续增加新规则；真正接线时必须整体移除。
- `accent` 已有可消费入口，但其与动画重音的联合视觉仍需等双消费者接线后统一验收。
- Windows dev 和构建仍由用户执行；本阶段没有新增外观，自动化验证不能替代最终合并后的实机
  生命周期检查。

## Verification

新测试首先因 `guitarEffectEngine.ts` 不存在得到预期失败；TTL 测试也先因接口不存在失败。实现后，
新特效机的 6 项行为、旧 POC 的 5 项回归及当时全量 11 个 utils 测试文件全部通过。TypeScript、定向
ESLint 和 `git diff --check` 通过；Vite 生产构建通过，仅保留既有动态导入与大 chunk 警告。首次
构建因共享 `node_modules` 只读而无法写 `.vite-temp`，获准写入现有缓存后成功，不是源码故障。
随后 `sharp / flat` 测试先因基础池缺少两个变体按预期失败；实现手绘组合 SVG 后，特效目标测试、
全量 12 个 utils 测试文件、TypeScript、定向 ESLint 与 `git diff --check` 通过。尚未接入真实状态
总线；新符号等待 Windows dev 观察。
