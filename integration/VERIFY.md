# BongoCat Ambient Relay 验证指南

## 快速验证

### 1. 检查 relay daemon 是否工作

```bash
cd /home/devuser/VibeTool/BongoCat/integration

# 检查 socket 是否存在
ls -la $XDG_RUNTIME_DIR/bongocat-ambient-relay.sock

# 如果不存在，启动 socket activation
systemctl --user start bongocat-ambient-relay.socket

# 验证 socket 状态
systemctl --user status bongocat-ambient-relay.socket
```

### 2. 发送测试事件

```bash
# 手动发送一个测试事件
python3 << 'EOF'
import socket
import base64
import json

sock_path = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
event = {"event": "UserPromptSubmit", "sessionId": "test-123", "turnId": "turn-456"}
payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.settimeout(1.0)
s.connect(sock_path)
s.sendall(encoded.encode("utf-8") + b"\n")
s.close()
print("✓ 事件已发送")
EOF
```

观察是否有 PowerShell 进程启动（immediate flush）：

```bash
# 在另一个终端监控
watch -n 0.5 'pgrep -a powershell'
```

### 3. 运行自动化性能测试

```bash
# 完整的性能监控脚本（30秒）
chmod +x verify-relay-performance.sh
./verify-relay-performance.sh

# 新旧架构对比
chmod +x compare-performance.sh
./compare-performance.sh
```

## 验证指标

### 成功标准

| 指标                    | 旧架构   | 新架构（目标） | 测量方法                      |
| ----------------------- | -------- | -------------- | ----------------------------- |
| PowerShell 进程频率     | ~12/秒   | <1/秒          | `verify-relay-performance.sh` |
| 事件延迟 (immediate)    | ~100ms   | ~100ms         | 主观感知（星星出现）          |
| 事件延迟 (low-priority) | ~100ms   | <2s            | debounce window               |
| 系统感知延迟            | 明显卡顿 | 无卡顿         | 主观感知                      |

### 手动监控 PowerShell 进程数

在一个终端持续监控：

```bash
# 实时计数
while true; do
    count=$(pgrep -f "powershell.*bongocat-ambient" | wc -l)
    [ "$count" -gt 0 ] && echo "$(date +%T) - PowerShell 进程: $count"
    sleep 0.5
done
```

在另一个终端正常使用 Claude Code，观察：

- **旧架构**：每次工具调用都会看到进程计数跳动，4 个并发 session 时可达到 10+
- **新架构**：每 2 秒最多出现 1 个进程，且很快消失

## 查看 daemon 日志

```bash
# 如果通过 systemd 启动
journalctl --user -u bongocat-ambient-relay.service -f

# 如果手动启动（调试模式）
# 修改 daemon 添加 logging，或者查看 stderr
```

## 故障排查

### Socket 不存在

```bash
# 检查 systemd 用户服务是否启用
systemctl --user list-sockets | grep bongocat

# 手动启动
systemctl --user start bongocat-ambient-relay.socket

# 查看错误
systemctl --user status bongocat-ambient-relay.socket
journalctl --user -u bongocat-ambient-relay.socket -n 50
```

### Daemon 启动失败

```bash
# 检查 Python 依赖
python3 -c "import socket, selectors, base64, json"

# 手动运行 daemon（调试）
python3 bongocat-ambient-relay

# 检查文件权限
ls -l bongocat-ambient-relay
chmod +x bongocat-ambient-relay
```

### PowerShell 脚本未找到

```bash
# 检查统一 dispatcher 是否存在
ls -l bongocat-ambient-dispatch.ps1

# 测试 wslpath 转换
wslpath -w "$(pwd)/bongocat-ambient-dispatch.ps1"
```

### BongoCat 收不到事件

检查 Windows 端：

```powershell
# 检查命名管道是否被监听
[System.IO.Directory]::GetFiles("\\.\\pipe\\") | Select-String "bongocat"

# 或者查看 BongoCat 日志
```

## 性能对比示例

### 预期结果

**旧架构（Plan 006）：**

```
监控 30 秒，4 个并发 session，每个 session 3 tool/秒
PowerShell 进程出现次数: 360
平均频率: 12.00 次/秒
✗ 性能未达标（目标 <1/秒）
```

**新架构（Plan 007）：**

```
监控 30 秒，4 个并发 session，每个 session 3 tool/秒
PowerShell 进程出现次数: 15
平均频率: 0.50 次/秒
✓ 性能达标（目标 <1/秒）
```

降低比例：**96% reduction** (12/s → 0.5/s)

## 压力测试

模拟极端场景（8 个并发 session）：

```bash
for session in {1..8}; do
    (
        for turn in {1..20}; do
            python3 << EOF
import socket, base64, json
sock = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
for event in ["PreToolUse", "PostToolUse"]:
    payload = json.dumps({"event": event, "sessionId": "stress-$session", "turnId": "turn-$turn"}).encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(1.0)
    s.connect(sock)
    s.sendall(encoded.encode() + b"\n")
    s.close()
EOF
            sleep 0.3
        done
    ) &
done
wait
```

监控系统负载：

```bash
# CPU 使用率
top -b -n 1 | grep powershell

# 进程创建速率
watch -n 1 'ps aux | grep powershell | wc -l'
```

## 回滚验证

确认回滚路径可用：

```bash
# 停止新架构
systemctl --user stop bongocat-ambient-relay.socket
systemctl --user stop bongocat-ambient-relay.service

# 验证旧脚本仍然工作
python3 << 'EOF'
import subprocess, base64, json
event = {"event": "UserPromptSubmit", "sessionId": "rollback-test", "turnId": "turn-1", "source": "claude"}
payload = base64.urlsafe_b64encode(json.dumps(event).encode()).decode().rstrip("=")
result = subprocess.run(
    ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
     "-File", "./claude-ambient-dispatch.ps1", "-Payload", payload],
    capture_output=True, timeout=5
)
print(f"Exit: {result.returncode}")
EOF
```
