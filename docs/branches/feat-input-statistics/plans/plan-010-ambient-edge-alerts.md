# Plan 010: Ambient Edge Alerts

- Status: active
- Summary: pending

## Goal

保留现有底部星标作为低干扰的持续状态展示，同时在 agent 首次进入 WAITING 或 DONE 的状态
变换节点增加覆盖主显示器工作区边缘的瞬时强提示，让用户在浏览器、编辑器等其他页面工作时，
能通过余光注意到“需要介入”或“任务完成”。

## Context

- 当前 `ambient` 窗口固定为 `760 × 56`，适合持续显示多会话星标，但 WAITING 的红色光晕和
  DONE 的绿色涟漪都局限在 22px 星标附近，容易被忽略。
- 现有 reducer 已按 `session_id` 归约多会话状态，Rust runtime 是 accepted event、sequence、
  snapshot 发布和窗口显隐的唯一顺序源。
- 临时把现有星标窗口放大为全屏会导致星标跳位、窗口尺寸恢复竞态和动画定时器互相覆盖，
  因此强提示使用独立 renderer，不改变现有 `ambient` 窗口职责。

## Scope

- 新增一个预创建、默认隐藏的 `ambient-alert` Tauri 窗口。
- 窗口覆盖主显示器 **work area**，不覆盖任务栏；透明、无边框、置顶、鼠标穿透、不抢焦点、
  不进入任务栏。
- reducer 对每个 session 的真实状态迁移产生瞬时 alert：
  - 首次进入 WAITING → `waiting` alert；
  - 首次进入 DONE → `done` alert；
  - 重复 WAITING / DONE、WORKING、SessionEnd、TTL 和迟到事件不产生强提示。
- WAITING 使用琥珀红四边两次连续呼吸，DONE 使用薄荷绿四边单次扫过；中央区域保持完全透明。
- 强提示复用现有“Agent 氛围灯”总开关，不增加新的设置项。
- 动画结束后隐藏 `ambient-alert` 窗口；使用 generation 守卫防止旧回调隐藏新动画。
- 更新架构和操作说明，并在 Windows dev 中完成视觉与交互验收。

## Non-goals

- 不支持多显示器；V1 始终使用 `primary_monitor()` 的 work area。
- 不保证独占全屏游戏、受保护视频或特殊录屏/覆盖层环境中的显示层级。
- 不覆盖 Windows 任务栏，也不处理自动隐藏任务栏的特殊动画时序。
- 不增加声音、Windows toast、系统托盘闪烁或任务栏图标提醒。
- 不新增 error / interrupted 状态；现有 adapter 对事件的状态归一化保持不变。
- 不修改 Codex/Claude hooks、relay、PowerShell dispatcher、named pipe payload 或 reducer 的
  session/turn 语义。
- 不新增生产依赖；Windows 安装包仍由用户自行构建和安装。本计划在 dev 验收完成后按用户要求
  将应用与 Rust crate 版本统一为 `1.4.1`，但不代替用户执行发布构建。

## Design Decisions

### 独立窗口

```text
accepted AmbientEvent
        ↓
  AmbientReducer
    ├── snapshot ──→ ambient（现有星标窗口）
    └── alert ─────→ ambient-alert（新增瞬时边缘窗口）
```

- `ambient` 继续只负责常驻星标和 working 词语，不改变尺寸、位置或现有动画。
- `ambient-alert` 在应用启动时预创建并加载 renderer，避免首次 PermissionRequest 因 WebView
  尚未就绪而丢失动画；平时保持隐藏。
- 不按每条 alert 创建/销毁 WebView，避免首帧延迟和重复初始化成本。

### Alert contract

`ApplyResult` 增加可选的、不可持久化的瞬时结果：

```rust
alert: Option<AmbientAlertKind>

enum AmbientAlertKind {
    Waiting,
    Done,
}
```

- alert 只由 reducer 在 accepted event 上生成，renderer 不根据 snapshot 自行猜测状态迁移。
- 新 slot 直接收到 PermissionRequest 或 agent-turn-complete 时也产生对应 alert，以容忍此前的
  WORKING 事件没有到达。
- alert 不写入 snapshot，不会在窗口刷新、BongoCat 重启或 renderer 重连时重放。

### Priority and concurrency

- 优先级固定为 `Waiting > Done`。
- Waiting 可以中断正在播放的 Done；Done 不覆盖正在播放的 Waiting。
- 同类 alert 正在播放时忽略重复请求，不重置闪烁周期。
- 被 Waiting 抑制的 Done 不排队重放；常驻星标中的绿色 `✓` 仍保留完成信息。
- runtime 为每次真正开始的动画生成单调递增 generation。前端完成回调和 Rust 兜底定时器
  只有在 generation 仍为当前值时才能隐藏窗口。
- 关闭氛围灯时立即清空 active alert、推进 generation 并隐藏两个 ambient 窗口。

### Visual language

- WAITING：四边同时出现琥珀红光，两次连续呼吸，总时长 `2.8s`；使用对称缓入缓出曲线，
  避免减速后出现亮度跳变或停顿感。
- DONE：薄荷绿光带沿四边完成一次扫边并淡出，总时长 `1.8s`；柔化外层光晕与无模糊核心
  分层绘制，确保提高柔化程度时颜色仍清晰但不过亮。
- 只绘制四条边和角部扩散光，不铺中央遮罩，不显示文字或来源标识。
- CSS 使用四个 edge element 分别动画，避免依赖 WebView2 支持差异较大的复杂 mask 合成。

## Tasks

1. [x] Red：为 reducer 增加状态迁移 alert 测试，覆盖首次 WAITING/DONE、重复状态、迟到事件、
       SessionEnd、关闭状态和多 session 隔离；为优先级与 generation 协调器增加纯逻辑测试。
       测试先于实现写入；受 WSL 无 Rust 工具链及 Windows 构建边界限制，Red 编译未在本环境执行。
2. [x] Green：扩展 `ApplyResult` 与 runtime alert 协调逻辑，使 alert 只由 accepted transition
       产生，并实现 `Waiting > Done`、同类去重和 stale completion 防护。
3. [x] 在 Tauri 配置中新增隐藏的 `ambient-alert` 窗口；扩展 window label、前端启动分流、
       alert event 与完成 invoke，不改变现有 `ambient` 页面。
4. [x] 在 Rust runtime 中配置主显示器 work area 的位置与尺寸，设置透明/置顶/穿透/无焦点，
       实现 show、completion hide、关闭总开关和超时兜底。
5. [x] 新增 `src/pages/ambient-alert/index.vue`，实现 WAITING 四边两次连续呼吸、DONE 四边单次扫过、
       generation 重播与完成回调；开发期使用独立 HTML 快速确认动画参数，参数回写正式
       renderer 后已删除该临时文件，不纳入最终交付。
6. [x] Refactor：保持现有星标窗口与 bridge 不变，仅将 alert 协调逻辑提取为可测试的纯状态；
       不重构 reducer 之外的状态结构、现有星标组件或 bridge。
7. [x] 更新 `docs/architecture.md` 与必要操作说明；前端测试/构建、adapter 回归、shell 语法、
       配置解析、Rust 格式和 `git diff --check` 已通过。WSL 无 Rust 工具链且不替用户触发
       Windows 测试构建，因此未重跑 Rust 单元测试；Windows dev 已通过编译与实机行为验收。
8. [x] 仅将本计划涉及文件增量同步到 `D:\VibeTool\BongoCat`，由用户运行
       `pnpm.cmd tauri dev` 完成视觉、焦点、鼠标穿透和快速连续事件验收。
9. [ ] 用户确认 dev 验收通过，应用与 Rust crate 版本已统一为 `1.4.1`；待用户完成 Windows
       NSIS 构建、安装验收后创建 Summary 010，并更新本分支的 `../todo.md`。

## Acceptance

- WORKING 期间只显示现有底部星标，不出现大范围边缘提示。
- 任一 session 首次进入 WAITING 时，主显示器 work area 四边播放两次琥珀红连续呼吸；重复
  PermissionRequest 不重新播放。
- 任一 session 首次进入 DONE 时，四边播放一次绿色扫边；重复完成事件不重新播放。
- Waiting 动画可以中断 Done；Waiting 播放期间到达的 Done 不覆盖或延长 Waiting。
- 动画结束后 `ambient-alert` 窗口隐藏，不留下透明全屏窗口、常驻边框或输入阻挡。
- 快速连续 alert 下，旧 timer/completion 不能隐藏新一代动画。
- 氛围灯总开关关闭时两个 ambient 窗口立即隐藏，后续事件不显示星标或强提示。
- overlay 不抢焦点、不出现在 Alt-Tab/任务栏、不拦截鼠标，不打开偏好设置或创建第二个
  BongoCat 实例。
- 现有多 session 星标、working 词语、SessionEnd、TTL、主猫、输入捕获、统计与热力图无回归。
- 不修改或重新部署仓库外 hook/relay 文件。

## Risks / Dependencies

- 隐藏的第四个 WebView 会增加少量常驻内存；选择预创建是为了换取首个 alert 的确定性。
- 全 work-area 透明窗口在显示期间仍参与 Windows 合成，可能影响录屏/截图或产生瞬时 GPU
  开销；窗口只在短动画期间显示，dev 验收需观察是否存在可感知影响。
- Windows taskbar 和透明置顶窗口存在层级差异，因此 V1 使用 work area 而不是物理显示器边界。
- 前端动画完成回调可能因 renderer 异常丢失，Rust 必须保留带 generation 校验的超时兜底。
- 当前前端没有 Vue component test harness；动画像素与节奏采用 Windows dev 人工验收，状态
  迁移、优先级和 generation 逻辑必须放在可自动测试的 Rust/纯逻辑层。
- Windows 构建仍由用户在 `D:\VibeTool\BongoCat` 执行；WSL 不替代原生 dev 验收。

## Current Checkpoint

- WSL 实现、架构说明和 dev 验收说明已完成；Windows Tauri dev 已编译成功，功能与窗口行为
  验收未发现异常。
- 用户已在独立 HTML 中确认柔和参数：WAITING 强度 `0.78`、边缘宽度 `7px`、时长
  `2800ms`；DONE 外层强度 `0.65`、边缘宽度 `6px`、时长 `1800ms`；两者柔化均为 `3px`。
  WAITING 连续呼吸与 DONE 双层薄荷绿方案已回写正式
  renderer，两个正式源文件已增量同步到 Windows 构建副本；用户确认正式效果没有明显问题。
- 开发期独立 HTML 预览器已完成参数确认并删除，不纳入最终交付。
- 最终审阅为 renderer 增加 `nextTick()` 后的 generation 二次校验，避免极短间隔 alert 下旧
  payload 理论上覆盖新动画；该文件已重新同步至 Windows 构建副本。
- 3 个 Node 测试、Vite production build、Tauri JSON 解析、Windows `cargo fmt --check` 与
  `git diff --check` 已通过；Codex/Claude adapter 共 21 个测试及 integration shell 语法检查
  亦通过。Rust 单元测试未在本轮重跑，Windows dev 编译和实机验收已通过。
- 用户已确认正式效果无明显问题，并准备构建安装包；`package.json`、Rust crate 与应用锁文件
  已统一为 `1.4.1`，下一 gate 为用户执行 Windows `pnpm.cmd tauri build` 并安装验收。
