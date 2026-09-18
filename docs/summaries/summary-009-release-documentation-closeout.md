# Summary 009: Release Documentation and Ambient Position Closeout

- Plan: [plan-009-release-documentation-closeout.md](../plans/plan-009-release-documentation-closeout.md)
- Status: completed

## Delivered

- 将 Windows 已验证的氛围灯窗口偏移 `X=-420 / Y=10` 正式写入 WSL
  `src-tauri/src/core/ambient_runtime.rs`，没有保留注释掉的重复函数。
- 将 Plan 002 更新到实际发行版本 `1.4.0` 并关闭，新增 Summary 002。
- 完成 Plan 006 多会话实机验收记录并关闭，新增 Summary 006。
- 校正 Plan/Summary 007 的任务、验证证据和限制，移除仓库无法支持的 relay 测试数量与精确
  性能倍数声明。
- 更新 Summary 008 与 `todo.md`，将 relay 多 payload 问题定位为尚未在真实使用中复现的
  已知风险，而非当前发布阻塞。

## Decisions

- 采用用户连续两天真实使用未发现异常作为 `1.4.0` 的最终功能验收依据。
- `Y=10` 虽会从 work area 底边继续向下偏移，但这是 Windows 实机确认后的正式产品位置。
- 本阶段不修改 relay；只有出现真实故障或未来进入相关代码修改时，才为多 payload 风险建立
  独立修复计划。
- WSL 仓库继续作为版本控制来源；Windows 构建副本只接受涉及文件的增量同步。

## Verification

- Codex 与 Claude adapter 共 21 个 Python 测试通过。
- 所有 `integration/*.sh` 通过 `bash -n` 语法检查。
- 使用现有 Windows `cargo.exe` 对 WSL `src-tauri/Cargo.toml` 执行 `cargo fmt --check`，通过且
  未触发编译。
- `git diff --check` 通过。
- 用户已在 Windows 安装版连续真实使用两天，主猫、输入统计、多会话氛围灯和 hook 链路均
  未发现异常。

## Known Limitations

- 本阶段没有重新构建或安装 Windows 包；窗口位置采用此前已通过的同值实机结果。
- relay daemon 仍缺少仓库内专用单元测试。
- 同一次 relay flush 含两个以上同来源 payload 时仍有 PowerShell 数组参数绑定风险；当前实际
  使用未复现，不阻塞本次提交。
