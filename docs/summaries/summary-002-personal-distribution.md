# Summary 002: Personal Windows Distribution

- Plan: [plan-002-personal-distribution.md](../plans/plan-002-personal-distribution.md)
- Status: completed

## Delivered

- 使用 `com.white795.bongocat.stats` 隔离个人发行版身份，同时保留 `BongoCat` 显示名称。
- 移除自动更新运行时、更新端点、相关 UI 入口和 updater 打包产物。
- 应用与 Rust crate 版本统一为 `1.4.0`，并通过 Windows 原生工具链生成和安装 NSIS 包。
- 安装版保留输入统计、热力图和 agent 氛围灯，并通过 named pipe 支持管理员 BongoCat 接收
  普通权限 WSL agent 事件。

## Decisions

- Windows 构建固定在 `D:\\VibeTool\\BongoCat` 完成，WSL 仓库作为版本控制来源，两者只做
  涉及文件的增量同步。
- 固定采用“Windows dev 验收 → NSIS 打包 → 安装版验收”的发布顺序。
- 个人发行版不接入上游自动更新，后续升级继续由用户手动构建和安装。

## Verification

- Windows dev 与 NSIS 构建、安装均已完成。
- 管理员权限安装版可以通过 named pipe 接收普通权限 agent 的真实 hook。
- 用户完成连续两天真实使用，未发现输入统计、主猫、氛围灯或持久化异常。

## Known Limitations

- 安装包未签名，Windows 仍可能显示 SmartScreen 提示。
- Windows 构建缓存与安装产物不进入 Git；迁移环境时需要重新准备原生构建工具链。
