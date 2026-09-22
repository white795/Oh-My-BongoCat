# Summary 006: Multi-Session Ambient Indicators

- Plan: [plan-006-multi-session-ambient.md](../plans/plan-006-multi-session-ambient.md)
- Status: completed

## Delivered

- 氛围灯按 `session_id` 聚合多个会话槽位，并用蓝色与橙色区分 Codex 和 Claude Code。
- WAITING、WORKING、DONE 与 SessionEnd 生命周期独立作用于对应会话；DONE 常驻到下一回合、
  SessionEnd 或 15 分钟 TTL 驱逐。
- named pipe 支持并发连接，snapshot v2 与前端支持最多五颗星及溢出提示。
- 接入 Claude Code 独立 bridge，并过滤子 agent 事件，避免子任务生成或提前结束主会话星标。
- 应用版本统一为 `1.4.0`。

## Decisions

- `session_id` 是槽位主键，`turn_id` 只用于拒绝同槽位的迟到回合事件。
- 色相表达 agent 身份，字形、动画和光晕表达运行状态。
- DONE 不再自动回到 Idle；星标消失只表示 SessionEnd 或 TTL 驱逐。
- 无法产生 SessionEnd 的异常退出继续由 15 分钟 TTL 兜底。

## Verification

- 开发阶段完成 adapter、reducer、pipe、snapshot 与前端相关自动化测试。
- 用户完成 Windows dev、安装版以及连续两天真实使用验收，多会话状态与 SessionEnd 清理正常。
- 主猫、输入捕获、统计持久化和热力图在真实使用中未发现回归。

## Known Limitations

- 前端最多直接显示五颗会话星标，更多会话使用溢出计数表示。
- agent 或终端异常退出且无法发送 SessionEnd 时，残留槽位最长依赖 15 分钟 TTL 清理。
- relay 同来源多 payload 的 PowerShell 参数绑定存在已知技术风险，但连续两天真实使用尚未
  观察到事件丢失；该风险不在本计划内修复。
