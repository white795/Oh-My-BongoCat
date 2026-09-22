# Summary 016: MikuCat Guitar Face and Mouse Decoupling

- Plan: [Plan 016](../plans/plan-016-mikucat-guitar-input.md)
- Status: completed

## Delivered

- 吉他表情使用默认脸，保留拿吉他的手部参数；源导出与内置 Expression 同步。
- 内置 MikuCat 吉他态头手回中立并阻止鼠标参数写入，退出恢复；旧异步输入在切换后失效。
- 6 个源文件与 dev 吉他表情资源增量同步 Windows，未改统计、窗口操作或 Agent 链路。

## Decisions

- 先验收表情与输入解耦，再做手部弹奏；不以停止整个设备监听代替参数控制权切换。

## Verification

- 7 个目标测试、相关 ESLint、新增模块定向类型检查通过；Windows 副本内容比对一致。
- 用户实际观察后反馈“达到了预期效果”，作为本步人工验收依据；助手没有运行 Windows dev 或构建。

## Known Limitations

- 本步没有弹奏曲线；后续由 [Plan 017](../plans/plan-017-mikucat-guitar-hands.md) 制作手部循环。
- 导出 JSON 改动不反写 cmo3；头发物理联动与可能的模型升级仍待后续研究。
