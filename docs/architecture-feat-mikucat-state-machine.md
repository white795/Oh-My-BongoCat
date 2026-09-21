# Architecture — feat/mikucat-state-machine

## Branch Baseline

本支线从 `feat/input-statistics` 的提交 `bca8bb0` 分出，继承已经验证的输入统计、Codex/Claude
多 Session 氛围灯和边缘提示。旧架构保存在
[architecture-feat-input-statistics.md](architecture-feat-input-statistics.md)，本文只描述 MikuCat
支线有意改变或新增的边界。

## Product Direction

BongoCat 在本支线中从“输入事件驱动的桌宠，并附带彼此隔离的统计与 Agent 氛围灯”逐步演进为
“可以组合设备输入和 Agent 生命周期的状态化桌宠”。这项演进分成两个阶段：

1. 先把 MikuCat 作为独立、稳定的光标交互型 Live2D 模型接入原软件；
2. 第一阶段验收完成后，再让明确声明能力的模型消费现有 Agent 状态。

两个阶段必须独立验收。第一阶段不得为了尚未确定的 Agent 动画提前修改 hook、bridge、ambient
reducer 或现有氛围灯 renderer。

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

当前素材来源为 `mikucat-lived2d`（用户将新版 `test-2` 重命名为此目录），运行副本仍位于
`src-tauri/assets/models/mikucat`。同名 Windows 源目录也已更新为新版，不再是旧导出；不要按
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
放在 `guitarPerformance.ts`，由 `guitarHandAnimation.ts` 编排轻奏/常奏/强调/放松四种内部模式。
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
Agent 数据流。

## Guitar Mode State Machine / Presentation Engines Contract

吉他模式按“一个状态生产者、两个表现消费者”解耦。当前 Plan 019 音符实现是特效机的首个视觉
原型，但其中暂时混有输入窗口、休止判断和动画 phase 门控；这些语义在正式结构中归状态机，不能
继续由音符模块或页面维护。

动画机与特效机消费同一次状态归约结果，但彼此独立。动画机即使没有输入也持续维护时间轴、姿态、
速度和乐句；特效机维护音符及未来粒子、贴图、光晕等模型外实例。无输入显式表示为
`AUTONOMOUS`，不是控制权空档。输入停止先经过平滑释放再回到自治演奏，已有特效按各自 TTL
自然结束。

```text
KeyboardPress timing + mode lifecycle
        -> Guitar Mode State Machine
           ├── durable interaction snapshot
           └── transient performance cues
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      Animation Engine         Effect Engine
       Live2D parameters     DOM / Canvas / Sprite
```

边界固定如下：

- 状态机解释输入、时间和模式生命周期，只发送“持续状态 + 瞬时提示”，不写模型参数、不创建特效；
- 动画机按拍点或乐句边界平滑落实意图，是头、身体、耳朵、右手和吉他参数的唯一写入者；
- 特效机即时或延迟生成模型外视觉实例，负责颜色、轨迹、容量、TTL 和回收，不保存输入语义；
- 同一个 snapshot / cue 分别交给两个消费者；任一消费者的延迟或清理不阻塞另一方，两者不互调；
- 持续状态采用最新值覆盖，瞬时提示使用 sequence、冷却或合并规则防止重复和无限积压；
- 输入休止提示不等于动画停止，也不同于动画机内部名为 `rest` 的放松片段；
- 未来“生气”等状态中，Expression、耳朵和身体动作归动画机，烟雾、火花和外部气场归特效机；
  当前阶段只预留边界，不实现这些新 profile 或 Agent 映射。

具体交互状态、两类消费者契约、Plan 019 迁移范围和验收用例记录在
[Plan 020](plans/plan-020-guitar-mode-animation-contract.md)。该计划先在当前支线构建状态机与特效机，
动画机支线接口就绪后再接入第二个消费者；不提前接入 Agent 生命周期。

## Stage 2 Boundary: Agent State Integration

模型可用与实际动画分开验收：吉他脸部与输入解耦已通过，手部演奏动画机正在独立验收；其余动作、
复位和过渡仍按小步推进，再决定与 Agent 的映射。已有四个 Expression 不代表完整动画已验收。

第二阶段尚未进入实施。其稳定方向是复用现有 ambient 事件源和 Rust reducer，让主 Live2D
窗口成为新的接收方，而不是增加另一套 hook 或状态服务：

```text
Codex / Claude hooks
        -> existing named pipe and AmbientReducer
           ├──> ambient stars
           ├──> ambient edge alerts
           └──> model presentation controller（第二阶段）
```

只有显式声明 Agent 能力的模型才能响应该状态；旧模型必须继续保持原行为。多 Session 到单角色
的归约、持续状态与瞬时效果的优先级、Expression 映射和外部特效均留待第一阶段完成后单独设计，
不能在当前阶段当作已经确定或实现的事实。

## Compatibility and Release Boundary

- WSL 仓库负责代码与文档；Windows `D:\VibeTool\BongoCat` 负责 Tauri dev、Live2D 实机表现和
  安装包验收。
- 每个可独立观察的模型步骤先在 Windows dev 中验收；未通过 dev 前不生成安装包。
- 第一阶段不调整应用版本号，不触发安装包发布，也不修改仓库外 Codex/Claude 配置。
- 专有素材写入 Git 历史前必须确认目标远端的可见性；许可证限制复用，但不能阻止公开仓库中的
  文件被下载。
