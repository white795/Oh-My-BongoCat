# Plan 011: MikuCat Model Baseline

- Status: active
- Summary: pending
- Branch: `feat/mikucat-state-machine`
- Parent stage: 第一阶段——模型导入与原软件适配

## Goal

在不修改模型、不改 BongoCat 运行逻辑且不接入 Agent 状态的前提下，将当前
`mikucat-lived2d` 作为自定义模型在 Windows dev 中运行，建立可信的“素材参数—实际视觉行为”
基线，并据此确定后续素材修复、命名和内置模型适配的最小范围。

## Context

- 本计划记录的是历史旧导出基线；用户后来以新版 test-2 替换并重命名为 `mikucat-lived2d`。
  当前同名目录是新版源，不应按本计划的旧文件名清理，详见 [Plan 015](plan-015-mikucat-test2-assets.md)。
- `mikucat/` 当前包含完整预览图和 27 个拆分 PNG；`mikucat-lived2d/` 包含 Cubism 工程与一套
  Live2D 运行文件，两者尚未被 Git 跟踪。
- 静态检查确认 `cat.model3.json` 引用的 moc、纹理、physics、display info 和四个 Expression
  文件全部存在；`.cmo3` 未被运行时清单引用。
- 现有导入器会把没有 `resources/right-keys` 的目录识别为 `standard`，因此该模型可以先走
  自定义模型入口做基线测试，不必先修改 preset 注册逻辑。
- 模型声明了光标、点击、眨眼、头发物理和 `Param9`～`Param13`，但实际视觉效果尚未在
  Windows dev 中逐项确认。
- 模型声明 `ParamParamMouseY`，而应用只写入 `ParamMouseY`；垂直方向仍可能通过
  `ParamAngleY` 表现，但专用 mouse-Y 参数预计不会被驱动。
- 模型没有 `resources/cover.png`、Motion、键盘手部参数或按键贴图。这些项目需要先按新产品
  方向判断是缺陷、可选能力还是明确的非目标，不能照旧模型标准直接补齐。

## Scope

- 对当前两份素材目录进行只读结构和引用检查。
- 把未修改的 `mikucat-lived2d` 提供给 Windows dev 的自定义模型导入入口。
- 逐项观察模型加载、尺寸、光标、点击、眨眼、物理和四个 Expression。
- 记录预期、实际结果、问题归属和是否需要修复。
- 根据真实画面提出参数、Expression、文件和目录的命名方案，但本计划不执行重命名。
- 确定下一步运行时资源清单，以及设计源是否保留在仓库中的决策条件。

## Non-goals

- 不修改 `.cmo3`、`.moc3`、纹理、physics、Expression 或拆分 PNG。
- 不把 MikuCat 复制进 `src-tauri/assets/models`，不修改 `ModelMode` 或 preset 初始化。
- 不补充键盘动作、Motion、声音、口型或 HitArea。
- 不订阅 ambient snapshot / alert，不设计或实现 Agent 状态映射。
- 不修改 Codex/Claude hooks、adapter、named pipe、reducer 或仓库外配置。
- 不构建安装包、不调整应用版本号。

## Baseline Matrix

| 能力             | 静态依据或预期                                   | Windows dev 实测                     |
| ---------------- | ------------------------------------------------ | ------------------------------------ |
| 模型导入与加载   | model3 引用完整；导入器应归类为 `standard`       | 用户已导入观察，整体正常             |
| 模型构图与尺寸   | 预览图为纵向角色；需确认窗口比例、裁切和留白     | 用户确认缩放可自行调节，不列为修复项 |
| 自动眨眼         | EyeBlink 绑定 `ParamEyeLOpen` / `ParamEyeROpen`  | pending                              |
| 光标水平跟随     | `ParamMouseX` 与 `ParamAngleX` 可被现有代码写入  | pending                              |
| 光标垂直跟随     | `ParamMouseY` 命名不匹配；`ParamAngleY` 仍可响应 | pending                              |
| 左键效果         | 声明 `ParamMouseLeftDown`                        | pending                              |
| 右键效果         | 声明 `ParamMouseRightDown`                       | pending                              |
| 头发与附件物理   | physics 由 `ParamAngleX` 驱动 8 个输出           | pending                              |
| Expression 1     | Add 0，是否具有复位作用未知                      | pending                              |
| Expression 2     | 修改 `Param9` / `Param10`                        | 用户反馈“豆豆”，按测试顺序对应此项   |
| Expression 3     | 修改 `Param9` / `Param11`                        | 用户反馈“生气”，按测试顺序对应此项   |
| Expression 4     | 修改 `Param12` / `Param13`                       | 用户反馈“吉他”，按测试顺序对应此项   |
| 行为面板与快捷键 | 应显示四个 Expression、无 Motion                 | pending                              |
| 模型选择卡片     | 缺少 `resources/cover.png`，预计显示破图         | pending                              |
| 键盘输入统计     | 模型不响应手部动作，但统计应继续计数             | pending                              |

## Tasks

1. [x] 完成素材文件清单、model3 引用完整性、透明纹理、现有导入规则和模型参数的静态检查。
2. [x] 将未修改的 `mikucat-lived2d` 复制到 `D:\VibeTool\BongoCat\mikucat-lived2d`；11 个文件的
       SHA-256 与 WSL 原件全部一致，未覆盖 `node_modules`、`target` 或现有模型资源。
3. [x] 用户通过自定义模型入口加载未修改模型并反馈整体观察正常；缩放问题已通过设置解决。
4. [ ] 按 Baseline Matrix 逐项实测并记录结果；Expression 必须分别触发，不能根据文件内容
       猜测视觉语义。
5. [ ] 将发现的问题分类为素材问题、命名问题、现有 loader 兼容问题或明确非目标。
6. [ ] 确认参数和 Expression 的目标命名，以及哪些修复必须在 Cubism Editor 中完成后重新导出。
7. [ ] 确认运行时资源白名单、设计源保存策略和远端仓库可见性，再编写下一份素材修复/内置模型
       适配计划。
8. [ ] 创建 Summary 011，记录实测矩阵与下一计划输入；本计划不以“模型已经内置”为完成条件。

## Acceptance

- 当前未修改模型可以在 Windows dev 中被导入，或者已经取得足以定位加载失败层级的原始错误。
- Baseline Matrix 每一项都有实际结果，不再以静态推断代替视觉结论。
- 已明确 `ParamParamMouseY`、Expression 1～4、左右点击和物理的真实表现及修复归属。
- 已确认“缺少键盘手部动作”是产品非目标，而不是第一阶段阻塞。
- 已给出经过实测支持的命名表和运行时资源清单，下一计划无需重新调查相同事实。
- BongoCat 源码、现有模型、ambient 链路和仓库外配置在本计划中均未改变。

## Verification

- WSL：解析全部 JSON、检查 model3 引用与文件清单、复核 Git diff。
- Windows：`pnpm.cmd tauri dev`，人工观察 Baseline Matrix。
- 本计划不运行安装包构建；源码未改变时不重复执行与本计划无关的完整测试套件。

## Windows Baseline Procedure

1. 从托盘退出正在运行的安装版 BongoCat，再在 Windows PowerShell 执行：

   ```powershell
   Set-Location D:\VibeTool\BongoCat
   pnpm.cmd tauri dev
   ```

2. 打开偏好设置的“模型管理”，点击“点击或拖动至此区域导入”，选择目录
   `D:\VibeTool\BongoCat\mikucat-lived2d`（选择文件夹，不是单个 JSON）。导入后点击新增卡片切换
   到 MikuCat。缺失封面可能使卡片显示破图，先记录，不据此判断加载失败。
3. 在模型设置中确认“忽略鼠标事件”关闭、“动作与表情”开启；为方便观察，临时关闭“鼠标移入
   隐藏”，记住原设置，测试后可恢复。
4. 先观察默认构图、窗口裁切、留白和自动眨眼，再分别水平、垂直移动光标；停止移动后观察头发、
   双马尾和附件是否自然回落。无需为了这一步修改模型参数。
5. 在模型窗口以外的测试区域分别按住、松开鼠标左键和右键，记录出现和恢复的效果，避免在模型
   上点击导致拖动或右键菜单干扰观察。
6. 点击当前模型卡片的笑脸按钮，在“动作与表情”面板切到“表情”，用各行播放按钮依次触发
   `1 → 2 → 1 → 3 → 1 → 4 → 1`，每次等画面稳定后再继续。界面“表情 1～4”对应当前
   `expression1～4`；记录每个效果，以及表情 1 是否能恢复默认画面。若无法复位，记录后切回
   原模型再选 MikuCat，作为下一次独立观察的起点。“动作”列表为空属于当前素材的已知情况。
7. 输入少量文字确认键盘计数仍增长，并切回原模型确认可以正常返回。按 Baseline Matrix 回报
   结果；未观察到的项目仍保持 pending。

导入器会把整个目录复制到应用数据目录下的 `custom-models`；以后修改测试源目录不会自动更新
已经导入的副本，后续修模验收需重新导入对应版本。

## Risks / Dependencies

- Live2D 的实际参数范围和网格变形存储在 `.moc3`，仅凭 `.cdi3.json` 无法确认视觉效果。
- 修正真实参数 ID 需要 Cubism Editor 工程并重新导出；只编辑 display info 不构成修复。
- 缺失封面可能只影响设置页卡片，不代表模型加载失败，验收时应分开记录。
- 模型纵向比例可能触发现有主窗口自动调整高度，需区分模型构图问题与加载错误。
- 若目标远端为公开仓库，提交专有素材后第三方可以下载原文件；进入 Git 历史前必须确认远端
  可见性和设计源保存策略。

## Current Checkpoint

- 2026-09-20：未修改素材已复制到 `D:\VibeTool\BongoCat\mikucat-lived2d`；11 个文件共
  4,741,265 bytes，逐文件 SHA-256 一致，7 个 JSON 可解析、8 个 model3 引用均存在。
- Windows 工作副本仍在 `feat/input-statistics`，存在已有改动；本轮只新增素材目录。与模型验收
  相关的 package、store、loader、输入处理、主页面、导入与表情面板共 8 个文件，在忽略 CRLF
  差异后与 WSL 一致，因此本轮不需要同步应用源码；依赖与编译缓存均保留。
- 用户已完成导入观察，反馈整体正常、缩放可自行调节，并给出三个效果“豆豆、生气、吉他”。
  未单独确认的自动眨眼、点击、物理、快捷键、统计和表情 1 复位仍保留 pending，不把整体反馈
  扩大为逐项验收全部通过。
- 用户选择保留素材，优先通过程序兼容接通 mouse-Y；实现与复测进入
  [Plan 012](plan-012-mikucat-mouse-y-compatibility.md)。本基线记录保持开放，后续补充剩余观察；
  命名与封面已由 [Plan 013](plan-013-mikucat-runtime-assets.md) 整理为独立运行副本，待重新
  导入验收；内置 preset 改造尚未实施。
