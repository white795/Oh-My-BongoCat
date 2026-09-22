# Plan 005: Cross-Integrity Codex Ambient IPC

- Status: completed
- Summary: [summary-005-cross-integrity-ambient-ipc.md](../summaries/summary-005-cross-integrity-ambient-ipc.md)

## Goal

让普通权限的 WSL Codex hook 能向管理员权限运行的 BongoCat 推送氛围灯事件，同时不提升
Codex、VS Code 或每次 hook 启动的 PowerShell 权限。

## Context

- `1.3.0` 安装版位于 `D:\\Bongocat\\bongo-cat.exe`，正式版氛围灯开关已启用。
- 用户实测：普通权限 Codex 无法触发管理员 BongoCat；从管理员 PowerShell 进入 WSL 后启动
  Codex 可以正常触发，确认阻塞来自 Windows 完整性级别差异。
- 当前 dispatcher 先通过 CIM 精确匹配进程路径，再启动第二个 exe，最终依赖 Tauri
  single-instance 的 Windows `WM_COPYDATA` 通道；这两处都会受跨完整性级别限制。

## Scope

- 在 BongoCat 进程内增加仅 Windows 启用的本机 named pipe server，不增加额外常驻程序。
- 普通权限 PowerShell 作为一次性 client，将现有 Base64URL normalized event 写入 pipe。
- 将 pipe 输入复用到现有严格事件解析和 `AmbientRuntime::ingest`，不改变 reducer、sequence、
  stale DONE 或 DONE 定时器行为。
- 保留 `--codex-ambient-event` single-instance 路径作为兼容入口，但生产 hook 改用 pipe。
- 本计划的修复开发版本使用 `1.3.1`；最终集成发行版后来由 Plan 002 以 `1.4.0` 完成安装验收。

## Non-goals

- 不让 Codex、VS Code、Windows Terminal 或 hook PowerShell 长期以管理员权限运行。
- 不开放 TCP/HTTP 端口，不允许远程 named pipe 客户端。
- 不传输 prompt、工具参数、命令、输出或任意可执行内容。
- 不改变 Live2D、输入统计、猫窗口或现有氛围灯视觉效果。

## Security Invariants

- pipe 仅允许本机当前 Windows 用户连接，并显式拒绝远程客户端。
- 每次连接最多接收一个有界 payload；超长、空值、非 Base64URL、未知字段和未知事件均拒绝。
- client 使用短连接与有界超时；BongoCat 未运行时 hook 静默成功退出且不得启动应用。
- pipe server 只产生 `AmbientEvent`，不能触发命令、文件访问或通用 Tauri invoke。
- 事件 sequence 继续只由 BongoCat reducer 生成。

## Tasks

1. [completed] 为 pipe 名称、payload 边界和 PowerShell client 行为添加最小失败测试。
2. [completed] 实现 Windows named pipe server、安全描述符和本地-only 接收循环。
3. [completed] 将合法 payload 解码后接入现有 `AmbientRuntime`；保留 CLI 兼容入口。
4. [completed] 将 dispatcher 改为短生命周期 named pipe client，移除 exe 路径和 CIM 依赖。
5. [completed] 更新 adapter 测试、文档和仓库外 `~/.codex/ambient` 副本。
6. [completed] Python、PowerShell client、格式和 Cargo metadata 检查已通过，源文件已增量
   同步，并由 Windows dev 成功编译。
7. [completed] 用户已在 Windows 以管理员 BongoCat、普通权限 Codex 完成 dev 跨权限连接验收；
   最终安装包构建与安装随后由 Plan 002 以 `1.4.0` 完成。

## Acceptance

- 管理员权限运行 BongoCat、普通权限运行 Codex 时，真实 hooks 能产生
  `working → waiting → working → done → idle`。
- 事件到达不弹 UAC、不打开偏好设置、不抢焦点、不创建第二个 BongoCat 常驻进程。
- BongoCat 未运行、氛围灯关闭或 payload 非法时，hook 静默退出且没有副作用。
- 非当前用户或远程客户端不能写入 pipe；超长 payload 不进入 reducer。
- 原 `--codex-ambient-event` 解析测试和现有 reducer 测试继续通过。
- 主猫、管理员输入捕获、统计持久化和氛围灯视觉没有回归。

## Risks / Dependencies

- Windows named pipe 的 DACL 与 mandatory integrity label 必须允许同一用户的 medium-integrity
  client 写入 high-integrity server，同时不能放宽给其他本地用户。
- WSL 不能直接打开 Windows pipe，仍需一次性 Windows PowerShell client；它不需要管理员权限。
- WSL 无法完成跨完整性级别实机验证，最终 gate 必须在 Windows dev 模式由用户执行。
