# Codex Ambient Bridge

该目录把 WSL 中的 Codex lifecycle hook 与 legacy notify 转换成最小事件，并发送给已经运行的
Windows BongoCat。它不是常驻服务，也不开放网络端口。

## Runtime flow

```text
Codex -> codex-ambient-hook.sh -> codex_ambient_adapter.py
      -> codex-ambient-dispatch.ps1 -> per-user Windows named pipe
      -> running BongoCat ambient runtime (multi-slot reducer)
```

BongoCat 必须已经运行并启用“Agent 氛围灯”。named pipe 不存在、功能关闭或输入无效时，
bridge 静默退出，不会启动 BongoCat，也不会让 Codex hook 失败。PowerShell client 不需要管理员
权限，因此普通 Codex 可以向管理员 BongoCat 推送事件。

named pipe 支持最多 16 个并发实例。每次客户端连接后立即创建下一个 pipe 实例，消除了串行
模式下的无管道窗口——并发 agent 不再静默丢弃事件。

## Codex configuration

四个 lifecycle hook 使用相同命令，并由 stdin 提供 Codex JSON：

```text
/bin/bash /home/devuser/.codex/ambient/codex-ambient-hook.sh lifecycle
```

legacy `notify` 保持原有 `config.toml` 配置，由 `launcher.sh` 调用：

```text
/bin/bash /home/devuser/.codex/ambient/codex-ambient-hook.sh notify "$JSON_DATA"
```

默认 pipe base name 是：

```text
com.white795.bongocat.stats.codex-ambient
```

Windows client 与 BongoCat 会分别附加当前用户 SID。可用 `CODEX_AMBIENT_PIPE_NAME` 覆盖 base
name 进行隔离测试；生产配置不依赖开发版或安装版 exe 路径。

仓库中的这三个 bridge 文件是版本控制来源；修改协议后需要增量复制到
`/home/devuser/.codex/ambient/`。`hooks.json` 与 `launcher.sh` 只引用该稳定副本，不直接引用
BongoCat 仓库路径。

## Supported events

- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` → WORKING
- `PermissionRequest` → WAITING
- legacy `agent-turn-complete` → DONE（常驻直到会话结束或 TTL 驱逐）

bridge 只转发 `event`、`sessionId`、`turnId` 和 `source`，不会转发 prompt、工具参数或输出。
payload 上限为 4096 bytes；pipe 拒绝远程客户端，并只允许创建它的 Windows 用户访问。

## Multi-session reducer

BongoCat 内部的 reducer 按 `session_id` 聚合多槽位，每个活动 agent 会话独立渲染一颗星标。
槽位状态迁移互不干扰，Done（`✓`）常驻直到：

- 同会话下一条 `UserPromptSubmit` 覆盖为 Working；
- `SessionEnd` 即时移除槽位；
- TTL（15 分钟无活动）驱逐——覆盖终端崩溃、进程被杀等无法触发 hook 的异常退出。

snapshot（version 2）包含 `sessions` 数组，前端根据数组渲染多颗星标（上限 5 颗 + 溢出标记），
色相区分 Codex 蓝与 Claude 橙。

# Claude Code Ambient Bridge

`claude-ambient-hook.sh`、`claude_ambient_adapter.py`、`claude-ambient-dispatch.ps1` 是与
Codex bridge **完全独立**的第二套实现，两者不共享代码。两种 agent 的 payload 形状和生命周期
不同，隔离后修一侧不会回归另一侧，也不必每次改动都做双向回归。它复用同一个 named pipe 和
同一套协议，因此 BongoCat 侧无需改动。

## Claude configuration

八个 hook 使用同一条命令，由 stdin 提供 Claude Code JSON，配置写在
`~/.claude/settings.json` 的 `hooks` 字段：

```text
/bin/bash /home/devuser/.claude/ambient/claude-ambient-hook.sh
```

## Event translation

| Claude Code hook     | 协议事件              | 状态                |
| -------------------- | --------------------- | ------------------- |
| `UserPromptSubmit`   | `UserPromptSubmit`    | WORKING，并建立回合 |
| `PreToolUse`         | `PreToolUse`          | WORKING             |
| `PermissionRequest`  | `PermissionRequest`   | WAITING             |
| `PostToolUse`        | `PostToolUse`         | WORKING             |
| `PostToolUseFailure` | `PostToolUse`         | WORKING             |
| `Stop`               | `agent-turn-complete` | DONE（常驻）        |
| `StopFailure`        | `agent-turn-complete` | DONE（常驻）        |
| `SessionEnd`         | `session-end`         | 即时移除槽位        |

`PostToolUse` 承担 WAITING → WORKING 的恢复边，用户批准后由它让指示器回到工作态，因此不可
移除。`StopFailure` 必须映射 DONE，否则一次限流会留下卡死的指示器。

回合标识取 `prompt_id`（Claude Code 没有 `turn_id`）。**携带 `agent_id` 的 payload 一律丢弃**：
子 agent 事件复用主会话的 `session_id` 与 `prompt_id`，转发它们会让子 agent 的生命周期驱动主
会话指示器，其中 `SubagentStop` 尤其不能被读成 DONE。

## Constraints

Claude Code 中 hook 的退出码与 stdout 都有语义：`UserPromptSubmit` 上非零退出会**清空用户的
prompt**，`Stop` 上非零退出会**阻止回合结束**，而 `UserPromptSubmit` 与 `SessionStart` 的
stdout 会被注入模型上下文。因此 wrapper 无条件静默并 `exit 0`。

所有 hook 显式设置 `timeout`（Claude Code 的 command hook 默认 600 秒）。`SessionEnd` 给
10 秒，因为它默认只有 1.5 秒预算，不足以覆盖 PowerShell 冷启动。dispatch 超时为 2 秒，实测
单次 hook 端到端约 0.25 秒。

未覆盖：Esc 打断与人工拒绝权限不产生任何事件（`PermissionDenied` 只覆盖 auto 模式的自动
拒绝）。这类残留由同会话下一次 `UserPromptSubmit` 覆盖，实测自愈窗口约 22 秒。
