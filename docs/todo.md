# Project Todo

## Current Focus

idle — Codex 氛围灯集成阶段已完成并通过用户验收。

## Active Plan

无。

## Current Step

[Plan 004](plans/plan-004-codex-ambient-integration.md) 已完成；交付结果与验证证据见
[Summary 004](summaries/summary-004-codex-ambient-integration.md)。

## Blocked

无。

## Evidence / Attempts

- 输入统计与热力图已分别由 Summary 001 和 Summary 003 记录。
- BongoCat 内置 Codex 状态归约、独立氛围窗口和持久化开关，WSL hook 主动向已运行的
  Windows BongoCat 推送最小事件。
- Windows 开发态已验证主猫恢复正常、氛围灯视觉与手动状态正确；真实 Codex 会话的 hooks
  面板显示四个 lifecycle hook 均为 Installed/Active，首次提示未显示后再次提交即正常触发。
- `D:\\VibeTool\\BongoCat2` 是损坏的复制副本；后续只使用 `D:\\VibeTool\\BongoCat`。

## Next Action

暂无。若继续制作可安装版本，先恢复 Plan 002，并为安装后的 exe 路径配置 bridge 后进行身份、
自启动和真实 hook 验收。

## Validation

- Plan 004 自动化验证：8 个 Rust 事件解析/reducer 测试、5 个 Python adapter 测试、Python
  编译检查、TypeScript 类型检查、目标 ESLint、Vite 生产构建、JSON 配置解析和
  `git diff --check`。
- Plan 004 Windows 开发态：BongoCat 编译启动、主猫非回归、氛围灯手动事件及真实 Codex hook
  链路均已由用户验收。
- 未覆盖：安装版 exe 路径、多显示器、DPI、全屏应用、OBS/录屏、并行 Codex session，以及
  macOS/Linux 实机行为。

## Queued Plans

- [plan-002-personal-distribution.md](plans/plan-002-personal-distribution.md)（proposed；个人发行版
  后续收尾，需验证安装身份及安装版 bridge 路径）。
