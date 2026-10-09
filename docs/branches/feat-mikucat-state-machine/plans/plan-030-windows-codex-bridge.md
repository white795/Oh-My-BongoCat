# Plan 030 Windows Codex Hook Bridge

- Status: active（本地可选补丁，不属于主线）
- Summary: pending
- Baseline: `ffa4b6e` on `feat/mikucat-state-machine`

## Goal

提供可选的 Windows 原生 Codex hook 连接件，让 hook 把事件直接推给已运行的 BongoCat，
不经过 WSL。用户以对方 Codex app 的 hook 可用为本阶段前提；注册由远端 Codex 协助完成。

## Scope

代码、测试、独立 Cargo 配置和使用说明放在 `integration/windows-codex-bridge/`。
生成一个无常驻窗口的 `bongocat-codex-bridge.exe`：读取 stdin JSON，归一化、Base64URL 编码，
向当前 Windows 用户的既有 named pipe 写入单条消息后退出。连接预算沿用 500 ms。
正常 hook 模式静默并 fail-open，手动诊断模式报告错误阶段，不回显原始输入。

不加入 BongoCat 主 workspace 或默认安装包，不改主程序、WSL/Claude bridge、pipe 权限、
Agent 实际配置或版本号。不实现安装器、常驻服务、自动注册、notify 或 Claude 原生适配。
依赖只复用项目已有 JSON 库；主程序的 Cargo 配置与依赖锁保持不变。

## Distribution Gap and Patch Decision

已发布的 BongoCat 提供接收端，但不自带 Windows 原生 Codex hook 的发送器或注册规则。
因此只安装 BongoCat 并不能自动收到未接入 bridge 的 Windows Agent 状态；对方 hook 是否可用
仍是本计划的前提，而非已经完成的远端验证。

2026-10-09 用户决定将连接件作为本地可选补丁：整个 `integration/windows-codex-bridge/`
目录加入 `.gitignore`，不提交源码、依赖锁、测试或组件 README，不作为主线内容或发布阻塞。
本计划及分支文档只保存问题、边界与已有验证记录。忽略不会删除 WSL/Windows 本地文件，
但 Git 不再备份补丁，也不会通过 clone/pull 提供它；如需恢复或发给对方，须单独保留源码与 exe。

## Tasks

1. [x] 核对干净工作区、现有事件协议、发送方式和用户确认的独立组件边界。
2. [x] 先写行为测试，再实现六个 lifecycle 事件归一化、编码与输入校验；
       使用 BongoCat 真实 decoder 验证协议兼容，不另建状态归约器。
3. [x] 实现 Windows 当前用户 SID、named pipe 连接与单次写入，提供静默模式和手动诊断模式。
4. [x] 运行独立组件测试与格式/静态检查，完成构建、分发及远端注册说明。
5. [ ] 补丁的 Windows 与远端验收（操作说明见本地 `integration/windows-codex-bridge/README.md`，
       不随 Git 分发；这些验收不作为主线发布阻塞）。
   - [x] 增量同步独立目录的 9 个文件到 Windows 工作副本，并逐项核对内容一致。
   - [ ] 用户在 Windows 单独测试与构建 exe，验证普通权限连接管理员 BongoCat。
   - [ ] 将 exe 与说明交给远端，完成真实 hook 注册及工作/等待/恢复/完成/结束验收。

## Acceptance

- `UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse` 沿用同名协议事件；
  `Stop` 转为 `agent-turn-complete`，`SessionEnd` 转为 `session-end`，后者不要求 `turn_id`。
- 只转发 `event`、`sessionId`、`turnId`、`source=codex`；不转发提示词、工具参数、输出、
  transcript 路径、外部 sequence 或模型动画状态；legacy notify 不被接受。
- 编码消息不超过 BongoCat 的 4096 bytes 上限；无效输入不连接 pipe。
- BongoCat 未运行、权限/连接/写入失败时正常 hook 模式无输出、退出码为 0，不启动 BongoCat。
- 手动诊断区分输入、归一化、平台、身份、连接及写入结果；写入成功不被当作接收或画面成功的 ACK。
- 组件在完整工作副本中独立测试与构建，不参与主程序编译；协议测试直接引用真实接收器。
  生产构建不引入 Tauri、WebView、WSL、Python 或 PowerShell 转发依赖。
- Windows x64 构建及远端真实工作/等待/完成/会话结束验收另行确认；本地纯逻辑测试不代替该验收。

## Risks and Dependencies

- Codex app hook 的可用性是用户明确给出的前提，远端具体版本、信任审核和真实 payload 仍在
  使用阶段确认；缺失的非 SessionEnd `turn_id` 不自行猜测或伪造。
- 发送器与 BongoCat 必须运行在同一 Windows 用户下；复用既有普通权限到管理员 BongoCat
  的管道设计，不自动提权或扩大访问范围。
- Windows Codex app 的 `SessionEnd` 不由切换聊天立即触发；验收应使用实际结束行为。
- WSL 负责纯逻辑与 CLI 测试；Windows 编译和 Win32 IPC 实机验证由用户执行。
- 没有后台缓存或补发；BongoCat 未开启接收时事件不会保留，下一条真实 hook 才会再次推送。

## Verification

2026-10-09：归一化测试先因实现尚不存在而失败，CLI 诊断测试先因未报告失败而失败；补实现后：

- `cargo test --offline --locked --manifest-path integration/windows-codex-bridge/Cargo.toml`：
  Linux 下 50 项通过，其中 32 项是直接引用的 BongoCat 接收器回归，18 项覆盖连接件行为。
- 同一 manifest 的 `cargo clippy --offline --locked --all-targets -- -D warnings` 通过。
- 组件 6 个 Rust 文件的 `rustfmt --check --edition 2024 --config skip_children=true` 通过；
  跳过引用的子模块，未格式化或修改 BongoCat 接收器。
- 工作区差异检查通过；主程序、根依赖锁、应用版本及 WSL/Claude bridge 均未改变。
- 9 个新文件已同步至 `D:\VibeTool\BongoCat\integration\windows-codex-bridge`，逐项 `cmp` 一致；
  未复制 Linux `target`、未覆盖 Windows 已有源码/缓存，未修改实际 hook 配置或 Git 状态。

Linux 检查不编译 `cfg(windows)` 下的 Win32 发送器。Windows 编译、实际 IPC 与远端 Codex app
验收仍未执行，因此保持 active / Summary: pending；连接预算只约束连接等待，不承诺整个 hook
包含 stdin 读取与同步写入均在 500 ms 内完成。
