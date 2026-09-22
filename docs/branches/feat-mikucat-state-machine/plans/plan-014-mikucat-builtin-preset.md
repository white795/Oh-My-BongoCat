# Plan 014: MikuCat Built-in Preset

- Status: active
- Summary: pending
- Branch: `feat/mikucat-state-machine`
- Previous: [Plan 013](plan-013-mikucat-runtime-assets.md) / [Summary 013](../summaries/summary-013-mikucat-runtime-assets.md)

## Goal

把已经验证可加载的 MikuCat 注册为第四个内置模型，无需手动导入。用户明确：目前仅验证模型
可用，实际动画尚未制作；本计划完成后再讨论动画机，不把现有 Expression 当作动画系统验收。

## Scope

- 内置身份 `presetKey` 与 `mode` 分开；MikuCat 的输入模式仍为 `standard`。
- 内置顺序为 standard、keyboard、gamepad、mikucat，之后保留自定义模型。
- 旧三个内置模型在没有 presetKey 时按原 mode 识别，保留 ID；新建内置模型使用稳定 ID，避免
  多窗口首次初始化各自生成不同身份。已有 presetKey 时只按该身份匹配。
- 保留当前选择、快捷键和自定义模型；不删除或自动合并导入版 MikuCat，不强制切换默认模型。
- 只改前端模型初始化及目标测试，不改 Rust、素材、版本号、hook 或 Agent 链路。

## Tasks

1. [x] 最小测试复现缺少第四个模型及同 mode 身份混淆的问题。
2. [x] 实现内置清单、旧记录兼容和当前选择保留，完成目标测试与静态检查，既有类型问题见下。
3. [x] 核对 Windows 工作副本并增量同步，3 个文件 SHA-256 一致，保留无关修改与缓存。
4. [ ] 用户 dev 验收自动出现、可切换、重启后身份/选择/快捷键保留。
5. [ ] 创建同名 Summary 后，再单独梳理动画机和素材动画需求。

## Acceptance

- 无需导入即可显示第四个内置模型；原三个模型的顺序和默认选择不变。
- 旧保存数据升级后原 ID 不变，当前选择及依赖 ID 的快捷键继续有效。
- 重复初始化及资源根路径变化时不重复注册、不混淆两个 standard 模型。
- 导入版保留为独立自定义模型；输入统计、氛围灯和动画资源均不在本轮修改范围。

## Risks / Dependencies

- 导入版与内置版可以同时出现；其独立身份和快捷键不自动迁移。
- 旧记录按 mode 兼容仅适用于历史三个内置模型，不将其用于 MikuCat。
- 本轮不等于鼠标 Y、表情复位或动画设计的完整验收，相关观察继续单独记录。
- Windows dev 由用户运行；本轮不执行打包，不修改 Git 状态。
- 本地依赖的 `TauriPluginPiniaOptions` 不接受原有 `filterKeys` 配置（TS2353）；只读替换为 HEAD
  版本进行同范围检查也出现同一诊断，本轮不修复该既有问题，不宣称 store 类型检查全绿。

## Verification

- Red：按原 mode 匹配逻辑的目标测试 8 项中 6 项失败，包括缺少第四模型和混淆两个 standard。
- Green：`node --import tsx src/utils/modelPresets.test.ts`，8 项通过。
- 当时的相关回归：`node --import tsx src/utils/mouseParameters.test.ts`，5 项通过；该临时兼容
  测试随后在 Plan 015 中随兼容层移除，不再是当前测试入口。
- `node node_modules/eslint/bin/eslint.js src/stores/model.ts src/utils/modelPresets.ts src/utils/modelPresets.test.ts` 通过。
- 新注册模块和测试的定向 TypeScript 检查通过；扩展到 store 的检查保留上述既有 TS2353，
  当前与 HEAD 的诊断一致。
- 使用模拟资源路径 IPC 调用真实 Pinia store 的 `init`，Windows 反斜杠路径、旧 ID、当前选择
  与快捷键保留检查通过。没有模拟或宣称磁盘持久化、真实多窗口和 Live2D 画面验收通过。

## Current Checkpoint

- 注册逻辑位于 `src/utils/modelPresets.ts`，由 `src/stores/model.ts` 调用；类型通过原 store
  入口继续导出，现有导入器不必修改。测试位于 `src/utils/modelPresets.test.ts`。
- 上述 3 个文件已同步到 `D:\VibeTool\BongoCat` 并核对 SHA-256；前一步的 11 个运行素材
  也已核对仍与 WSL 一致，不重新复制素材。未执行 Windows dev、Rust 编译或打包。
- 下一步由用户重启 dev，确认无需导入就能选内置 MikuCat；切换原模型再返回，随后重启确认
  当前选择及自定义快捷键保留、没有新增重复内置卡片。导入版与内置版并存属于预期。
- 内置注册通过后再讨论动画机：用户目前仅确认模型可用，实际动画、复位及过渡仍未制作或完整验收。
- 后续素材已在 [Plan 015](plan-015-mikucat-test2-assets.md) 更新为 test-2，内置注册代码与身份
  保持不变，本计划的切换/重启验收请使用新版内置素材。
- 用户随后将 test-2 重命名为 `mikucat-lived2d`，并要求清理 Windows 旧导入副本；一次性清理
  已在 Plan 015 记录。当前 dev 列表只保留四个内置模型，自定义导入功能本身未变。
