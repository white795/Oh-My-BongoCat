#!/usr/bin/env bash
# 验证 relay daemon 的性能改进：测量 PowerShell 进程启动频率

set -euo pipefail

SOCK_PATH="${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
LOG_FILE="/tmp/bongocat-relay-perf-$(date +%s).log"

echo "=== BongoCat Ambient Relay 性能验证 ==="
echo "日志文件: $LOG_FILE"
echo ""

# 1. 检查 relay daemon 是否运行
echo "1. 检查 relay daemon 状态"
if [ -S "$SOCK_PATH" ]; then
    echo "✓ Unix socket 存在: $SOCK_PATH"
else
    echo "✗ Unix socket 不存在: $SOCK_PATH"
    echo "  启动方法: systemctl --user start bongocat-ambient-relay.socket"
    exit 1
fi

# 2. 测试 socket 连接
echo ""
echo "2. 测试 socket 连接"
if timeout 1 bash -c "echo test > /dev/tcp/localhost/0 2>/dev/null" 2>/dev/null || true; then
    :
fi

# 使用 Python 测试实际连接
python3 << 'PYTHON_TEST'
import socket
import sys
sock_path = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
try:
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(1.0)
    s.connect(sock_path)
    s.close()
    print("✓ 可以连接到 relay daemon")
    sys.exit(0)
except Exception as e:
    print(f"✗ 无法连接: {e}")
    sys.exit(1)
PYTHON_TEST

if [ $? -ne 0 ]; then
    echo "  daemon 可能未启动，尝试触发 socket activation:"
    echo "  systemctl --user start bongocat-ambient-relay.socket"
    exit 1
fi

# 3. 发送测试事件
echo ""
echo "3. 发送测试事件到 relay daemon"
python3 << 'PYTHON_SEND'
import socket
import base64
import json

sock_path = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
events = [
    {"event": "UserPromptSubmit", "sessionId": "test-session-1", "turnId": "turn-1"},
    {"event": "PreToolUse", "sessionId": "test-session-1", "turnId": "turn-1"},
    {"event": "PostToolUse", "sessionId": "test-session-1", "turnId": "turn-1"},
]

sent_count = 0
for event in events:
    payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect(sock_path)
        s.sendall(encoded.encode("utf-8") + b"\n")
        s.close()
        sent_count += 1
    except Exception as e:
        print(f"✗ 发送失败: {e}")
        break

print(f"✓ 成功发送 {sent_count}/{len(events)} 个事件")
PYTHON_SEND

# 4. 监控 PowerShell 进程启动
echo ""
echo "4. 监控 PowerShell 进程（30秒）"
echo "   测量 relay daemon 的批量分发效果"
echo "   预期: 每 2 秒 flush 一次 (debounce window)"
echo ""

# 启动进程计数器（后台）
{
    start_time=$(date +%s)
    ps_count=0

    while [ $(($(date +%s) - start_time)) -lt 30 ]; do
        # 统计当前 PowerShell 进程数
        current_ps=$(pgrep -f "powershell.*bongocat-ambient-dispatch" | wc -l)
        if [ "$current_ps" -gt 0 ]; then
            ps_count=$((ps_count + 1))
            timestamp=$(date '+%H:%M:%S')
            echo "[$timestamp] PowerShell 进程: $current_ps" | tee -a "$LOG_FILE"
        fi
        sleep 0.5
    done

    echo "" | tee -a "$LOG_FILE"
    echo "=== 统计结果 ===" | tee -a "$LOG_FILE"
    echo "监控时长: 30 秒" | tee -a "$LOG_FILE"
    echo "PowerShell 进程出现次数: $ps_count" | tee -a "$LOG_FILE"
    echo "平均频率: $(awk "BEGIN {printf \"%.2f\", $ps_count/30}") 次/秒" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "目标: <1 次/秒 (Plan 007 要求)" | tee -a "$LOG_FILE"

    if [ "$ps_count" -lt 30 ]; then
        echo "✓ 性能达标" | tee -a "$LOG_FILE"
    else
        echo "✗ 性能未达标" | tee -a "$LOG_FILE"
    fi
} &

MONITOR_PID=$!

# 在监控期间持续发送测试事件
echo "   同时发送测试事件流（模拟正常使用）..."
sleep 2

for i in {1..10}; do
    python3 << 'PYTHON_BATCH'
import socket
import base64
import json
import time

sock_path = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"

# 模拟一个完整的 turn
events = [
    {"event": "UserPromptSubmit", "sessionId": "perf-test", "turnId": f"turn-{i}"},
    {"event": "PreToolUse", "sessionId": "perf-test", "turnId": f"turn-{i}"},
    {"event": "PostToolUse", "sessionId": "perf-test", "turnId": f"turn-{i}"},
    {"event": "PreToolUse", "sessionId": "perf-test", "turnId": f"turn-{i}"},
    {"event": "PostToolUse", "sessionId": "perf-test", "turnId": f"turn-{i}"},
]

for event in events:
    try:
        payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
        encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect(sock_path)
        s.sendall(encoded.encode("utf-8") + b"\n")
        s.close()
        time.sleep(0.2)
    except:
        pass
PYTHON_BATCH
    sleep 2
done

# 等待监控完成
wait $MONITOR_PID

echo ""
echo "5. 查看 relay daemon 日志"
if command -v journalctl &> /dev/null; then
    echo "   最近 20 条日志:"
    journalctl --user -u bongocat-ambient-relay.service -n 20 --no-pager || echo "   (无日志或服务未通过 systemd 启动)"
fi

echo ""
echo "完整日志已保存到: $LOG_FILE"
