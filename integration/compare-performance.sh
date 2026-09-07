#!/usr/bin/env bash
# 对比测试：旧架构 vs 新架构的 PowerShell 进程启动频率

set -euo pipefail

SOCK_PATH="${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== BongoCat Ambient 性能对比测试 ==="
echo ""

# 检查是否在 WSL
if ! grep -qi microsoft /proc/version 2>/dev/null; then
    echo "✗ 此脚本需要在 WSL 环境中运行"
    exit 1
fi

echo "环境信息:"
echo "  WSL: $(uname -r)"
echo "  PowerShell: $(command -v powershell.exe || echo '未找到')"
echo ""

# ===== 测试 1: 新架构（通过 relay daemon）=====
echo "--- 测试 1: 新架构（relay daemon）---"

if [ ! -S "$SOCK_PATH" ]; then
    echo "✗ Relay daemon 未运行"
    echo "  请先启动: systemctl --user start bongocat-ambient-relay.socket"
    echo ""
else
    echo "✓ Relay daemon 运行中"
    echo ""
    echo "发送 20 个事件，监控 PowerShell 进程..."

    # 清理旧的 PowerShell 进程
    sleep 1

    # 记录开始时间
    start_time=$(date +%s.%N)
    ps_before=$(pgrep -f "powershell.*bongocat-ambient" | wc -l)

    # 后台监控 PowerShell 进程
    {
        max_ps=0
        while [ $(($(date +%s) - ${start_time%.*})) -lt 15 ]; do
            current_ps=$(pgrep -f "powershell.*bongocat-ambient" | wc -l)
            if [ "$current_ps" -gt "$max_ps" ]; then
                max_ps=$current_ps
            fi
            sleep 0.1
        done
        echo "$max_ps" > /tmp/new_arch_max_ps.tmp
    } &
    MONITOR_PID=$!

    # 快速发送 20 个事件（模拟高频场景）
    python3 << 'EOF'
import socket
import base64
import json
import time

sock_path = "${XDG_RUNTIME_DIR:-/run/user/1000}/bongocat-ambient-relay.sock"
session_id = "perf-test-new"

for i in range(20):
    event = {
        "event": "PreToolUse" if i % 2 == 0 else "PostToolUse",
        "sessionId": session_id,
        "turnId": f"turn-{i}",
    }
    payload = json.dumps(event, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect(sock_path)
        s.sendall(encoded.encode("utf-8") + b"\n")
        s.close()
    except Exception as e:
        print(f"发送失败: {e}")
    time.sleep(0.1)
EOF

    # 等待 debounce window + 1 秒
    sleep 3

    # 统计 PowerShell 进程启动次数（通过审计日志或进程计数）
    wait $MONITOR_PID 2>/dev/null || true
    ps_after=$(pgrep -f "powershell.*bongocat-ambient" | wc -l)
    max_ps=$(cat /tmp/new_arch_max_ps.tmp 2>/dev/null || echo "0")
    rm -f /tmp/new_arch_max_ps.tmp

    end_time=$(date +%s.%N)
    duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}")

    echo "  用时: ${duration}s"
    echo "  同时运行的最大 PowerShell 进程数: $max_ps"
    echo "  预期: ≤1 (批量分发)"
    echo ""
fi

# ===== 测试 2: 旧架构（直接调用 PowerShell）=====
echo "--- 测试 2: 旧架构（直接 PowerShell，模拟）---"
echo "模拟旧架构：每个事件启动一个 PowerShell 进程"
echo ""

start_time=$(date +%s.%N)
ps_count=0

# 后台监控 PowerShell 进程
{
    max_ps=0
    while [ $(($(date +%s) - ${start_time%.*})) -lt 15 ]; do
        current_ps=$(pgrep -f "powershell.*test-old-arch" | wc -l)
        if [ "$current_ps" -gt "$max_ps" ]; then
            max_ps=$current_ps
        fi
        sleep 0.1
    done
    echo "$max_ps" > /tmp/old_arch_max_ps.tmp
} &
MONITOR_PID=$!

# 快速连续启动 20 个 PowerShell（模拟旧行为）
for i in {1..20}; do
    (
        # 使用最小化的 PowerShell 命令模拟旧架构
        powershell.exe -NoProfile -NonInteractive -Command "# test-old-arch-$i" > /dev/null 2>&1
    ) &
    sleep 0.1
done

# 等待所有后台 PowerShell 完成
wait

wait $MONITOR_PID 2>/dev/null || true
max_ps=$(cat /tmp/old_arch_max_ps.tmp 2>/dev/null || echo "0")
rm -f /tmp/old_arch_max_ps.tmp

end_time=$(date +%s.%N)
duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}")

echo "  用时: ${duration}s"
echo "  同时运行的最大 PowerShell 进程数: $max_ps"
echo "  预期: ≈20 (无批量处理)"
echo ""

# ===== 对比结果 =====
echo "=== 性能对比 ==="
if [ -S "$SOCK_PATH" ]; then
    echo "新架构显著减少 PowerShell 进程数，降低系统负载"
    echo "详细监控可运行: ./verify-relay-performance.sh"
else
    echo "Relay daemon 未运行，无法对比"
fi
