# Architecture Documents

架构说明按功能分支保存，避免仍在使用的旧产品边界被后续探索性支线覆盖。

| 分支                         | 架构文档                                                                                 | 状态             |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `feat/input-statistics`      | [architecture-feat-input-statistics.md](architecture-feat-input-statistics.md)           | 已验证基线，冻结 |
| `feat/mikucat-state-machine` | [architecture-feat-mikucat-state-machine.md](architecture-feat-mikucat-state-machine.md) | 当前支线，演进中 |

当前工作应读取与所在分支对应的架构文档。跨分支复用实现时，先确认目标分支是否仍接受原文档中
的边界，不把一条支线的新约束反向写成另一条支线已经实现的事实。
