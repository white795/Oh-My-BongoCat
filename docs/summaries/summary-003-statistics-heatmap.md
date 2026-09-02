# Summary 003: Statistics Heatmap

- Plan: [plan-003-statistics-heatmap.md](../plans/plan-003-statistics-heatmap.md)
- Status: completed

## Delivered

- 设置页的 14 天条形历史已替换为 GitHub 风格的年度热力图。
- 热力图显示最近 53 个按周一开始对齐的日历周；未来日期隐藏，历史数据仍只来自本地 daily history。
- 零活动显示为中性颜色；非零活动以相对最大值的对数刻度映射到四档蓝色，在不同输入量级之间保持可读差异。
- 保留 Today、Yesterday、This Week、This Month、Total 和键盘/鼠标分类统计，不改变输入管线、持久化格式或桌宠主界面。
- 为此次功能发布将 `package.json` 与 `src-tauri/Cargo.toml` 的版本统一为 `1.2.0`。

## Changes

- 新增纯 TypeScript 热力图数据工具与行为测试，负责周一对齐、未来日期和等级计算。
- 设置页新增月份、工作日标签及浏览器原生悬停提示；浅色与深色主题分别使用蓝色调色板。
- 所有已支持语言的统计历史标签由“最近 14 天”调整为“过去一年”。
- `architecture.md` 记录热力图的稳定展示决策。

## Decisions

- 不新建或迁移任何 statistics 数据：每天的分类计数仍是唯一事实源。
- 等级按可见 53 周内的最大日总量动态计算；因此同一天的颜色可随窗口内的最大值变化而变化，这是为了让近期相对差异始终可见。
- 使用 CSS Grid 和已有样式能力实现，不引入图表依赖。

## Verification

- WSL：`node --import tsx --test src/utils/*.test.ts`、`node_modules/.bin/tsc --noEmit`、`node_modules/.bin/eslint src`、`node_modules/.bin/vite build` 与 `git diff --check` 均通过。
- Windows 手工：用户确认设置页可见热力图；写入不同量级的测试 daily data 后，方格显示不同蓝色强度。

## Known Limitations

- 手柄输入仍未接入，`controller` 分类保持为 0。
- macOS 与 Linux/X11 尚未进行实机输入和显示验证。
- 深色主题有独立 CSS 调色板，但本阶段没有单独记录其人工截图或视觉验收结果。

## Follow-ups

- 若继续个人安装包收尾，恢复 [plan-002-personal-distribution.md](../plans/plan-002-personal-distribution.md)，验证安装版本的应用身份隔离和统计持久化。
