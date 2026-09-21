# Summary 013: MikuCat Runtime Assets and Expression Names

- Plan: [Plan 013](../plans/plan-013-mikucat-runtime-assets.md)
- Status: completed

## Delivered

- 整理 `src-tauri/assets/models/mikucat` 的 11 个运行文件，包含封面和素材许可证，不包含 cmo3。
- 表情显示“默认、豆豆、生气、吉他”，旧内置素材保留编号回退；参数和顺序不变。
- 运行素材及表情面板已同步到 Windows；原始素材保持不变。

## Decisions

- 文件使用英文名，语义名称由 model3 提供；快捷键继续按模型 ID 和表情索引绑定。
- 用户已审阅并确认本部分效果可用；该反馈只确认模型与素材呈现，不代表动画已制作或验收。

## Verification

- 10 个复制文件与源文件逐字节一致，全部 JSON 可解析、8 个引用存在。
- 标签样本、旧模型回退、相关 ESLint 和 Vue SFC 编译检查通过；Windows 12 个文件 SHA-256 一致。
- 用户反馈本部分效果可以；未执行 Rust 或安装包构建。

## Known Limitations

- 鼠标 Y 专项表现、默认表情完整复位等未单独确认；实际动画与动画机尚未制作。
- 运行资源完成不等于内置注册；后续由 [Plan 014](../plans/plan-014-mikucat-builtin-preset.md) 接续。
