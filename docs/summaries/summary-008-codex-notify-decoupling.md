# Summary 008: Codex Notify / Ambient Lifecycle Decoupling

- Plan: [plan-008-codex-notify-decoupling.md](../plans/plan-008-codex-notify-decoupling.md)
- Status: completed

## Delivered

- Codex adapter 接入真实 `Stop` lifecycle hook，并归一化为既有协议事件
  `agent-turn-complete`，继续驱动常驻 DONE。
- Codex adapter 与 shell wrapper 移除 legacy `notify` 输入路径。
- `~/.codex/hooks.json` 新增 `Stop`；`~/.codex/launcher.sh` 删除 ambient 调用并保留 Windows
  toast；仓库内 adapter/wrapper 已同步到 `~/.codex/ambient` 稳定副本。
- 更新架构、集成说明和仓库外文件约定，明确 notify 与 ambient 的职责边界。

## Decisions

- Codex 氛围灯只消费 lifecycle hooks：`Stop` 表示回合完成，`SessionEnd` 表示会话移除。
- legacy notify 只负责 Windows toast。`/recap` 即使触发 notify，也不能创建或改变 BongoCat
  会话槽位。
- Codex 当前只接入真实存在的 `Stop`；`StopFailure` 仍是 Claude Code 独有映射。
- 不修改 reducer 或 renderer，继续复用内部 `agent-turn-complete` 协议，缩小变更范围。

## Verification

- Red 阶段确认旧实现不识别 `Stop`，并仍会把 notify 发送到 ambient dispatch。
- Codex 与 Claude adapter 共 21 个 Python 测试通过。
- `hooks.json` JSON 校验、相关 shell 语法检查、仓库/稳定副本一致性检查和
  `git diff --check` 通过。
- 用户使用真实 Codex 完成人工验收：正常状态链路工作，`/recap` 仍可产生 notify，但不再影响
  氛围灯或生成残留星标。

## Known Limitations

- Codex 会话异常终止、无法产生 `SessionEnd` 时，仍依赖 15 分钟 TTL 清理。
- relay 使用 PowerShell `-File` 传递同来源多个 `-Payloads` 时存在参数绑定风险；连续两天
  真实使用尚未观察到对应故障，因此本计划只记录该风险，不将其视为当前发布阻塞。
- 仓库外 `~/.codex` 配置不会随 Git 提交保存，迁移环境时需要按 `AGENTS.md` 单独同步。
