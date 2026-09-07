# Summary 007: WSL Ambient Relay Daemon

- Plan: [plan-007-ambient-relay-daemon.md](../plans/plan-007-ambient-relay-daemon.md)
- Status: completed

## Delivered

- WSL 侧常驻中继 daemon，通过 systemd socket activation 按需拉起，空闲 30 秒自动退出。
- 高频 hook 事件在 WSL 本地按 `session_id` 聚合为状态表，优先级去抖后批量跨界传输。
- 统一 PowerShell dispatcher 接受多 payload 数组参数，单次启动处理所有会话事件。
- 实测 6 并发会话（3 Codex + 3 Claude）、120 次工具调用场景下，PowerShell 进程峰值从预期
  ~180 个降至 1-2 个，改进约 90 倍。用户手动观察任务管理器确认全程仅 2-3 个 PowerShell。

## Changes

- 新增 `integration/bongocat-ambient-relay`：Python relay daemon，状态表 + 优先级去抖 +
  批量分发。IMMEDIATE 事件（`UserPromptSubmit`、`PermissionRequest`、`session-end`）立即
  flush，LOW_PRIORITY 事件（`PreToolUse`、`PostToolUse`）2 秒窗口合并。
- 新增 `integration/bongocat-ambient-dispatch.ps1`：统一 dispatcher，`-Payloads` 数组参数
  替代单 payload，一个 PowerShell 进程内循环开 N 个 pipe 连接。
- 新增 systemd 单元文件：`bongocat-ambient-relay.socket`（socket activation）、
  `bongocat-ambient-relay.service`（`Type=notify`，daemon 自管空闲退出）。
- 更新 `claude_ambient_adapter.py`：`dispatch_event()` 改为写 unix socket，移除直接
  PowerShell 调用和 `wslpath` 依赖。
- 修复 pipe_map：BongoCat 只有一个 pipe server（`codex-ambient`），两个 source 均路由到
  同一 pipe，由 BongoCat 的 `source` 字段区分 Codex/Claude。

## Decisions

- 不采用 `gate.json` 过滤方案（天花板是减半，不是封顶；无法处理高频连发）。
- 不实现 Phase 2（常驻 PowerShell 子进程）——Phase 1 已达到 <1 PowerShell/秒目标，
  无可感知卡顿。
- 不编写回滚脚本——破坏性升级已部署并通过实机验证。
- daemon 使用 `selectors` 而非 `asyncio`，保持单线程、零依赖。

## Verification

- 19 个 Python 测试全部通过（daemon 状态表、优先级 flush、去抖合并、adapter socket 分发、
  fail-open 行为）。
- 实机性能测试：6 并发会话 × 20 次工具调用 = 120 事件，10 秒内 PowerShell 峰值 1-2 个。
  用户通过任务管理器手动确认。
- 星标功能验证：创建、状态更新、`session-end` 清理均正常。
- systemd socket activation：首次事件自动拉起 daemon，空闲 30 秒后自动退出。

## Known Limitations

- Phase 2（常驻 PowerShell 子进程 + Rust 单连接多消息）未实现，当前每次 flush 仍启动
  一个短生命周期 PowerShell。Phase 1 性能已满足需求。
- 去抖窗口固定 2 秒，未提供运行时可调参数。
- daemon 无结构化日志或指标导出。

## Follow-ups

- Phase 2 需单独计划（Plan 008），仅在 Phase 1 性能不足时启动。
- 去抖窗口可调参数（若 2 秒仍嫌长可改成 1 秒或 500ms）。
- Plan 006 Task 14（多会话实机验收）暂缓，优先完成后续发布。
