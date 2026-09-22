# Summary 007: WSL Ambient Relay Daemon

- Plan: [plan-007-ambient-relay-daemon.md](../plans/plan-007-ambient-relay-daemon.md)
- Status: completed

## Delivered

- WSL 侧常驻中继 daemon，通过 systemd socket activation 按需拉起，空闲 30 秒自动退出。
- 高频 hook 事件在 WSL 本地按 `session_id` 聚合为状态表，优先级去抖后批量跨界传输。
- 统一 PowerShell dispatcher 提供多 payload 参数入口，目标是在一次启动中处理同来源会话事件。
- 用户通过任务管理器观察并连续真实使用两天，未再发现原有 PowerShell 进程洪峰或可感知卡顿。

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
- 不实现 Phase 2（常驻 PowerShell 子进程）——当前真实使用没有可感知卡顿，不为未出现的
  性能问题继续增加常驻进程和重连复杂度。
- 不编写回滚脚本——破坏性升级已部署并通过实机验证。
- daemon 使用 `selectors` 而非 `asyncio`，保持单线程、零依赖。

## Verification

- 当前 Codex 与 Claude adapter 共 21 个回归测试通过；仓库没有 relay daemon 专用单元测试，
  因此不再保留此前无法由测试文件支持的测试数量声明。
- 用户完成任务管理器人工观察及连续两天真实使用，未发现性能异常或状态链路异常；这属于
  定性验收，不等价于可重复的进程数、RSS 或延迟基准。
- 星标创建、状态更新、`session-end` 清理和 systemd socket activation 已在真实会话中工作。

## Known Limitations

- Phase 2（常驻 PowerShell 子进程 + Rust 单连接多消息）未实现，当前每次 flush 仍启动
  一个短生命周期 PowerShell。Phase 1 性能已满足需求。
- 去抖窗口固定 2 秒，未提供运行时可调参数。
- daemon 无结构化日志或指标导出。
- 同一次 flush 含两个以上同来源 payload 时，PowerShell `-File` 对数组参数的绑定存在技术风险；
  当前真实使用尚未观察到对应的事件丢失，因此本阶段只记录、不修改实现。
- relay daemon 缺少仓库内专用单元测试，后续修改批处理或失败重试时应先补可复现测试。

## Follow-ups

- Phase 2 仅在真实使用出现性能不足时另建计划，不复用现有计划编号。
- 去抖窗口可调参数（若 2 秒仍嫌长可改成 1 秒或 500ms）。
- 多 payload 风险仅在出现真实故障或进入相关代码修改时升级为修复计划。
