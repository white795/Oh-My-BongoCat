# Plan 013: MikuCat Runtime Assets and Expression Names

- Status: completed
- Summary: [Summary 013](../summaries/summary-013-mikucat-runtime-assets.md)
- Branch: `feat/mikucat-state-machine`
- Parent stage: 第一阶段——模型导入与原软件适配
- Related: [Plan 011](plan-011-mikucat-model-baseline.md)、[Plan 012](plan-012-mikucat-mouse-y-compatibility.md)

## Goal

将已能导入的 MikuCat 整理为引用完整、带封面和可读表情名称的运行资源目录，为后续第四个
内置模型注册准备素材。用户要求继续整理；Plan 012 的鼠标 Y 实机验收仍单独待确认。

## Scope

- 新增 `src-tauri/assets/models/mikucat`，仅含运行文件和专有素材许可证。
- 原始 `mikucat` 与 `mikucat-lived2d` 目录保留原样，不移动或删除设计源。
- 封面直接复用 `mikucat/1.png`，不改图片内容。
- 规范运行副本的目录和表情文件名，更新 model3 引用，保留四个表情的顺序、参数与淡入淡出值。
- 表情面板优先显示素材提供的语义名称；空名称、`expressionN` 与 `.exp3.json` 文件名等旧标签
  继续显示原有本地化编号。快捷键身份与触发仍按原来的模型 ID 和表情索引工作。
- 继续通过自定义模型导入验收；本计划不修改 preset 注册、模型 store、Agent 绑定或版本号。

## Asset Layout

```text
src-tauri/assets/models/mikucat/
├── LICENSE
├── mikucat.model3.json
├── mikucat.moc3
├── mikucat.cdi3.json
├── mikucat.physics3.json
├── textures/texture_00.png
├── resources/cover.png
└── expressions/
    ├── default.exp3.json
    ├── dot-eyes.exp3.json
    ├── angry.exp3.json
    └── guitar.exp3.json
```

| 原文件                  | 运行副本                         | 显示名 |
| ----------------------- | -------------------------------- | ------ |
| `expression1.exp3.json` | `expressions/default.exp3.json`  | 默认   |
| `expression2.exp3.json` | `expressions/dot-eyes.exp3.json` | 豆豆   |
| `expression3.exp3.json` | `expressions/angry.exp3.json`    | 生气   |
| `expression4.exp3.json` | `expressions/guitar.exp3.json`   | 吉他   |

“默认”是第一项的显示标签，完整复位行为尚未由用户确认；本次不修改其 Add 0 参数定义。

## Tasks

1. [x] 建立运行目录并核对全部引用；确认模型、纹理、physics、display info、表情及封面与源文件一致。
2. [x] 表情面板显示语义名称并保留旧模型编号回退；完成相关 ESLint 与 Vue 编译检查。
3. [x] 增量同步运行目录与表情面板到 Windows，12 个文件 SHA-256 一致，保留现有改动与缓存。
4. [x] 用户已审阅并反馈本部分效果可以；旧模型标签回退另由代码样本验证。
5. [x] 创建同名 Summary 013，内置模型注册进入 Plan 014。

## Acceptance

- 运行目录有且只有一份 model3，所有相对引用存在；不含 `.cmo3` 和原始拆分 PNG。
- 四个表情按原顺序执行，参数数值与源素材一致；新名称不改变现有模型的快捷键索引规则。
- 设置页能看到封面与“默认、豆豆、生气、吉他”；旧内置模型仍显示原编号标签。
- 本轮不把尚未反馈的鼠标 Y 或表情复位表现标成通过。

## Verification

本轮主要为资产复制、清单和标签整理，使用引用/内容校验、旧标签样本检查、ESLint 和 Vue SFC
编译检查；不增加新的测试框架，不执行 Rust 或 Windows 构建。实际画面由 Windows dev 验收。

## Risks / Dependencies

- 自定义导入会创建应用数据中的独立副本，必须导入新目录才能看到新的封面和表情名。
- 当前 Tauri 打包配置包含整个 `assets/models`；新目录会被下次打包收集，但模型列表的自动注册
  仍是下一步。编辑源留在这个范围之外。
- Expression 1 复位和鼠标 Y 新增动作仍待实机反馈；现有表情数值本轮不调整。

## Current Checkpoint

- 运行目录共 11 个文件、1,672,959 bytes；除更新引用和显示名的 model3 外，10 个复制文件与
  原件逐字节一致。全部 JSON 可解析、8 个 model3 相对引用存在，无 `.cmo3` 或拆分设计源。
- 表情面板优先显示素材中的语义名称；实际标签函数的样本检查覆盖四个新名称、空值与自动命名
  回退，以及原三个内置模型的全部表情标签。相关 ESLint 与 Vue SFC 脚本/模板编译检查通过。
- 已同步到 `D:\VibeTool\BongoCat`：11 个运行素材和 1 个表情面板文件 SHA-256 一致。未执行
  Windows dev、Rust 构建或安装包构建。
- 用户已确认本部分效果可用，内置注册进入 [Plan 014](plan-014-mikucat-builtin-preset.md)。
- 用户明确目前只是模型可用，实际动画尚未制作；本计划不代表动画系统完成。
- Plan 012 的鼠标 Y 实机表现及 Plan 011 的表情复位等未确认项继续保留 pending。
