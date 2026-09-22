# Plan 015: MikuCat test-2 Asset Migration

- Status: active
- Summary: pending
- Branch: `feat/mikucat-state-machine`
- Related: [Plan 014](plan-014-mikucat-builtin-preset.md)
- Supersedes: [Plan 012](plan-012-mikucat-mouse-y-compatibility.md)

## Goal

以用户提供的 `test-2` 作为当前素材来源，迁移已有名称、封面与许可证，并更新第四个内置模型的
运行副本。新导出已修复 mouse-Y 命名，因此删除临时兼容层；旧素材由用户稍后自行删除。

后续用户已将新版 `test-2` 重命名为 `mikucat-lived2d`，并明确要求清理 Windows 旧源目录与
手动导入副本；当前目录含义和清理结果见下方追加记录，不再将同名目录视作旧导出。

## Scope

- 保留新导出的文件名和源工程（目录原为 `test-2`，现为 `mikucat-lived2d`），model3 补上四个
  语义名称，补齐封面与素材许可证。
- 内置资源继续使用 `src-tauri/assets/models/mikucat` 和稳定的 `mikucat` 身份，不改变选择和快捷键。
- 用新版 moc3、display info 和 Expression 更新运行副本；保留新版参数值、顺序和淡入淡出值。
- `useModel` 恢复标准参数直连，移除 `mouseParameters.ts` 及仅用于别名兼容的测试。
- 保留 `mikucat` 拆分原画及当前新版 `mikucat-lived2d`；根据后续明确授权，只清理 Windows
  遗留的旧源目录和旧 MikuCat 导入副本，不修改动画机、Agent 链路及版本号。

## Inspection

- 新 moc3 字符串及 cdi3 均含 `ParamMouseY`，不再含 `ParamParamMouseY`，不是仅修改显示名称。
- `ParamMouseRightDown` 是新旧版本共有的 ID，应用已有按下/松开映射；新右手变形需要实机确认，
  不因静态文件含参数就宣称绑定效果已验收。
- physics 与纹理内容未变；moc3、cdi3 和四份 Expression 已更新。前三个表情增加 Param13 项，
  吉他表情新增脸部参数，全部沿用 test-2，不以旧值覆盖。
- 仍没有 Motion 文件，当前不代表实际动画机或动作制作完成。

## Tasks

1. [x] 检查新素材结构、参数 ID、表情差异和现有调用关系。
2. [x] 更新新源目录及运行副本，删除临时兼容层并完成引用/内容检查。
3. [x] 增量同步 Windows、核对哈希并清理其兼容文件，保留恢复副本。
4. [ ] 用户在 dev 中选择内置版，确认上下光标、右键右手及新版四个表情。
5. [ ] 验收后创建同名 Summary，再推进动画机设计。

## Acceptance

- 新源目录可独立导入；内置目录不依赖旧素材，不包含 cmo3，保留封面、许可证和语义名称。
- 应用直接写入标准 ParamMouseY，不再保留旧别名映射；其余输入数值换算不变。
- 新参数与表情完整来自 test-2，真实右手效果和复位以 Windows dev 为准。

## Risks / Dependencies

- 旧导入副本包含非标准参数名，已在 Windows 清理；重新导入时只使用当前新版 `mikucat-lived2d`。
- 吉他等表情包含新增参数，可能呈现与旧版不同的组合；本轮不重写素材作者的意图。
- 静态校验不等于 Live2D 实机验收。Windows 清理移出的旧素材有临时恢复副本，当前新版源必须保留。
- Windows dev 和构建由用户运行，不执行 Git 写操作。

## Migration Checkpoint (before cleanup)

- test-2 补齐四个表情显示名、`resources/cover.png` 和 LICENSE；导出文件名、cmo3、纹理、
  physics 和新 Expression 内容保持原样。运行副本更新了 moc3、cdi3 和四个 Expression。
- 兼容 helper 及其测试已从 WSL/Windows 移除；`useModel.ts` 与 HEAD 原标准参数代码完全一致。
  两端旧兼容文件和修改前的 useModel 在 `/tmp/bongocat-test2-migration.JW78y3` 有临时恢复副本；
  `/tmp` 不是长期备份。旧素材目录和应用数据中的自定义模型未删除。
- Windows 只更新 7 个文件并移走 2 个兼容文件；最终核对全部 11 个运行资源和 5 个相关代码/测试
  文件 SHA-256 一致。新设计源仍在 WSL 的 test-2，Windows 构建只依赖已同步的内置运行副本。
- 下一步由用户重启 Windows dev 并选择没有删除按钮的内置 MikuCat，确认上下光标、右键
  按下/松开的右手表现和四个新版表情。旧导入模型不会自动变成新版；需要自定义导入时使用 test-2。

## Verification

- 更新前最小断言确认运行素材缺少标准 ParamMouseY 而失败，替换后同一要求通过。
- 新源与运行目录的 16 个引用存在，10 对对应资源逐字节一致；JSON 可解析，所有表情参数均在
  cdi3 中声明，moc3 中存在标准 Y 且无旧别名。运行目录仍为 11 个文件，不含 cmo3。
- 对实际 `handleMouseMove` / `handleMouseChange` 函数做模拟模型检查：Y 两端数值、无别名回退、
  右键按下/松开映射通过；这不是 Live2D 网格或 Windows 实机验证。
- `node --import tsx src/utils/modelPresets.test.ts`：8 项通过。
- `node node_modules/eslint/bin/eslint.js src/composables/useModel.ts` 和
  `git diff --exit-code -- src/composables/useModel.ts` 通过，生产代码及内置资源无旧兼容引用。
- 本轮未运行 Windows dev、Rust 编译或安装包构建。

## Current Checkpoint: Renamed Source and Windows Cleanup

- 当前源为 WSL `mikucat-lived2d`，12 个文件；moc3 与内置运行副本一致。`mikucat/` 中的拆分
  原画保留，程序仍只打包 `src-tauri/assets/models/mikucat` 中的 11 个运行文件。
- 用户确认停止 dev 后，再通过 Windows 进程检查确认 BongoCat 已退出，避免运行时覆盖清理。
- Windows `D:\VibeTool\BongoCat\mikucat-lived2d` 的旧 11 文件目录移出工作副本，替换为新版
  12 文件目录；旧导出名称和非标准 Y 不再混入同一目录。
- `%APPDATA%\com.white795.bongocat.stats\custom-models` 中唯一的旧 MikuCat 导入副本已移除。
  只修改 `tauri-plugin-pinia/model.dev.json`：移除该模型和它的四个快捷键，当前选择改为
  `preset:mikucat`。其余现存模型及快捷键保持不变；正式版 model.json 未改。
- 检查发现 debug 输出中缺少内置 MikuCat，已仅补齐
  `D:\VibeTool\BongoCat\target\debug\assets\models\mikucat` 的 11 个资源文件，未编译、
  未清空 target 或 node_modules。模型清单的 8 个引用均存在。
- 旧 Windows 源目录、导入副本、修改前 model.dev.json 均保存在
  `/tmp/bongocat-model-cleanup.jOMxvc`；已验证内容可恢复，但 /tmp 不是长期备份。
- 清理后：dev 模型列表为原三模型加内置 MikuCat，共四个；custom-models 为空；新版源和
  两份 Windows 运行资源的哈希均与 WSL 一致；其余 14 个应用存储文件（含统计及正式版配置）未变。
- 此次是文件/配置清理，不等于用户已完成 Plan 014 / 015 的实机动作验收，也未开始动画机。
