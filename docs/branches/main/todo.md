# Project Todo — main

## Current Focus

`main` 是个人稳定主分支，已从 `feat/mikucat-state-machine` 建立并推送，基线为 `99ffba6`，
应用版本为 `1.5.0`。模型状态、动画与特效的联合 Windows dev 验收已完成，用户已完成安装包构建；
详见 [Summary 029](../feat-mikucat-state-machine/summaries/summary-029-mikucat-state-presentation-integration.md)。

本轮补齐 `main` 文档入口、PR 协作约定及改名后的 README、下载与贡献说明，
不改运行代码、版本、应用身份或构建流程。
来源分支文档保留阶段历史，其“建立 main”等旧 Next Action 不作为本分支待办。

## Active Plan

暂无主线实施计划。稳定架构见 [architecture.md](architecture.md)，下一项功能应在任务分支立项。

## Repository Settings

2026-10-09 远端核对：仓库已改名为
[`white795/Oh-My-BongoCat`](https://github.com/white795/Oh-My-BongoCat)，默认分支已设为 `main`；
远端 `main` 与本地基线一致。WSL 仓库的 `origin` 已更新为新地址。
现有本地路径、BongoCat 应用名称及 `com.white795.bongocat.stats` 身份保持不变。

## Next Action

1. 用户提交并推送本轮文档收尾。
2. Windows 构建副本的 `origin` 仍为旧地址，用户可手动更新为
   `https://github.com/white795/Oh-My-BongoCat.git`；旧地址当前仍可访问，不需要重复制或重建仓库。
3. 后续功能从 `main` 建立任务分支，以本仓库 `main` 为 PR 目标，经用户审阅与相应验收后合入。

## Known Limitations

- 本仓库的下载、徽章与 PR 入口已对齐新地址；上游来源、社区、赞赏与贡献者致谢保留原链接。
- 2026-10-09 GitHub 公开 Release 列表为空，Issues 未开启。已验收的本地安装版本保持不变；
  发布 GitHub 附件或开启 Issues 需用户单独操作，贡献说明暂以 PR 和维护者联系为入口。
- `.github/workflows/sync-to-gitee.yml` 仍绑定 `master` 与 `ayangweb`；`upgradelink.yml` 的更新源仍是
  上游。CI/CD 是否启用、移除或改为个人发布配置需单独确认，不自动改为 `main` 触发。
- 安装包不自动注册 Agent hooks 或部署发送中间件，接入要求见 [integration README](../../../integration/README.md)。
- Windows 原生 Codex 连接件是被 Git 忽略的本地可选补丁，Windows 构建与远端真实 hook 验收仍未闭环，
  不阻塞当前稳定版；问题记录见 [Plan 030](../feat-mikucat-state-machine/plans/plan-030-windows-codex-bridge.md)。
