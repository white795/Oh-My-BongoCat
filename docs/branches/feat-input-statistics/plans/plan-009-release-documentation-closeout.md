# Plan 009: Release Documentation and Ambient Position Closeout

- Status: completed
- Summary: [summary-009-release-documentation-closeout.md](../summaries/summary-009-release-documentation-closeout.md)

## Goal

在 `1.4.0` 连续两天真实使用未发现异常后，统一项目计划与当前发布状态，并把 Windows 已验证的
氛围灯窗口偏移正式回写 WSL 版本控制来源，为下一阶段升级建立可信基线。

## Scope

- 将氛围灯窗口偏移 `X=-420 / Y=10` 写入 WSL `ambient_runtime.rs`。
- 关闭已完成的 Plan 002 与 Plan 006，并补齐对应 Summary。
- 校正 Plan 007 中任务勾选、验证证据与已知限制，删除无法由当前仓库支持的历史测试声明。
- 更新 `todo.md`、Plan 008 已知限制和本阶段总结。

## Non-goals

- 不修改 relay、adapter、hook、named pipe、reducer 或前端状态机。
- 不处理尚未在真实使用中复现的 relay 同来源多 payload 风险。
- 不重新构建 Windows dev 或安装包；本阶段采用已经完成的两天真实使用验收结果。
- 不执行 Git commit、push、pull 或 Pull Request 操作。

## Tasks

1. [x] 对照 Windows 已验证实现，将窗口偏移以最小改动回写 WSL 主仓库。
2. [x] 更新 Plan 002 至 `1.4.0` completed，并新增 Summary 002。
3. [x] 将 Plan 006 的实机验收标记完成，并新增 Summary 006。
4. [x] 校正 Plan/Summary 007、Summary 008 与 `todo.md` 的状态和证据表述。
5. [x] 运行格式、相关轻量测试和最终差异检查，完成 Summary 009。

## Acceptance

- WSL 窗口定位行为与 Windows 已验证的 `X=-420 / Y=10` 一致，且不保留注释掉的重复函数。
- Plan 002、006、007、008 与 `todo.md` 对版本、状态和已知限制的描述一致。
- 文档不声明仓库中不存在的 relay 自动化测试或未经可靠采集的精确性能倍数。
- 相关测试、Rust 格式检查和 `git diff --check` 通过。
- 工作区仅包含本阶段代码与文档修改，可由用户单独提交并 push 到 fork。

## Risks / Dependencies

- `Y=10` 会将窗口从 work area 底边向下偏移；这是用户已经在 Windows 实机确认的正式位置。
- Windows 构建副本仍以旧上游提交为 Git 基线，后续只能按文件增量同步，不能整仓覆盖。
- relay 多 payload 风险没有在本阶段消失，只是因两天真实使用未复现而不作为发布阻塞。
