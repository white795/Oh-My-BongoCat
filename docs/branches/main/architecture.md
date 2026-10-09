# main 稳定架构与协作边界

[`white795/Oh-My-BongoCat`](https://github.com/white795/Oh-My-BongoCat) 的默认分支 `main`
承载个人已验收的 BongoCat 扩展版。功能迭代在独立任务分支进行，经审阅和相应验收后通过
本仓库 PR 合入；`master` 保留上游基线。当前状态和下一动作见 [todo.md](todo.md)，来源分支计划
作为历史记录保留，不直接充当 `main` 的活动计划。

## Agent 输入与显示

现有 WSL Agent 链路为 lifecycle hook → adapter → relay → PowerShell dispatcher → Windows
named pipe → BongoCat。安装包只提供接收和显示，不自动注册 hook 或安装发送器；接入与事件映射
见 [integration README](../../../integration/README.md)，仓库外运行副本见 [AGENTS.md](../../../AGENTS.md)。

BongoCat 内部统一维护多 Session 状态，再分发给星标、边缘提示及主模型。氛围灯与模型接管是
独立开关，任一开启即可维持接收。Codex legacy notify 仅负责 Windows toast，不再参与模型或
氛围灯结算；完成由 `Stop` 驱动，会话结束由 `SessionEnd` 移除。

## 角色状态与表现层

主模型生产链路固定为：

```text
Ambient snapshot -> CharacterPresentationController
                                       |
Keyboard press / semantic deadline -> CharacterStateCoordinator
                                       | CharacterStateUpdate
                                       v
                           MikuCatPresentationConsumer
                              |                 |
                        Live2D animation   Guitar / Angry effects
                        + completion       -> read-only Vue layers
```

仅内置 MikuCat 支持 Agent 接管。多 Session 按“任一 waiting → angry；否则任一 working → guitar；
否则 relaxed”归约。出现真实完成边沿且所有 Session 都为 done 时发出一次豆豆完成提示，允许
新工作或等待抢占；豆豆不是常驻角色状态。接管期间手动 Expression / Motion 不拥有控制权。

状态机负责输入语义、等待计时和意图；动画机负责动作编排、平滑切换与参数交还；特效机负责
音符和生气特效。统一输出契约为 `CharacterStateUpdate`，表现层不得反向定义语义状态。
生产接线共用 `performance.now()`，语义与特效各自最多维护一个 deadline timer。

## 发布与兼容边界

- WSL 与 Windows 目录和缓存保持现有约定；Windows 构建由用户执行，先 dev 验收，再生成安装包。
- GitHub 仓库改名不改变 `productName=BongoCat`、`identifier=com.white795.bongocat.stats`、
  named pipe、数据路径或本地工作目录；应用身份迁移必须单独确认。
- 代码使用 MIT，内置 MikuCat 运行素材使用其独立专有许可证。仓库公开不代表素材可自由复用。
- Windows 原生连接件只是被忽略的本地可选补丁，不纳入默认安装包，也不是当前 WSL 路径的依赖。

完整集成结果及验证记录见
[Summary 029](../feat-mikucat-state-machine/summaries/summary-029-mikucat-state-presentation-integration.md)。
