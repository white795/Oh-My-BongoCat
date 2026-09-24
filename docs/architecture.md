# Architecture Documents

架构、Todo、Plan、Summary 和 Review 按 Git 分支完整隔离，避免一条支线的目标、进度或产品边界
覆盖另一条支线。根目录文档只承担静态路由，不记录某一分支的动态进度。

| Git 分支                           | 分支文档入口                                                                                                           | 状态                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `master`                           | [branches/master/todo.md](branches/master/todo.md)                                                                     | 当前没有专用活动计划      |
| `feat/input-statistics`            | [branches/feat-input-statistics/architecture.md](branches/feat-input-statistics/architecture.md)                       | 已验证基线，Plan 010 开放 |
| `feat/mikucat-state-machine`       | [branches/feat-mikucat-state-machine/architecture.md](branches/feat-mikucat-state-machine/architecture.md)             | 状态机与特效支线，演进中  |
| `feat/mikucat-v2-animation-engine` | [branches/feat-mikucat-v2-animation-engine/architecture.md](branches/feat-mikucat-v2-animation-engine/architecture.md) | V2 动画机支线，演进中     |

进入任务前先用 `git branch --show-current` 确认分支，再读取对应目录中的 `architecture.md`、`todo.md`
和活动计划。目录名把分支名中的 `/` 替换为 `-`；新增长期分支时创建自己的目录，不把计划追加到
其他分支。既有编号保持不变，后续编号只要求在所属分支目录内唯一。

跨分支复用实现时，应使用带分支目录的明确链接，并确认目标分支是否仍接受来源文档中的边界；
不得把一条支线的新约束反向写成另一条支线已经实现的事实。分支合并工作使用目标分支中的独立
integration plan，来源计划作为历史记录保留。
