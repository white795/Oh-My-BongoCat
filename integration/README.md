# Codex Ambient Bridge

该目录把 WSL 中的 Codex lifecycle hook 与 legacy notify 转换成最小事件，并发送给已经运行的
Windows BongoCat。它不是常驻服务，也不开放网络端口。

## Runtime flow

```text
Codex -> codex-ambient-hook.sh -> codex_ambient_adapter.py
      -> codex-ambient-dispatch.ps1 -> running BongoCat single-instance channel
```

BongoCat 必须已经运行并启用“Codex 氛围灯”。目标进程不存在、功能关闭或输入无效时，bridge
静默退出，不会启动 BongoCat，也不会让 Codex hook 失败。

## Codex configuration

四个 lifecycle hook 使用相同命令，并由 stdin 提供 Codex JSON：

```text
/bin/bash /home/devuser/VibeTool/BongoCat/integration/codex-ambient-hook.sh lifecycle
```

legacy `notify` 保持原有 `config.toml` 配置，由 `launcher.sh` 调用：

```text
/bin/bash /home/devuser/VibeTool/BongoCat/integration/codex-ambient-hook.sh notify "$JSON_DATA"
```

当前 wrapper 默认目标是：

```text
/mnt/d/VibeTool/BongoCat/target/debug/bongo-cat.exe
```

若改用安装版，应将 `CODEX_AMBIENT_BONGOCAT_EXE` 设为其 WSL 路径，或更新 wrapper 中的默认值。
dispatcher 会按完整路径匹配运行进程，因此路径必须与实际启动的 exe 一致。

## Supported events

- `UserPromptSubmit`、`PreToolUse`、`PostToolUse` → WORKING
- `PermissionRequest` → WAITING
- legacy `agent-turn-complete` → DONE → 5 秒后 IDLE

bridge 只转发 `event`、`sessionId` 和 `turnId`，不会转发 prompt、工具参数或输出。
