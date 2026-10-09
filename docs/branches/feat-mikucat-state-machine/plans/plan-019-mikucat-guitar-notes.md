# Plan 019: MikuCat Guitar Note Effect Prototype

- Status: completed（视觉原型已迁入正式特效机，生命周期由 Plan 029 联合验收闭环）
- Summary: [Summary 019](../summaries/summary-019-mikucat-guitar-notes.md)
- Branch: `feat/mikucat-state-machine`
- Depends on: [Plan 018](plan-018-mikucat-guitar-performance.md)

## Current Migration Status

[Plan 029](plan-029-mikucat-state-presentation-integration.md) 已将正式表现分支合入本工作树：
`GuitarNoteEffect` 及原型测试已移除，输入/休止由状态协调器归约，音符由独立 `GuitarEffectEngine`
生成并交给只读 Vue 层。页面休止、逐音符 timer 和动画 phase 门控不再存在；下面的原型实现与
数值记录保留为历史基线，不代表当前模块位置。2026-10-09 用户完成 Plan 029 联合 dev 验收，
确认关闭接管、切换模型、退出及重启后无残留；任务 6 至此关闭。正式路径只在 Agent 接管的
GUITAR 生命周期内生成输入联动特效，手动吉他表情仍可预览动画。

## Goal

在内置 MikuCat 的吉他表情期间，将真实键盘按下边缘显示为低负担的音符飘散效果，用来表达
“用户输入正在参与演奏”。先用可替换的内联 SVG 验证位置、节奏、密度和轨迹，不绑定正式素材。
本计划交付的是特效机的第一个视觉原型和行为基线，不把原型中的输入归约方式确立为最终架构；
状态机、动画机和特效机的正式边界由 [Plan 020](plan-020-guitar-mode-animation-contract.md) 建立。

## Scope

- 复用现有 `device-changed` 键盘事件及按键边缘去重，不新增 Rust 监听或保存具体键值。
- 仅内置 MikuCat 的吉他表情进入/演奏期间触发；其他模型和表情保持原行为。
- 十一种内联 SVG 中，单音、双音、强调音、全音符、二分音符、四分音符、和弦及三连音构成
  8 种随机基础池；四连十六分音符由 3 秒滚动输入强度分级增密，两种休止符只在连续 1 秒无输入
  后出现一次并结束当前乐句。同类基础符号和休止符不连续重复。
- 每次生成时从 10 组双色调色板和 7 类轨迹中抽取一次且不连续重复；轨迹只使用右上、右下、
  左下及近水平向右，明确排除容易穿过脸部的左上第二象限。
- 最短生成间隔 70 ms、最多同时 6 个、约 800 ms 自动移除；退出表情、切换模型或卸载时清理。
- 图形与调度数据分离，后续可替换为自有 PNG/WebP/SVG 素材而不重写输入链路。
- 不增加声音、设置项、依赖、Live2D 参数、Agent 信号或仓库外配置。
- 为了先验证视觉，当前原型允许输入强度、休止判断和音符生成暂时共处；该耦合是已知迁移项，
  不是后续状态机或特效机应复制的目标结构。

## Architectural Handoff

当前实现同时包含三类职责：

- `guitarNoteEffect.ts` 中的 `recentPresses`、`lastInputAt`、`restEmitted` 和强度窗口属于状态机语义；
- 同一文件中的符号、调色板、轨迹、70 ms 视觉节流、6 个容量及 820 ms 生命周期属于特效机；
- `index.vue` 中的 1 秒休止计时和 `live2d.isGuitarPerforming` 门控把页面与动画机阶段耦合在一起；
  `GuitarNoteLayer.vue` 已基本是只消费音符描述的渲染层。

Plan 020 只固定状态语义与输出契约；实际拆分由 `feat/mikucat-v2-animation-engine` 表现层支线的
后续计划执行。迁移完成后，Plan 019 保留下来的不是上述耦合，而是已经通过观察的视觉行为：十一种符号、
十组双色高光、三象限轨迹、输入越密集十六分音符越多、停键后只出现一次休止符，以及并发和
生命周期上限。输入历史、活跃度、吉他模式生命周期和“是否应产生休止”迁入状态机；音符实例、
随机视觉属性、显示节流、容量和回收迁入特效机。动画机不参与音符生成。

## Tasks

1. [x] 用纯逻辑测试基础轮换、输入强度、停键休止、生成时随机、节流、容量和清理行为，并确认
       旧实现不满足。
2. [x] 接通去重后的键盘按下信号及吉他激活边界。
3. [x] 增加独立音符渲染层和十一种双色内联 SVG，完成定向验证。
4. [x] 增量同步 Windows 并核对内容一致。
5. [x] 用户在 Tauri dev 中验收符号/颜色随机性、三象限轨迹、输入强度和停键休止的观感。
6. [x] 补齐切回普通表情、切换模型及页面卸载时不残留音符或计时器的生命周期验收记录。
7. [x] 记录当前原型耦合，并将状态归约与特效播放的拆分移交 Plan 020。

## Acceptance

- 吉他表情下每次真实按键边缘最多生成一个音符；系统长按重复不会形成无界喷射。
- 普通输入从 8 种基础音符随机抽取且不连续重复；3 秒内输入达到 6 / 12 / 20 次后，十六分音符
  分别按每 4 / 3 / 2 个可视音符出现，输入越密集占比越高。
- 最后一次输入满 1 秒后只显示一个休止符；两种休止符不连续重复，恢复输入后开启新乐句且不
  沿用上一段输入强度。
- 每个符号从 10 组双色方案和 7 种路径中生成且不连续重复；路径不得进入模型局部坐标的左上
  第二象限。任意时刻不超过 6 个，主 Live2D 动画和输入统计不受影响。
- 切回其他表情、切换模型或销毁页面后不残留音符或计时器。
- 普通 MikuCat 状态及其他模型输入时不显示音符。
- Windows dev 视觉验收确认音符从吉他附近出现，不明显遮脸，缩放和镜像下仍可接受。

## Risks / Dependencies

- 首版锚点基于当前 MikuCat 画布比例，最终位置仍需 Windows dev 观察调整。
- SVG 仅用于快速验证，视觉通过不代表正式素材已定稿。
- 快速输入必须节流并限制存量；不能把每次系统 repeat 都渲染为新节点。
- 输入强度阈值是首版可调参数，最终密度仍需根据真实打字节奏观察。
- 当前 `GuitarNoteEffect` 不是最终特效机接口；Plan 020 拆分时必须保留已验收视觉，但不得继续让
  特效模块保存输入语义或依赖动画机内部阶段。
- Windows dev/编译由用户执行；本计划不操作 Git 写命令。

## Implementation / Verification

- `useInputStatistics` 将既有边缘分类结果返回给 `useDevice`；页面只收到不含键值的
  `onKeyboardPress` 回调。原有统计缓冲、Windows fallback release 和按键贴图处理顺序不变。
- `live2d.isGuitarPerforming` 仅在吉他动画 `entering` / `playing` 阶段为真；退出表情时立即停止
  生成并清理已有音符。切换模型及页面卸载也清理所有计时器。
- `guitarNoteEffect.ts` 负责 8 种随机基础符号、3 秒输入强度分级、两种 1 秒停键休止、10 组双色
  调色板与 7 类三象限轨迹，以及 70 ms 节流、最多 6 个和 820 ms 生命周期。符号、调色板及轨迹
  都避免连续重复；随机源可注入测试，单个音符生成后不再逐帧抖动。`index.vue` 只持有可取消的
  休止计时器；切换状态时和音符一起清理。`GuitarNoteLayer.vue` 负责十一种内联 SVG 与分段 CSS
  轨迹。镜像时轨迹跟随模型，音符图形反向补偿。
- 新增调度测试在实现前因模块不存在而失败，宿主状态测试因没有吉他激活接口而失败；实现后
  3 项音符调度、3 项吉他宿主和 4 项输入边缘测试通过。五种符号扩展先由旧实现产生预期失败，
  实现后 3 项音符调度测试、定向 ESLint、TypeScript 和仓库内 Vite 生产构建通过；构建仅有既有
  动态导入与 chunk 大小警告。
- 8 个源码/测试文件已增量同步 `D:\VibeTool\BongoCat` 并逐文件比对一致；同步前确认 Windows
  只缺本轮差异，旧版备份为 `/tmp/bongocat-guitar-notes.8uZfic`。未同步 WSL 文档，未运行
  Windows dev、Rust 编译或安装包构建，最终位置和观感等待用户验收。
- 五种符号、随机颜色与扩展轨迹只涉及 3 个音符文件，已再次增量同步并核对 SHA-256；覆盖前
  Windows 旧版备份为 `/tmp/bongocat-guitar-notes-expanded.LQnQCf`。尚未由助手运行 Windows dev。
- 语义状态机先得到 3 项预期失败；实现后 5 项调度测试、定向 ESLint、TypeScript 和 Vite 生产
  构建通过，构建仍只有既有动态导入与 chunk 大小警告。
- 状态机、左右轨迹及页面休止计时器涉及的 3 个文件已增量同步 Windows 并核对 SHA-256；覆盖前
  备份为 `/tmp/bongocat-guitar-note-state.z3JMSd`，尚未运行 Windows dev。
- 扩充符号、双色调色板和排除第二象限的测试在旧实现上得到 2 项预期失败；实现后 5 项调度测试、
  定向 ESLint、TypeScript 和 Vite 生产构建通过，构建仍只有既有动态导入与 chunk 大小警告。
- 本轮 3 个音符调度/渲染文件已增量同步 Windows 并核对 SHA-256；覆盖前备份为
  `/tmp/bongocat-guitar-note-variety.Za6qma`，尚未运行 Windows dev。
- 用户随后已在 Windows dev 中确认扩充后的音符种类、双色高光、输入联动和三象限轨迹观感
  满意；当时尚待补齐的完整退出清理由 Plan 029 联合 dev 验收完成。当前正式状态到特效的
  接线、单次休止、模式退出、换模及重启联动均已通过，详见本计划 Summary。
