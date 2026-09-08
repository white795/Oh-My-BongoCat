# Plan 008: Codex Notify / Ambient Lifecycle Decoupling

- Status: completed
- Summary: [summary-008-codex-notify-decoupling.md](../summaries/summary-008-codex-notify-decoupling.md)

## Goal

让 Codex 氛围灯完全由 lifecycle hooks 驱动：`Stop` 负责 DONE，`SessionEnd` 负责移除；legacy
`notify` 只保留原有 Windows toast，不再影响 BongoCat。这样 `/recap` 即使产生 notify，也不能
在会话结束后重新创建绿色残留星标。

## Scope

- Codex adapter 新增 `Stop` lifecycle 映射，并归一化为现有协议事件
  `agent-turn-complete`。
- Codex hook wrapper 与 adapter 移除 legacy `notify` 输入入口。
- `~/.codex/hooks.json` 新增 `Stop` hook。
- `~/.codex/launcher.sh` 删除 ambient 调用，只保留 Windows toast。
- 同步仓库内说明、架构文档及仓库外 Codex 稳定副本。

## Non-goals

- 不修改 Claude Code bridge；Claude 的 `StopFailure` 行为保持不变。
- 不修改 BongoCat reducer、renderer、视觉效果或 TTL。
- 不修改 legacy notify 本身，也不取消 Windows 完成通知。
- 不处理 relay 的批量 PowerShell 参数问题；该问题独立跟踪。

## Tasks

1. [x] 添加失败测试：Codex `Stop` 必须映射为 `agent-turn-complete`；legacy `notify` 不得进入
       ambient dispatch。
2. [x] 修改 Codex adapter 与 hook wrapper，只接受 lifecycle 输入。
3. [x] 更新 `~/.codex/hooks.json` 与 `~/.codex/launcher.sh`，并同步 `~/.codex/ambient` 稳定副本。
4. [x] 更新架构、集成说明、项目约定与当前任务状态。
5. [x] 运行 Codex adapter 目标测试、相关 Python 回归和静态差异检查。
6. [x] 用户重启真实 Codex 会话，验收正常回合 DONE、`/recap` 不产生星标、SessionEnd 删除。

## Acceptance

- `UserPromptSubmit` / 工具 / 权限事件仍按原规则工作。
- Codex 正常结束一个回合时，真实 `Stop` 使对应槽位进入常驻 DONE。
- Codex `SessionEnd` 立即删除对应槽位。
- `/recap` 可以继续触发 Windows toast，但不会向 BongoCat 发送事件，也不会新建或改变星标。
- adapter/wrapper 对无效输入和已移除的 `notify` 模式继续静默、fail-open、退出码为 0。
- Claude Code、多会话 reducer、主猫与输入统计不发生行为变化。

## Risks / Dependencies

- `Stop` hook 的 stdout 具有控制语义；wrapper 必须保持无输出并始终 `exit 0`，避免意外继续或
  阻止回合结束。
- 新 hook 可能需要 Codex 信任确认；验收前必须在 `/hooks` 中确认 `Stop` 为 Installed 1 / Active 1。
- 已经启动的 Codex 会话可能不会热加载 hook 配置；真实验收使用修改后新启动的会话。
- 这是有意破坏旧内部路径的行为变更：任何依赖 `codex-ambient-hook.sh notify` 的外部调用都将
  被静默忽略。
