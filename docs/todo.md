# Project Todo

## Current Focus

构建并安装验证 BongoCat `1.3.1` Windows 个人安装包。

## Active Plan

[Plan 002](plans/plan-002-personal-distribution.md)（active）。

## Current Step

[Plan 005](plans/plan-005-cross-integrity-ambient-ipc.md) 已完成；Windows dev 编译及管理员
BongoCat + 普通 Codex 的真实 named pipe 连接已经用户验收，等待安装包阶段。

## Blocked

无。

## Evidence / Attempts

- 输入统计与热力图已分别由 Summary 001 和 Summary 003 记录。
- BongoCat 内置 Codex 状态归约、独立氛围窗口和持久化开关，WSL hook 主动向已运行的
  Windows BongoCat 推送最小事件。
- Windows 开发态已验证主猫恢复正常、氛围灯视觉与手动状态正确；真实 Codex 会话的 hooks
  面板显示四个 lifecycle hook 均为 Installed/Active，首次提示未显示后再次提交即正常触发。
- `D:\\VibeTool\\BongoCat2` 是损坏的复制副本；后续只使用 `D:\\VibeTool\\BongoCat`。
- 旧 dispatcher 中，普通 PowerShell 能看到管理员 `bongo-cat.exe`，但 CIM 的
  `ExecutablePath` 为 `null`，导致精确路径过滤丢弃事件；Plan 005 已移除该依赖。
- 用户从管理员 PowerShell 进入 WSL 后启动 Codex，真实 hook 能正常触发氛围灯，权限根因已
  实机确认。

## Next Action

提交当前仓库改动后，由用户在 `D:\\VibeTool\\BongoCat` 执行 `pnpm.cmd tauri build`，覆盖
安装 `1.3.1` 并复核正式统计数据、管理员启动和普通 Codex hook。

## Validation

- Plan 004 自动化验证：8 个 Rust 事件解析/reducer 测试、5 个 Python adapter 测试、Python
  编译检查、TypeScript 类型检查、目标 ESLint、Vite 生产构建、JSON 配置解析和
  `git diff --check`。
- Plan 004 Windows 开发态：BongoCat 编译启动、主猫非回归、氛围灯手动事件及真实 Codex hook
  链路均已由用户验收。
- `1.3.0` 版本字段静态一致性、Windows 增量同步结果和 `git diff --check` 已通过；Windows
  安装包已由用户成功构建并安装。
- 管理员 PowerShell → WSL → Codex → 管理员 BongoCat 的旧链路已通过，用于确认原问题来自
  Windows 完整性级别差异。
- named pipe adapter 的 7 个 Python 测试、Python 编译、PowerShell 实际 client→临时 pipe
  传输、Windows rustfmt、Cargo metadata `--locked --offline`、配置解析和 `git diff --check`
  已通过。
- Windows 源文件与 `~/.codex/ambient` bridge 副本一致；Windows dev 已成功编译，用户确认
  管理员 BongoCat 能接收普通权限 Codex 的真实 hook。
- 未单独运行 `cargo test`；新增 Rust 单元测试仍待执行，详见
  [Summary 005](summaries/summary-005-cross-integrity-ambient-ipc.md)。
- 未覆盖：`1.3.1` 安装版、多显示器、DPI、全屏应用、OBS/录屏、并行 Codex session，以及
  macOS/Linux 实机行为。

## Queued Plans

无。
