# Plan 016: MikuCat Guitar Face and Mouse Decoupling

- Status: completed
- Summary: [Summary 016](../summaries/summary-016-mikucat-guitar-input.md)
- Branch: `feat/mikucat-state-machine`
- Previous: [Plan 015](plan-015-mikucat-test2-assets.md)

## Goal

先让内置 MikuCat 的吉他姿态使用默认脸，并解除真实鼠标对该姿态的控制，之后再单独编排弹奏动画。

## Scope

- 只调整吉他 Expression 的脸部参数，保留拿吉他的参数与表情淡入淡出；源导出 JSON 同步修改。
- 通过现有表情面板/快捷键选择吉他时，头部、手部及鼠标按钮参数回中立，阻止鼠标参数写入。
- 切回其他表情后恢复后续鼠标输入；模型重载清理限制，异步旧输入不得覆盖新姿态。
- 只对内置 MikuCat 启用；不影响其他模型、输入统计、窗口操作和用户的忽略鼠标设置。
- 不改 moc3/cmo3，不做弹奏曲线、WAIT/DONE 编排、贴图特效或 Agent 信号接入，不改 Rust。

## Tasks

1. [x] 编写最小失败测试，调整表情及鼠标输入交接，完成目标测试与相关静态检查。
2. [x] 增量同步 Windows 源码与必要 dev 资源，不执行编译或打包。
3. [x] 用户 dev 验收后收尾，再讨论弹奏曲线。

## Acceptance

- 选择吉他后保留吉他/手部，脸变为默认；移动和点击鼠标不再驱动模型姿态，眨眼仍保留。
- 切回默认或豆豆后，移动鼠标重新驱动模型；快速切换和切换模型不遗留输入锁定。
- 原模型、统计和窗口拖动保持原行为。此时吉他不弹奏是预期，并非动画丢失。

## Risks / Dependencies

- 底层参数覆盖会跨帧保留，进入吉他必须显式回中立；本步不保证新动作与头发物理联动。
- 修改导出 JSON 不会反写 cmo3；以后重新导出需保留本步的脸部调整。
- Windows dev 由用户执行；本地目标测试不代替实际画面验收。

## Verification / Checkpoint

- `node --import tsx src/utils/modelMouseInput.test.ts`：初跑 7 项中 5 项失败，实现后 7 项通过，
  覆盖回中立、阻止鼠标写入、退出恢复、过期输入、重载及两份表情的脸部/手部参数。
- 本次四个 TS 文件的 ESLint、新增模块与测试的定向 TypeScript 检查、`git diff --check` 通过；
  未执行全仓类型检查、Rust 编译或 Windows dev，不将局部检查当作全仓验收。
- Windows 增量同步了 4 个 TS 文件和 2 份表情 JSON，并更新已有 debug 运行目录中的吉他
  Expression；逐文件内容比对一致，没有改依赖、应用存储、exe 或其他编译产物。
- 同步前确认 Windows 对应源文件仍为预期旧版；原文件备份位于
  `/tmp/bongocat-guitar-sync.xQIVK9`（临时备份，不是长期归档）。Windows 文档副本存在差异，未覆盖。
- 用户随后确认“达到了预期效果”，本步据此关闭。手部弹奏循环独立进入
  [Plan 017](plan-017-mikucat-guitar-hands.md)；头发留待之后研究模型升级，不提前制作 WAIT/DONE 或贴图。
