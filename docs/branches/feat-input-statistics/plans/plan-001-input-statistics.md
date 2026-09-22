# Plan 001: Input Statistics

- Status: completed
- Summary: [summary-001-input-statistics.md](../summaries/summary-001-input-statistics.md)

## Goal

在不改变桌宠主界面和现有输入/动画行为的前提下，为设置界面增加完全本地的输入次数统计，支持按日保存及 Today、Yesterday、This Week、This Month、Total 聚合。

## Context

- 当前版本统计 keyboard 和 mouse 两类活动，只保存次数，不保存输入内容；controller 仅保留兼容字段。
- UI 仅进入现有设置界面，不修改桌宠主窗口。
- 持久化目标是一个轻量 JSON 数据源；具体复用方式需以 Phase 1 源码审查为准。
- Phase 1 审查结果见 [review-001-input-statistics.md](../reviews/review-001-input-statistics.md)。

## Confirmed Design

- TypeScript 承担统计核心、事件语义、聚合、Pinia state 和设置 UI。
- 复用现有 Pinia/Tauri JSON store；Rust 在 Pinia 加载前仅为 statistics 文件补充损坏 JSON 备份与恢复。
- 唯一持久化事实源为 daily history；所有周期和 Total 均动态聚合。
- 输入先进入内存增量缓冲，再批量同步和节流写盘。
- 设置页新增 Usage 风格面板，桌宠主界面不变。
- 当前版本键盘优先，同时统计鼠标按钮按下；不修改手柄管线，`controller` 字段仅作兼容预留。

## Scope

- 追踪键盘和鼠标输入事件并确定旁路统计接入点。
- 实现可测试的每日计数与日/周/月/累计聚合。
- 内存更新，批量/定时及退出时写盘。
- 在设置中增加紧凑的 Usage 风格统计页面。
- 覆盖核心统计、日期边界、持久化恢复与损坏数据测试。

## Non-goals

- 不修改桌宠主界面、动画语义、模型系统或现有输入响应。
- 不统计具体键值、文本、Typed Characters、WPM 或键盘热力图。
- 不增加数据库、云同步、账号、遥测或外部服务。
- 不进行无关重构、依赖升级或全仓格式化。

## Tasks

1. [completed] 完成输入链、状态/持久化、生命周期和设置页源码审查。
2. [completed] 先编写 Statistics Core 的行为测试，再实现数据模型与聚合。
3. [completed] 将键盘和鼠标输入旁路接入 Statistics，保持原行为不变；手柄留待后续。
4. [completed] 实现批量保存、启动加载、退出保存与损坏数据恢复。
5. [completed] 在设置页增加统计入口和面板。
6. [completed] 执行目标测试、相关回归、lint/类型检查和构建验证；Windows 原生端与手工验证已通过。

## Acceptance

- keyboard、mouse 分类计数正确，controller 兼容字段保持为 0，合计可从分类数据得到。
- Today、Yesterday、This Week、This Month、Total 和每日历史正确。
- 本地日期跨日、跨月、跨年聚合正确。
- 重启后数据保留，文件缺失或损坏时应用不崩溃。
- 输入事件不逐次同步写盘，退出时执行尽力保存。
- 不保存或上传实际输入内容。
- 统计 UI 只位于设置中，桌宠原有行为保持不变。

## Risks / Dependencies

- OS hook 的重复事件和不同平台事件语义可能导致计数口径不一致。
- 托盘退出发生在 preference Webview，需要与 main Webview 的输入缓冲协调 flush。
- 语法损坏的 JSON 会在 frontend hook 前加载失败，因此 statistics 专用启动插件必须先将其备份并移开。
- 当前版本经用户确认不接入 controller；未来实现时需单独决定是否扩大现有 gamepad-mode 生命周期。
