# Plan 007: WSL Ambient Relay Daemon

- Status: completed
- Summary: [summary-007-ambient-relay-daemon.md](../summaries/summary-007-ambient-relay-daemon.md)

## Goal

消除多会话高频工具事件下 PowerShell 冷启动造成的性能瓶颈。通过在 WSL 侧引入按需拉起的中继 daemon，将高频 hook 事件在本地聚合、去抖后批量转发到 Windows，把成本从"事件数量线性增长"改为"固定上限 + 与会话数无关"。

## Context

### 现状性能问题

Plan 006 实现多会话支持后，每个 hook 事件触发一次完整的跨界流程：

```
hook (bash) → adapter.py → wslpath → powershell.exe → named pipe → BongoCat
```

实测开销（WSL2 + Windows 11）：

- PowerShell 冷启动：80-200ms CPU 时间，~60MB 短暂内存分配
- WSL interop 开销：10-30ms
- 4 个并发会话，平均工具密集回合：~12 个 PowerShell 进程/秒
- 峰值观测（连续工具调用）：~18 个进程/秒

主要问题：

1. **成本线性增长** — 会话数 × 工具频率 = PowerShell 启动次数
2. **无效重复** — 200ms 内 10 个 `PreToolUse` 只是同一个 WORKING 状态的重复声明，但触发 10 次跨界
3. **以后无法控制** — 新增 hook 类型会进一步推高频率
4. **多线程 PowerShell 开销明显** — 用户实测 4 会话并发时有可感知的系统卡顿

### 为什么 BongoCat 不能做中继

BongoCat 是 Windows 进程，hook 从 WSL 跨到它的成本已经花完。中继必须在 WSL 侧，让 hook → 中继是廉价的本地 unix socket，只有中继 → BongoCat 才跨界。

### 为什么不是过滤方案（gate.json）

GPT 提议的 `gate.json` 方案只能减少"哪些 `PostToolUse` 需要转发"，但：

- 每个被转发的事件仍然要启动 PowerShell
- 无法处理高频 `PreToolUse` 连发
- 天花板是"减半"，不是"封顶"
- 需要跨进程文件状态同步 + 锁

而中继方案可以把任意数量的事件压成固定频率输出。

### 氛围灯是状态指示器，不是事件日志

这是设计的核心依据：

- 200ms 内 10 个 `PreToolUse` → 只需显示最后的 WORKING 状态
- 同一会话的过期 `turn_id` → 丢弃，只保留最新
- 状态是幂等的 — 最终一致即可，不需要严格事件顺序

去抖与合并在语义上完全正确，且不丢失任何用户可见状态。

## Scope

### Phase 1: 最小可测量原型（本计划范围）

实现 WSL daemon + systemd socket 激活 + 状态合并 + 优先级去抖，量化实际性能收益。

- **daemon**：Python，监听 unix socket (`/run/user/1000/bongocat-ambient-relay.sock`)
- **状态表**：按 `session_id` 聚合最新事件，丢弃过期 `turn_id`
- **优先级去抖**：
  - 立即 flush：`UserPromptSubmit`、`PermissionRequest`、`Stop`、`StopFailure`、`SessionEnd`
  - 2 秒窗口合并：`PreToolUse`、`PostToolUse`、`PostToolUseFailure`
- **批量转发**：`.ps1` 改为接受多个 Base64URL payload，在一个 PowerShell 进程内循环开 N 个连接写 pipe
- **systemd unit**：socket 激活，空闲 30 秒自动退出
- **bridge 更新**：`codex_ambient_adapter.py` 与 `claude_ambient_adapter.py` 改为写 unix socket，不再直接调 `wslpath` + PowerShell

**BongoCat 侧零改动** — pipe 协议、reducer、snapshot 格式全部不变。

### Phase 2: 常驻 PowerShell 子进程（非本计划）

daemon 维持一个长生命周期 PowerShell 子进程持有 pipe 连接，flush 时通过 stdio 传递 payload。需要 Rust 侧改成单连接上读多消息 + 重连处理。

只有 Phase 1 实测仍嫌贵时才做，成本是一个 idle PowerShell 常驻内存（~40MB）+ Rust 侧改动。

## Non-goals

- 不改变协议格式、序列化方式或安全约束（Base64URL + 4096 bytes 上限 + 本地用户 only）
- 不引入网络端口或远程访问
- 不改变 BongoCat reducer 逻辑、TTL 清扫或 snapshot 格式
- 不做子 agent 事件过滤（adapter 层已处理）
- 不做"只在有 BongoCat 运行时才转发"这类探测（fail-open 更可靠）
- Phase 1 不处理 PowerShell 子进程持有连接

## Design

### 架构

```
┌─ Codex hook ────────┐      ┌─ Claude Code hook ──┐
│ codex-ambient-hook  │      │ claude-ambient-hook  │
│        ↓            │      │        ↓             │
│ codex_ambient_      │      │ claude_ambient_      │
│   adapter.py        │      │   adapter.py         │
└─────────────────────┘      └──────────────────────┘
           │                            │
           └────────────┬───────────────┘
                        ↓
              unix socket (systemd 监听)
           /run/user/1000/bongocat-ambient-relay.sock
                        ↓
            ┌───────────────────────┐
            │  relay daemon (WSL)   │
            │  - 状态表 (sessionId) │
            │  - 优先级队列         │
            │  - 2s 定时器          │
            └───────────────────────┘
                        ↓
              flush_batch() 触发时
                        ↓
          ┌─────────────────────────────┐
          │ bongocat-ambient-dispatch   │
          │ .ps1 (改：接受多 payload)   │
          │  for p in payloads:         │
          │    open pipe, write, close  │
          └─────────────────────────────┘
                        ↓
            Windows named pipe (unchanged)
                        ↓
            ┌───────────────────────┐
            │ BongoCat ambient_pipe │
            │ (nMaxInstances=16)    │
            │ ↓                     │
            │ AmbientReducer        │
            └───────────────────────┘
```

### daemon 状态表

```python
state: Dict[str, PendingEvent] = {}
# key = session_id
# value = {
#   "event": "PreToolUse",
#   "sessionId": "...",
#   "turnId": "...",
#   "source": "codex",
#   "receivedAt": 1788420123.45
# }
```

新事件到达时：

- 若 `session_id` 已存在且 `turn_id` 更旧 → 丢弃（过期回合）
- 若 `turn_id` 更新或首次出现 → 更新状态表
- 若事件类型在 `IMMEDIATE_EVENTS` → 立即 `flush_batch()`
- 否则标记 dirty，等 2 秒定时器触发

`SessionEnd` 特殊处理：flush 后从状态表移除该 key。

### 优先级与去抖窗口

```python
IMMEDIATE_EVENTS = {
    'UserPromptSubmit',      # 新会话启动，用户期待立即看到星标
    'PermissionRequest',     # 红色等待，用户阻塞等这个信号
    'Stop',                  # 绿色完成，高交互优先级
    'StopFailure',
    'SessionEnd',            # 星标消失，立即反馈
}

LOW_PRIORITY_EVENTS = {
    'PreToolUse',            # 高频连发，只需最终状态
    'PostToolUse',
    'PostToolUseFailure',
}

DEBOUNCE_WINDOW = 2.0  # 秒，可调参数
```

定时器逻辑：

- 每 `DEBOUNCE_WINDOW` 秒触发一次
- 若状态表有 dirty 条目 → `flush_batch()`
- 否则不做任何事

### 批量转发协议

`bongocat-ambient-dispatch.ps1` 新增：

```powershell
param(
    [string[]]$Payloads,   # 数组，而非单个字符串
    [string]$PipeName = 'com.white795.bongocat.stats.codex-ambient'
)

foreach ($payload in $Payloads) {
    # 验证每个 payload
    if ([string]::IsNullOrWhiteSpace($payload) -or $payload.Length -gt 4096) {
        continue
    }

    $client = [System.IO.Pipes.NamedPipeClientStream]::new(...)
    try {
        $client.Connect(500)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $client.Write($bytes, 0, $bytes.Length)
        $client.Flush()
    } finally {
        $client.Dispose()
    }
}
```

daemon 调用：

```python
payloads = [serialize(ev) for ev in state.values()]
subprocess.run([
    'powershell.exe', '-NoProfile', '-File',
    dispatch_script, '-Payloads', *payloads
], timeout=10)
```

单次 PowerShell 启动，内部循环开 N 个连接。进程启动成本分摊到所有会话。

### systemd 单元文件

`~/.config/systemd/user/bongocat-ambient-relay.socket`:

```ini
[Unit]
Description=BongoCat Ambient Relay Socket

[Socket]
ListenStream=%t/bongocat-ambient-relay.sock
SocketMode=0600

[Install]
WantedBy=sockets.target
```

`~/.config/systemd/user/bongocat-ambient-relay.service`:

```ini
[Unit]
Description=BongoCat Ambient Relay Daemon
Requires=bongocat-ambient-relay.socket

[Service]
Type=notify
ExecStart=%h/.local/bin/bongocat-ambient-relay
Restart=on-failure
TimeoutStopSec=5

# 空闲 30 秒后自动退出
RuntimeMaxSec=30
```

daemon 启动时调用 `sd_notify("READY=1")`，systemd 确认拉起成功。

### adapter 更新

`codex_ambient_adapter.py` 与 `claude_ambient_adapter.py` 改为：

```python
def dispatch_to_relay(payload: str):
    sock_path = os.path.join(
        os.environ.get('XDG_RUNTIME_DIR', '/run/user/1000'),
        'bongocat-ambient-relay.sock'
    )
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.settimeout(1.0)
            s.connect(sock_path)
            s.sendall(payload.encode('utf-8') + b'\n')
    except (FileNotFoundError, ConnectionRefusedError, socket.timeout):
        # Relay 未运行或繁忙 — fail-open
        pass
```

移除 `_to_windows_path()` 与 `subprocess.run(powershell.exe)` 调用。

## Tasks

1. [x] 编写 `bongocat-ambient-relay` daemon（Python）：
   - unix socket 监听与按行解析 Base64URL payload
   - 状态表维护（session_id 聚合，turn_id 守卫）
   - 优先级队列 + 2 秒定时器
   - `flush_batch()` 调用更新后的 `.ps1`
   - `sd_notify` 集成
   - 空闲计数器（30 秒无事件 → 退出）

2. [x] 更新 `bongocat-ambient-dispatch.ps1`：
   - 支持 `-Payloads` 数组参数
   - 循环 `foreach` 开 N 个连接
   - 保持现有安全验证（长度 / Base64URL / pipe 名称）

3. [x] 更新 `codex_ambient_adapter.py` 与 `claude_ambient_adapter.py`：
   - `dispatch_to_relay()` 替换原有 `subprocess.run(powershell.exe)`
   - 移除 `_to_windows_path()` 依赖

4. [x] 编写 systemd 单元文件并完成手动安装：
   - `bongocat-ambient-relay.socket`
   - `bongocat-ambient-relay.service`
   - 使用 `systemctl --user enable bongocat-ambient-relay.socket` 安装 socket unit

5. [x] 运行既有 Codex / Claude adapter 回归测试，并完成人工 relay 链路验证。仓库未保留
       relay daemon 专用单元测试，这一点作为已知测试缺口记录，不补写不存在的历史测试结果。

6. [x] 完成任务管理器人工观察与连续两天真实使用验收，未再观察到原有 PowerShell 进程洪峰
       或可感知卡顿。未形成可复现的 P50 / P95 / P99 基准，因此不声明精确性能倍数。

7. [x] 安装并同步部署文件：
   - 复制 daemon 到 `~/.local/bin/`
   - 复制 systemd units 到 `~/.config/systemd/user/`
   - `systemctl --user daemon-reload && enable --now bongocat-ambient-relay.socket`
   - 验证 `systemctl --user status bongocat-ambient-relay.socket`
   - 文档更新（`integration/README.md`、`AGENTS.md`）

8. [x] 记录手动回滚路径（未编写自动回滚脚本）：
   - adapter 恢复直接调 PowerShell
   - `systemctl --user disable --now bongocat-ambient-relay.{socket,service}`
   - 移除 systemd units

## Acceptance Targets

以下数值是计划阶段的目标，不代表均已形成可重复的基准测试。最终关闭依据是 adapter 回归、
真实 lifecycle 功能验收、任务管理器人工观察，以及连续两天实际使用未发现异常。

- 4 个并发会话工具密集场景下，PowerShell 启动频率 < 1 次/秒
- daemon RSS < 20MB，空载 CPU < 1%
- `PermissionRequest` 到红星出现延迟 < 200ms（P95）
- `Stop` 到绿星出现延迟 < 200ms（P95）
- 普通工具事件合并后延迟 < 2.5 秒（2s 窗口 + 0.5s 传输）
- systemd socket 激活正常工作：首次事件自动拉起 daemon
- daemon 空闲 30 秒后自动退出，下一个事件自动重启
- daemon 崩溃后下一个事件由 systemd 自动恢复
- adapter fail-open：socket 不存在时静默退出，不影响 hook 成功
- Codex 与 Claude Code 的 12 个现有 Python 测试无回归
- BongoCat reducer 的 31 个 Rust 测试无回归
- 单会话、双会话、4 会话场景功能无差异
- 回滚到直接调 PowerShell 后行为恢复到 Plan 006 状态

## Risks / Dependencies

- **systemd 依赖**：要求 WSL2 + `systemd=true`。当前用户环境已确认可用。若用户迁移到 WSL1 或非 systemd 发行版，需回退到 hook 自举方式。
- **Python `sd_notify`**：需要 `systemd-python` 或手动实现。若不可用，降级为 `Type=simple`，失去"空闲退出"语义。
- **PowerShell 数组参数**：`-Payloads` 必须正确展开。实测需确认 `foreach` 循环行为。
- **事件延迟感知**：2 秒窗口对"星标启动"不适用，因此 `UserPromptSubmit` 必须立即 flush。若误归类会导致体验降级。
- **go-live 切换**：adapter 改动后，旧 hook 配置失效。需原子更新两侧文件 + 重启任意活动会话触发首次 socket 激活。
- **Phase 2 风险**：常驻 PowerShell 子进程若异常退出需重连，Rust 侧需处理 pipe broken。不在本计划范围。

## Planning Metrics

成功标准（Phase 1 vs 当前）：

- PowerShell 启动频率：~12/s → <1/s（10 倍以上改善）
- 系统可感知卡顿：有 → 无
- daemon 常驻开销：0 → <20MB（可接受）
- 关键交互延迟：无变化（< 200ms）

这些指标未全部通过自动化基准采集。实际采用标准是 PowerShell 进程洪峰与可感知卡顿消失；
若后续再次出现性能问题，再为常驻 PowerShell 子进程建立独立计划。

## Architecture Value

relay 将架构从"每个 agent 独立承担完整跨界链路"变为"adapter → relay → BongoCat"三层解耦：

- **adapter 层**（per-agent）：只负责从 agent stdin 提取 `session_id` / `turn_id` / `event`，
  序列化后写 unix socket。不关心跨界、合并、传输方式。
- **relay 层**（统一）：负责状态合并、优先级去抖、跨界传输。所有 agent 共享同一个 relay，
  新增 agent 不增加跨界成本。
- **BongoCat 层**（不变）：pipe 协议、reducer、snapshot 完全不变。

新 agent 接入成本从"adapter + wslpath + PowerShell 调用 + pipe 连接管理"降为
"一个往 socket 写 JSON 行的 Python 函数"。性能开销与 agent 数量解耦。

## Follow-ups

后续仅在真实使用再次发现性能或可靠性问题时考虑：

- Phase 2：常驻 PowerShell 子进程 + Rust 单连接多消息
- 去抖窗口可调参数（若 2 秒仍嫌长可改成 1 秒或 500ms）
- daemon 监控指标（处理事件数、flush 次数、队列深度）导出到 stdout 供调试

常驻 PowerShell 子进程需单独建立新计划，涉及 Rust 改动与重连逻辑；不复用已经用于 notify
解耦的 Plan 008 编号。
