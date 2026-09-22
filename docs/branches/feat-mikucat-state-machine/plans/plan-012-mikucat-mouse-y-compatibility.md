# Plan 012: MikuCat Mouse Y Compatibility

- Status: superseded
- Summary: not created (superseded before visual acceptance)
- Superseded by: [Plan 015](plan-015-mikucat-test2-assets.md)
- Branch: `feat/mikucat-state-machine`
- Parent stage: 第一阶段——模型导入与原软件适配
- Baseline: [Plan 011](plan-011-mikucat-model-baseline.md)

## Goal

用户选择保留现有 Cubism 工程和导出文件，通过程序端参数别名接通 MikuCat 的纵向光标输入。

## Scope

- `ParamMouseY` 存在时优先使用它；仅当其不存在时尝试 `ParamParamMouseY`。
- 取值范围与写入 ID 必须来自同一个实际参数，两种名字都存在时只驱动标准名字。
- 两种名字均不存在时跳过；其余光标参数、方向、镜像和数值换算保持原行为。
- 不改素材、表情数值、模型注册或 Agent 状态链路。封面、命名和内置适配留在后续步骤。

## Tasks

1. [x] 用最小测试复现当前无法解析 MikuCat mouse-Y 参数的问题：别名用例返回 null，另外四项通过。
2. [x] 实现参数别名选择并接入 `handleMouseMove`，5 个针对性测试与相关文件 ESLint 检查通过。
3. [x] 核对 Windows 对应文件后同步 3 个代码/测试文件，SHA-256 一致；其余改动和编译缓存保留。
4. [ ] 用户在 Windows dev 中确认新增纵向动作自然，并检查原 standard 模型光标行为。
5. [ ] 鼠标 Y 验收后创建同名 Summary 012；素材整理已独立进入 Plan 013，不代替本计划的实机验收。

## Acceptance

- 标准名字、别名、两者同时存在、两者均缺失及其他参数的测试通过。
- MikuCat 的实际鼠标 Y 参数收到现有纵向映射值，横向与角度参数仍使用原逻辑。
- 无需重新导出或重新导入模型；Windows dev 实测后才能确认视觉验收通过。

## Risks / Dependencies

- 参数此前未被程序驱动，接通后可能呈现新的位移或变形；实际动作幅度由用户实测确认。
- 程序沿用模型声明的范围；若动作不符合预期，再根据具体画面定位，不预先调整素材数值。
- Windows dev 与构建由用户操作。本计划只同步有关文件，不修改 Windows Git 状态。

## Historical Checkpoint (superseded)

用户后续提供已修复标准 `ParamMouseY` 的 test-2，并要求删除兼容层。Plan 015 已移除本计划的
helper 和测试，恢复标准参数直连；以下保留当时的实现记录，不再作为待执行验收步骤。

- 实现位于 `src/utils/mouseParameters.ts`，由 `src/composables/useModel.ts` 调用；没有缓存模型
  绑定，不会在切换模型后继续沿用前一个模型的参数名。测试位于 `src/utils/mouseParameters.test.ts`。
- Red：仅标准参数查找的实现无法识别 MikuCat 别名，5 项中 1 项失败；Green：加入别名规则后
  `node --import tsx src/utils/mouseParameters.test.ts` 的 5 项全部通过。相关 3 个文件的 ESLint
  与 `git diff --check` 通过。
- 上述 3 个文件已同步到 `D:\VibeTool\BongoCat`，逐文件 SHA-256 校验一致。本轮未执行 Windows
  dev、Rust 构建或安装包构建；素材未变更，不必重新导入。
- 下一步由用户运行或刷新 Windows dev，保持 MikuCat 已选中，移动光标从屏幕上方到下方再返回，
  观察新增纵向动作是否自然、是否出现不希望的变形；再切回原 standard 模型检查光标行为。
- 用户随后要求继续整理；命名与封面已在 [Plan 013](plan-013-mikucat-runtime-assets.md) 中实施，
  内置注册尚未实施。本计划的鼠标 Y 以及 Plan 011 中未逐项确认的行为仍保留待确认。
