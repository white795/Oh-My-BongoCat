# Project Todo

## Current Focus

多会话氛围灯升级（Plan 006），版本 `1.4.0`。

## Active Plan

[Plan 006](plans/plan-006-multi-session-ambient.md)（in-progress）。

## Current Step

Plan 006 Task 1–13 已完成：代码、文档、locale、`1.4.0` 版本字段、快速自动化检查及 Windows
工作区增量同步均已完成。当前只剩 Task 14 的 Windows dev 多会话实机验收。

## Blocked

无。

## Evidence / Attempts

- 输入统计与热力图已分别由 Summary 001 和 Summary 003 记录。
- Plan 004/005：Codex 单会话氛围灯开发与跨完整性级别 named pipe 已由用户验收。
  `1.3.1` 安装包已构建并安装。
- Plan 006 已完成的改动：
  - 多槽位 reducer（按 `session_id` 聚合），Done 常驻直到 SessionEnd/TTL/新回合。
  - DoneSettlement 机制完全移除，单常驻 TTL 清扫线程（60s 周期 / 15min TTL）。
  - pipe 并发（`nMaxInstances=16`，每连接一个处理线程）。
  - snapshot v2（`sessions` 数组 + version=2），前端多星渲染（AgentStar 组件）。
  - Claude Code bridge（独立 adapter + hook + dispatch，8 个 hook 事件）。
  - 前端身份色相（Codex 蓝 / Claude 橙）、等待红光晕隔离、文字色混合策略。
  - 29 个 Rust 测试 + 12 个 Python 测试。
  - runtime 更新与 snapshot/窗口发布串行化，避免并发事件反序执行窗口显隐。

## Next Action

由用户在 `D:\\VibeTool\\BongoCat` 执行 `pnpm.cmd tauri dev`，完成 Plan 006 的多会话实机
验收；通过后再生成 `1.4.0` 安装包并创建配对总结。

## Queued Plans

无。
