# Architecture — feat/mikucat-state-machine

## Branch Baseline

本支线从 `feat/input-statistics` 的提交 `bca8bb0` 分出，继承已经验证的输入统计、Codex/Claude
多 Session 氛围灯和边缘提示。旧架构保存在
[`feat/input-statistics` 架构](../feat-input-statistics/architecture.md)，本文只描述 MikuCat
支线有意改变或新增的边界。

## Product Direction

BongoCat 在本支线中从“输入事件驱动的桌宠，并附带彼此隔离的统计与 Agent 氛围灯”逐步演进为
“可以组合设备输入和 Agent 生命周期的状态化桌宠”。这项演进分成两个阶段：

1. 先把 MikuCat 作为独立、稳定的光标交互型 Live2D 模型接入原软件；
2. 在模型、吉他动画和音符原型边界明确后，让明确声明能力的模型消费现有 Agent 状态，并把
   角色状态机与表现层（动画机、特效机）分层。

两个阶段必须独立验收。第一阶段没有为了 Agent 动画修改 hook、bridge、ambient reducer 或现有
氛围灯 renderer；第二阶段继续复用这条已验证链路，只新增主窗口消费者和角色表现归约。

## Stage 1 Boundary: Model Integration

第一阶段的 MikuCat 是新增的内置可选模型，不替换现有 `standard`、`keyboard` 或 `gamepad`
模型。它以光标移动、鼠标点击、眨眼和模型物理为主要交互，不以键盘手部参数或按键贴图作为
完整性标准。

```text
Keyboard / Mouse -> rdev -> device-changed -> useDevice
                                      ├──> input statistics（保留）
                                      └──> useModel -> MikuCat / existing Live2D models
Controller       -> gilrs -> gamepad-changed -> existing gamepad behavior
```

第一阶段保持以下不变量：

- MikuCat 不订阅 ambient snapshot 或 alert。
- Codex/Claude hooks、WSL adapters、named pipe payload 和 Rust reducer 不变。
- 现有三种内置模型、自定义模型导入、输入统计和热力图不因新增模型改变行为。
- 模型缺少键盘专用手部参数或 `resources/*-keys` 时，键盘事件仍可被统计，但不强制产生模型动画。
- 主窗口的缩放、镜像、透明度、拖动、穿透、置顶和隐藏逻辑继续由现有窗口与模型设置控制。

## Model Identity and Interaction Mode

`ModelMode` 表示模型采用的输入映射类别，不应同时充当内置模型身份。MikuCat 与现有
`standard` 模型都可以属于标准交互类别，因此目标结构必须允许多个内置模型共享同一种 mode，
同时通过稳定的 preset key / slug 区分身份。

内置清单按 standard、keyboard、gamepad、mikucat 排序，以 `presetKey` 区分身份，随后保留
自定义模型。旧三个内置记录没有 presetKey 时，按历史唯一的 mode 识别并保留 ID；该回退不用于
MikuCat，也不匹配已有其他 presetKey 的记录。新建内置模型使用 `preset:<key>` 稳定 ID，已有
模型沿用其保存的 ID，因此快捷键不需要重新绑定。

初始化刷新内置资源路径，按原 ID 恢复当前选择，失效时回退原 standard 模型；不强制切换到
MikuCat。自定义模型路径和身份保持不变，手动导入版 MikuCat 与内置版可以并存，不自动合并。

## Asset Boundaries

MikuCat 素材分成两层，不能把编辑源文件等同于运行时资源：

- 设计源：拆分 PNG、完整预览图和 Cubism `.cmo3` 工程，用于修模和重新导出；
- 运行时：`.model3.json`、`.moc3`、纹理、physics、display info、Expression、封面及随附许可证。

只有运行时资源进入 Tauri 的 `assets/models` 打包范围。设计源是否保存在当前 Git 仓库由仓库
可见性和备份策略另行决定，但不得进入安装包。素材目录内的专有许可证优先于仓库根目录 MIT
许可证，且必须随被分发的运行时资源一起保留。

当前运行副本位于 `src-tauri/assets/models/mikucat`，Plan 029 已合入表现分支验收的 V2 moc3、
display info 与 physics，补齐独立头身、耳朵、双手和吉他通道；设计源 `mikucat-lived2d-v2` 仍被
Git 忽略。以下 Plan 015–019 的素材与原型说明保留为历史：原素材来源为 `mikucat-lived2d`
（用户将新版 `test-2` 重命名为此目录）。同名 Windows 源目录也已更新为新版，不再是旧导出；不要按
历史基线记录将它当成旧素材删除。`mikucat/` 是独立的拆分原画，保留为设计源而非重复模型。
新版源目录已补齐封面、许可证和语义名称，可以独立导入。
内置 model3 使用可读的表情 Name（默认、豆豆、生气、吉他），引用 `expressions/` 中稳定的英文
文件名；参数以新导出为基线，Plan 016 按用户要求将吉他脸部改为默认，保留手部与淡入淡出。
该 JSON 调整同时维护在源导出与内置副本，不反写 cmo3。表情面板优先显示语义名称，旧素材
的空名称、自动编号或 exp3 文件名仍回退为原本的本地化编号，快捷键继续按模型 ID 和表情索引
绑定。运行资源已经由内置清单引用，Windows 自动注册与重启保留仍待实机验收。用户要求的
一次性清理已移除 Windows 旧 MikuCat 导入副本及对应 dev 列表记录；不改变程序支持自定义导入的逻辑。

新版已在 moc3 和 cdi3 中修复为标准 `ParamMouseY`，临时别名兼容层及其测试已移除。
程序恢复直接读取/写入标准参数，角度、横向、镜像和数值换算不变；右键仍通过已有的
`ParamMouseRightDown` 驱动。旧导入副本不会自动升级，删除兼容后不再驱动其非标准 mouse-Y。
新右手的实际变形与新版表情组合需要 Windows dev 确认。

Plan 016 仅对内置 MikuCat 的吉他表情接管鼠标参数：进入时头手回中立，阻止鼠标移动/按钮写入，
退出时恢复后续输入。使用输入代次拒绝跨表情或模型切换后晚到的异步鼠标结果；不停止全局设备
监听、不改变统计与窗口操作、不修改用户的忽略鼠标设置。该步骤已由用户确认符合预期。

Plan 017 的固定手部循环视觉验收未通过，由 Plan 018 替代。新动画机将手部片段与乐句数据
放在 `guitarPerformance.ts`，由 `guitarHandAnimation.ts` 编排轻奏/常奏/强调/放松四种内部模式；
这套实现是动画机的前身，迁移完成后由表现层支线接管。
选句、节拍与力度只在句边界改变，动作承接当前参数位置和速度；不以每帧随机扰动代替动作设计。

仍通过既有 Ticker 驱动 `ParamMouseX/Y`；用户追加的头身编排通过 `ParamAngleX/Y` 执行每个
乐句的完整轨迹：轻奏/放松可停稳或微动，常奏分轻缓与活跃，重音短促下压后慢收，不要求每句
都左右大摆动。轨迹不被短手部片段重启，也不依赖手部随机偏置。
AngleX/Y 已能带动头、头发与部分身体；没有独立身体通道不等于现有变形幅度不足。
它们不带动琴与双手，故仍需验收相对姿态。默认脸、眨眼不改，不修改物理或素材，不做整模画布变换。
鼠标输入被接管期间仅缓存目标，退出短暂过渡到最新头手目标后恢复写入；快速重入取消退出，
销毁立即清理回调与输入代次。当前库外部覆盖在物理计算之后应用，头发惯性与演奏联动尚未打通；
先区分运行时顺序与模型变形缺口，再决定是否升级模型。未绑定 Agent 状态。

Plan 019 在上述吉他激活边界内复用现有键盘 press edge，向主窗口的独立 DOM 层发送不含键值的
触发信号。调度层限制 70 ms 最短间隔、6 个并发和 820 ms 生命周期；普通输入从 8 种基础符号
随机选择且不连续重复，滚动 3 秒输入计数达到 6 / 12 / 20 时按每 4 / 3 / 2 个可视音符提高
十六分音符占比。页面重置 1 秒停键计时器，到期从两种不连续重复的休止符中申请一次并清空乐句
强度。每个节点创建时一次性选定 10 组双色方案之一及 7 类路径之一且不连续重复；路径使用带正负
方向的局部 X/Y 坐标，只进入右上、右下、左下或近水平向右，明确排除左上第二象限。后续帧不再
随机。十一种图形未来可替换为自有素材而不改变输入或 Live2D 动画机。该层不写模型参数，退出
表情、切换模型和卸载时同时清理音符与休止计时器，不影响其他模型、输入统计、Rust 监听或
Agent 数据流。该原型及其内部输入语义的拆分现已整体移交表现层支线，本支线不再演进它。

## Mode State Machines / Presentation Layer Contract

本支线按“状态生产归状态机，视觉实现归表现层”解耦。Plan 019 的音符实现是特效机的首个视觉
原型，其中混有输入窗口、休止判断和动画 phase 门控；这些语义在正式结构中归状态机，视觉策略
归表现层支线，不能继续由音符模块或页面维护。

完整产品层是“Agent 与设备活动两个上层输入源 -> 分层意图状态机 -> 表现层”。Agent 决定角色
父模式和优先级，键盘/鼠标活动只能调节当前模式内部意图，不能与 Agent 竞争角色模式。原始光标
坐标仍可作为动画机的连续目标，但是否允许鼠标接管由状态机决定；高频坐标不进入语义归约器。
单调时间用于 deadline 归约，不构成第三个业务输入源。

表现层内部如何分工、动画机与特效机是否并列消费同一份输出，由表现层支线自行决定。状态机
只保证输出自足：消费者不需要回读状态机内部结构，也不需要自行判断静默时长或输入密度。无输入
显式表示为 `AUTONOMOUS`，不是控制权空档；输入停止先经过平滑释放再回到自治演奏。

```text
Agent mode + generation ────────────┐
Normalized device press ────────────┤
Monotonic time ─────────────────────┤
                                    ▼
                       Active Mode State Machine
                       ├── GUITAR: input interaction
                       ├── ANGRY: waiting escalation
                       └── durable snapshot + transient cues
                                      │
                                      ▼
                        presentation layer（表现层支线）
                     animation + effects, Live2D + DOM
```

边界固定如下：

- 状态机解释输入、时间和模式生命周期，只发送“持续状态 + 瞬时提示”，不写模型参数、不创建特效；
- 状态机 lifecycle 仅为 `INACTIVE | ACTIVE`；entering / playing / leaving 是动画机自己的播放 phase；
- 活跃度为 `AUTONOMOUS | ENGAGED | GROOVE | DRIVE`，停止趋势由独立 `releasing` 标记表达，不把
  `DECAY` 混入强度等级；
- 状态机不定义 Live2D 参数、音符、粒子、颜色、轨迹、容量或 TTL 的任何写入者；
- 持续状态采用最新值覆盖，瞬时提示使用 sequence、冷却或合并规则防止重复和无限积压；
- 输入休止提示不等于动画停止，也不同于动画机内部名为 `rest` 的放松片段；
- 未来“生气”等状态中，表情、耳朵、身体动作与烟雾、火花、外部气场如何分工由表现层决定。

纯 `GuitarInteractionMachine` 已固定首版输入语义：3 秒持续窗口、600 ms burst、6 / 12 次进入
GROOVE / DRIVE、较低退出阈值形成迟滞、400 ms 后进入 releasing、1 秒后只发一次 INPUT_REST，
ACCENT 至少间隔 1.2 秒。快照携带父级 generation、revision、activity 与 burst；每个 cue 有独立
sequence。退出 GUITAR 后旧 generation 的 press 或 deadline 均被拒绝。上述阈值是可集中调整的
首版基线，不属于动画曲线或音符样式。

纯 `AngryWaitingMachine` 只解释一段连续 `ANGRY` 生命周期与单调时间。进入时从 `ANNOYED` 开始，
8 秒升级为 `IMPATIENT`，25 秒升级为 `FURIOUS`；每次真实升级只发送一个带 sequence 与父级
generation 的 `ANGER_ESCALATED` cue。运行时只按 `nextDeadlineAt` 唤醒状态机，不能自行判断强度。
同一 generation 的重复激活不重置等待时长；只要全局始终存在 waiting Session，即使具体 Session
更换也视为同一段等待。退出后清空 deadline，重新进入使用新 generation 从头计时。漏唤醒并跨过
多个阈值时直接收敛到当前最终强度，只发送一次最终升级提示，避免补播过期表现。当前 Session
快照不携带 `waitingSince`，因此重启或延迟开启接管时从本地观察到 `ANGRY` 的时刻开始计时。

吉他状态机之上还有父级角色状态机。父级只读取现有 `AmbientSnapshot.sessions` 和独立的 Agent
接管开关，以 `WAITING > WORKING > RELAXED` 归约出 `ANGRY | GUITAR | RELAXED`；不得使用只代表
最近更新 Session 的顶层 `snapshot.state`。父级模式不变时 generation 不变，重复 hook 不能重启
动画。`done` 不成为稳定角色模式；当同一 `sessionId` 从 working / waiting 进入 done 且当前所有
Session 均为 done 时，父级只发出一次 `ALL_SESSIONS_DONE` cue，供动画机播放“默认 -> 豆豆 ->
默认”的一次性完成动画。重复 done、重连恢复、延迟接管和 SessionEnd / TTL 移除不重放该 cue。
父级为 `GUITAR` 时只激活吉他子状态机，为 `ANGRY` 时只激活生气等待子状态机；进入 `RELAXED`
或交还手动控制时两者均停用。切换模式后旧 generation 的输入、deadline 与提示全部失效。

纯 `CharacterStateCoordinator` 负责连接父级与两个子状态机，并统一输出父级快照、当前唯一活跃的
子快照、带来源的 cue 和该子状态机的 `nextDeadlineAt`。它只路由父级 transition、键盘 press 与
deadline 唤醒，不调用动画机或特效机。提供可选的 `CharacterStateDeadlineRuntime` 时，连接器根据
最新绝对 deadline 自持至多一个单次 timer；新 deadline 替换旧 timer，退出或销毁时取消，回调再由
token 与 generation 校验，避免迟到工作复活已经退出的模式。timer 只负责按时唤醒，状态含义仍完全
由两个子状态机决定，不存在持续轮询或第二份阈值。

角色控制权单独表示为 `MANUAL | AGENT`。Agent 接管关闭时仍缓存最新 Ambient 快照，但不改变模型；
开启时立即按当前快照接管，关闭时清理子状态与特效、恢复鼠标并交还默认手动态。手动 Expression
和 Motion 的真正拦截位于主窗口中央入口，偏好页禁用仅用于提示。氛围灯显示与模型接管是两个
独立开关，任一消费者开启时接收服务都必须继续维护 Session。

具体子状态、表现层消费契约、Plan 019 迁移边界和验收用例记录在
[Plan 020](plans/plan-020-guitar-mode-animation-contract.md)。该计划先构建父级角色归约与主窗口控制权，
再向下构建吉他与生气等待状态机；动画机与特效机的实现和接线由表现层支线承接。

合并前的开发职责按 worktree 隔离：`feat/mikucat-state-machine` 只负责父子状态机、控制权、语义时间与
公共输出契约；`feat/mikucat-v2-animation-engine` 作为表现层支线，同时负责两个同级消费者——
Live2D 动画机与模型外特效机——及其运行时接线。两侧只通过 Plan 020 的持续快照、瞬时提示和
deadline 契约对接；代码层唯一入口是 `characterStateCoordinator.ts` 导出的 `CharacterStateUpdate`，
表现层不得分别直连父级或任一子状态机。状态机 worktree 不继续拆分或改进特效机，也不修改动画机
内部实现。上述分工是合并前的 worktree 边界；Plan 029 已统一接线并完成联合 Windows dev 验收，
集成结果由目标工作树的 [Summary 029](summaries/summary-029-mikucat-state-presentation-integration.md) 记录。

## Integrated Presentation Runtime

Plan 029 将两侧实现整合为唯一的主窗口生产路径：

```text
Ambient snapshot -> CharacterPresentationController
                                      |
Keyboard press / semantic deadline -> CharacterStateCoordinator
                                      | CharacterStateUpdate
                                      v
                          MikuCatPresentationConsumer
                             |                  |
                             v                  v
                  Live2D animation hosts   Guitar / Angry effects
                  + completion gesture     -> read-only Vue layers
```

- Controller 负责能力、接管开关与手动仲裁；Coordinator 缓存父级归约结果并激活唯一子状态，
  不另行推导父级模式。每次 transition 都被转发，包括 mode 未变化但带 cue 的更新。
- Coordinator 与消费者使用同一 `performance.now()`；状态侧只按语义 deadline 唤醒，特效侧
  只按 TTL / cadence 唤醒，两侧各维护至多一个 timer，不再使用页面休止或逐音符 timer。
- 表现层拥有目标模式与实际入场之间的动画小状态机、安全边界和参数交还。实际入场通知只
  用于消费者内部延迟显示目标特效，不反向定义父子语义；旧 generation 的视觉实例立即清理。
- Agent 关闭后手动请求立即恢复可用，鼠标在退出动画完成后交还，避免退出时有两个参数写入者。
  手动 Expression 预览仍可播放对应动画，但不虚构 Agent 子状态或运行输入联动特效。
- 换模先交还旧控制权，再加载模型并从最新缓存快照接管；卸载取消监听及两类 timer、退订
  实际入场通知，并销毁 Live2D。异步加载晚于卸载完成时也销毁晚到资源。
- 开发态动画预览只在手动所有权下开放；生气特效调试只读统一消费者，不另建生命周期。
  `CharacterPresentationAdapter` 仅保留历史模块/测试，已无生产调用方。

## Stage 2 Boundary: Agent State Integration

模型可用、独立动画与最终状态接线分阶段验收，不以拥有四个 Expression 代替动画验收。
第二阶段已由 Plan 029 完成联合 Windows dev 验收；继续复用现有 ambient 事件源和 Rust reducer，
让主 Live2D 窗口成为新的接收方，不增加另一套 hook 或状态服务：

```text
Codex / Claude hooks
        -> existing named pipe and AmbientReducer
           ├──> ambient stars
           ├──> ambient edge alerts
           └──> model presentation controller（第二阶段）
```

只有显式声明 Agent 能力的内置 MikuCat 才能响应该状态；旧模型和自定义模型必须继续保持原行为。
多 Session 到单角色固定按“任一 waiting -> angry；否则任一 working -> guitar；否则 relaxed”归约。
`done` 不形成稳定角色模式，归入 relaxed；最后一个活跃 Session 完成时，角色归约器另行发出一次
带 ambient sequence 和 presentation generation 的 `ALL_SESSIONS_DONE` cue。这个 cue 与既有屏幕
边缘完成提示并行，专供角色动画机消费；Plan 029 已将该语义边沿接入豆豆完成动画。Rust
runtime 已拆成 indicator / presentation 两个独立消费者：任一开启
都维持同一个 reducer，snapshot 分别定向发布给氛围窗口和主窗口，只有 indicator 驱动边缘提示；
两者全关才清空 Session；Windows dev 已确认该拆分无异常。持久化接管字段与 command 默认关闭。
主窗口 Presentation Controller 已接入：监听建立后先恢复 snapshot，只有内置 MikuCat 可以获得
Agent 所有权，接管期间在中央入口拒绝手动 Expression / Motion，换模或关闭开关立即交还控制。
通用设置已增加默认关闭的“Agent 接管模型”开关。最初的薄适配器已由统一消费者替代，
Live2D 仍按内置 model3 的语义文件路径解析表情，不硬编码索引。`GUITAR` 和 `ANGRY` 锁定鼠标写入；
`RELAXED` 或交还手动控制请求退出并恢复默认表情，鼠标在参数交接结束后恢复。豆豆不是稳定态，
只由完成 cue 请求一次性动画，并允许新工作/等待抢占。两套外部特效已接入，联合实机验收见 Plan 029。

## Compatibility and Release Boundary

- WSL 仓库负责代码与文档；Windows `D:\VibeTool\BongoCat` 负责 Tauri dev、Live2D 实机表现和
  安装包验收。
- 每个可独立观察的模型步骤先在 Windows dev 中验收；未通过 dev 前不生成安装包。
- 第一阶段不调整应用版本号，不触发安装包发布，也不修改仓库外 Codex/Claude 配置。
- 专有素材写入 Git 历史前必须确认目标远端的可见性；许可证限制复用，但不能阻止公开仓库中的
  文件被下载。
