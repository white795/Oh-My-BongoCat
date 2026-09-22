# Project Documentation

本目录的项目记忆按 Git 分支隔离。根目录只提供入口：

- [架构与分支索引](architecture.md)
- [当前分支 Todo 路由](todo.md)
- [Summary 索引](summaries/index.md)

分支专用文档统一位于 `branches/<branch-slug>/`：

```text
branches/<branch-slug>/
├── architecture.md
├── todo.md
├── plans/
├── summaries/
└── reviews/        # 仅在该分支存在 review 时创建
```

`branch-slug` 使用实际分支名并把 `/` 替换为 `-`。计划与总结编号只要求在所属分支目录内唯一；
跨分支引用必须包含完整的分支目录路径。
