# Codex Ambient Bridge

Windows 原生 Codex 连接件仅作为本地可选补丁，`windows-codex-bridge/` 被 Git 忽略，不随仓库
或 BongoCat 默认安装包分发。缺少原生 hook 发送器与注册时，Windows Agent 不会自动接入；
问题与补丁边界见 [Plan 030](../docs/branches/feat-mikucat-state-machine/plans/plan-030-windows-codex-bridge.md)。
下文仍描述现有 WSL bridge，两条路径不互相替换。

该目录把 WSL 中的 Codex 与 Claude Code lifecycle hook 转换成最小事件，并发送给已经运行的
Windows BongoCat。它不是网络服务，也不开放网络端口。Codex legacy notify 不进入此 bridge，
只由 `~/.codex/launcher.sh` 保留原有 Windows toast。

## 接入前提与排查入口

当前维护者使用的是 WSL bridge，不是被忽略的 Windows 原生补丁。BongoCat 安装包仅提供
接收与显示；Agent hook 注册和 WSL 中间件部署是额外步骤，安装或更新主程序不会代替它们。

- Hook 注册位置：Codex 的 `~/.codex/hooks.json`、Claude Code 的 `~/.claude/settings.json`
  中的 `hooks`。事件与命令见下文对应配置章节，实际支持情况以所用 Agent 为准。
- 稳定运行副本：Codex 使用 `~/.codex/ambient/`，Claude Code 使用 `~/.claude/ambient/`；
  注册命令指向这些目录，而非会随开发移动的仓库路径。只 clone 仓库不会建立这些副本。
- 中间件：部署 `bongocat-ambient-relay` 与同目录的 `bongocat-ambient-dispatch.ps1`；
  按仓库 service 定义，relay 默认运行路径是 `~/.local/bin/bongocat-ambient-relay`。
  还需安装并启用 `bongocat-ambient-relay.socket` 用户单元，按需激活同名 service，
  并保证 Python 3 与 WSL 调用 Windows PowerShell 的能力可用。

排查先确认 hook 是否注册并触发、运行副本是否存在，再检查 relay socket/service 与日志，
随后检查 Windows named pipe 和 BongoCat 消费开关。接收器/协议分别在
[`ambient_pipe.rs`](../src-tauri/src/core/ambient_pipe.rs)、
[`ambient.rs`](../src-tauri/src/core/ambient.rs)；中间件源码在本目录。
仓库外 Agent 配置与对应运行副本清单见 [AGENTS.md](../AGENTS.md)；检查 Claude 配置时不要回显整份文件，
其中可能包含认证密钥。

## Runtime flow

```text
Codex/Claude Code lifecycle hook
      -> *-ambient-hook.sh -> *_ambient_adapter.py
      -> unix socket (/run/user/1000/bongocat-ambient-relay.sock)
      -> bongocat-ambient-relay (WSL daemon, systemd socket activation)
      -> bongocat-ambient-dispatch.ps1 (batched payloads)
      -> per-user Windows named pipe
      -> running BongoCat ambient runtime (multi-slot reducer)
```

relay daemon 在 WSL 侧按 `session_id` 聚合事件，优先级去抖后批量跨界传输。IMMEDIATE 事件
（`UserPromptSubmit`、`PermissionRequest`、`session-end`）立即 flush，LOW_PRIORITY 事件
（`PreToolUse`、`PostToolUse`）2 秒窗口合并。单次 flush 启动一个 PowerShell 进程处理所有
会话事件，进程启动成本与会话数量解耦。

BongoCat 必须已经运行，并开启“Agent 氛围灯”或“Agent 接管模型”至少一个消费者；后者只对
内置 MikuCat 生效，两个开关互相独立。named pipe 不存在、两个消费者都关闭或输入无效时，
bridge 静默退出，不会启动 BongoCat，也不会让 Codex hook 失败。PowerShell client 不需要管理员
权限，因此普通 Codex 可以向管理员 BongoCat 推送事件。

named pipe 支持最多 16 个并发实例。每次客户端连接后立即创建下一个 pipe 实例，消除了串行
模式下的无管道窗口——并发 agent 不再静默丢弃事件。

## Codex configuration

六个 lifecycle hook（`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、
`Stop`、`SessionEnd`）使用相同命令，并由 stdin 提供 Codex JSON：

```text
/bin/bash /home/devuser/.codex/ambient/codex-ambient-hook.sh lifecycle
```

legacy `notify` 保持原有 `config.toml → launcher.sh` 配置，但只显示 Windows toast。它不会调用
`codex-ambient-hook.sh`；这是有意的生命周期边界，因为 `/recap` 也会产生 notify，但并不代表
一个 agent 回合完成。

默认 pipe base name 是：

```text
com.white795.bongocat.stats.codex-ambient
```

Windows client 与 BongoCat 会分别附加当前用户 SID。可用 `CODEX_AMBIENT_PIPE_NAME` 覆盖 base
name 进行隔离测试；生产配置不依赖开发版或安装版 exe 路径。

仓库中的这三个 bridge 文件是版本控制来源；修改协议后需要增量复制到
`/home/devuser/.codex/ambient/`。`hooks.json` 只引用该稳定副本，不直接引用 BongoCat 仓库路径。

## Supported events

- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` → WORKING
- `PermissionRequest` → WAITING
- `Stop` → `agent-turn-complete` → DONE（常驻直到会话结束或 TTL 驱逐）
- `SessionEnd` → `session-end`，立即移除槽位

legacy notify payload 中同名的 `agent-turn-complete` 不再被 Codex adapter 接受。

Codex 的 `SessionEnd` payload 没有 `turn_id`。adapter 使用固定内部占位值
`__session_end__` 满足统一协议；该事件在 reducer 中只按 `sessionId` 删除槽位，不参与回合守卫。

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
