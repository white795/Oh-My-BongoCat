# Codex Ambient Bridge

该目录把 WSL 中的 Codex lifecycle hook 与 legacy notify 转换成最小事件，并发送给已经运行的
Windows BongoCat。它不是常驻服务，也不开放网络端口。

## Runtime flow

```text
Codex -> codex-ambient-hook.sh -> codex_ambient_adapter.py
      -> codex-ambient-dispatch.ps1 -> per-user Windows named pipe
      -> running BongoCat ambient runtime
```

BongoCat 必须已经运行并启用“Codex 氛围灯”。named pipe 不存在、功能关闭或输入无效时，
bridge 静默退出，不会启动 BongoCat，也不会让 Codex hook 失败。PowerShell client 不需要管理员
权限，因此普通 Codex 可以向管理员 BongoCat 推送事件。

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
- legacy `agent-turn-complete` → DONE → 5 秒后 IDLE

bridge 只转发 `event`、`sessionId` 和 `turnId`，不会转发 prompt、工具参数或输出。
payload 上限为 4096 bytes；pipe 拒绝远程客户端，并只允许创建它的 Windows 用户访问。
