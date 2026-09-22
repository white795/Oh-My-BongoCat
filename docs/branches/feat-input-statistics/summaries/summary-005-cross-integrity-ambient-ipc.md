# Summary 005: Cross-Integrity Codex Ambient IPC

- Plan: [plan-005-cross-integrity-ambient-ipc.md](../plans/plan-005-cross-integrity-ambient-ipc.md)
- Status: completed

## Delivered

- 普通权限 WSL Codex 可以向管理员权限 BongoCat 推送氛围灯事件，无需提升 VS Code、Codex
  或每次 hook 启动的 PowerShell。
- BongoCat 内置当前用户专用的 Windows named pipe server；PowerShell 变为短生命周期 client，
  不再查询进程路径、依赖安装位置或启动第二个 BongoCat exe。
- 本计划的修复开发版本为 `1.3.1`；原 `--codex-ambient-event` single-instance 入口保留为
  兼容路径。最终集成发行版随后由 Plan 002 以 `1.4.0` 完成。

## Changes

- 新增 Windows-only `ambient_pipe` 模块，通过当前用户 SID 生成 pipe 名称与 DACL，并设置
  medium mandatory label、远程客户端拒绝及 4096-byte 接收上限。
- pipe 收到的 Base64URL payload 继续进入现有严格 schema 与 `AmbientRuntime::ingest`，状态机、
  sequence、stale DONE 和 DONE timer 没有改变。
- adapter/dispatcher 改用 `NamedPipeClientStream`，新增 pipe name 与 payload 边界校验；BongoCat
  未运行时短超时、静默退出。
- 更新架构、操作说明、Plan 002 状态及仓库外 `~/.codex/ambient` bridge 副本。

## Decisions

- 不采用管理员 VS Code/Codex 作为长期方案，避免扩大工具和扩展的管理员权限范围。
- 不通过 `RunAs` 为每个 hook 提权，避免重复 UAC 和 hook 超时。
- 不放宽 Tauri single-instance 的 `WM_COPYDATA` 消息过滤；使用具备显式 ACL、大小限制和
  local-only 策略的 named pipe 作为生产传输边界。
- pipe 名称附加 Windows 用户 SID，避免安装路径硬编码和不同用户间的名称冲突。

## Verification

- 先新增“无 exe 路径、使用 pipe 参数”的 adapter 测试并确认旧实现失败；实现后 7 个 Python
  adapter 测试全部通过。
- Python 编译、PowerShell dispatcher 解析、PowerShell client → 临时 named pipe 实际传输、
  Windows rustfmt、Cargo metadata `--locked --offline`、JSON/TOML 解析和 `git diff --check` 通过。
- Windows `pnpm.cmd tauri dev` 成功编译 production Rust 路径；首次发现的 `PWSTR` 错误类型转换
  已修复并重新编译通过。
- 用户实测管理员权限 BongoCat 可以接收普通权限 WSL Codex 的真实事件，确认跨完整性级别传输
  成功。

## Known Limitations

- 当前会话未单独运行 `cargo test`，因此新增的 Rust payload 上限单元测试尚未实际执行；
  production Rust 路径已由 Windows dev 编译并完成真实连接验证。
- 没有使用第二个 Windows 用户或远程客户端进行攻击面实测；当前结论依据 DACL、用户 SID 与
  `PIPE_REJECT_REMOTE_CLIENTS` 配置检查。

## Subsequent Closeout

- [Plan 002](../plans/plan-002-personal-distribution.md) 已以 `1.4.0` 完成 NSIS 构建、安装版
  跨权限 hook、统计持久化及连续两天真实使用验收。
