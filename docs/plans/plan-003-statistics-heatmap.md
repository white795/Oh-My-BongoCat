# Plan 003: Statistics Heatmap

- Status: completed
- Summary: [summary-003-statistics-heatmap.md](../summaries/summary-003-statistics-heatmap.md)

## Goal

将设置页的 14 天条形历史替换为 GitHub 风格的年度活动热力图，以蓝色离散强度展示每日输入总量。

## Context

- Statistics 已以用户本地日期保存 daily history，无需更改持久化格式或输入管线。
- 用户确认使用应用现有的蓝色视觉，而不是 GitHub 绿色。
- 发行版发布工作暂缓；当前改动只针对设置页的统计展示。

## Scope

- 生成最近 53 个周一对齐的日历周，未来日期为空。
- 依据每日 keyboard、mouse、controller 总数计算 0–4 的离散活动等级。
- 使用浅/深主题自适应的五档蓝色，提供月份、工作日和原生悬停提示。
- 保留现有 Today、Yesterday、This Week、This Month、Total 和分类统计。
- 为日历对齐、未来日期和活动等级先增加行为测试。

## Non-goals

- 不更改统计持久化、Rust、输入事件计数口径或主窗口 UI。
- 不引入图表库或新依赖。
- 不提供按日期筛选、编辑或导出历史数据。

## Tasks

1. [completed] 编写热力图日历与等级计算的行为测试。
2. [completed] 实现可测试的热力图数据工具。
3. [completed] 将设置页的条形历史替换为蓝色年度热力图。
4. [completed] 已通过 WSL 测试、类型检查、lint 和生产构建；用户已在 Windows 开发版确认热力图显示和测试数据的颜色分级。

## Acceptance

- 显示 53 列、每列 7 天的年度热力图；日期按本地日历的周一开始对齐。
- 今天之后的格子不显示活动。
- 零活动为中性颜色，非零活动稳定映射到四档蓝色。
- 浅色与深色模式下都有清晰对比；悬停可读出日期和分类总数。
- 现有统计卡片、数据和输入计数行为不变。

## Risks / Dependencies

- 长期极高输入日可能压低其他日期的视觉差异，因此等级采用相对最大值的对数刻度。
- WSL 环境没有可用的 pnpm/Rust；最终前端与 Windows 应用验证需在 Windows 工作区执行。
