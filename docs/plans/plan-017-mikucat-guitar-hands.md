# Plan 017: MikuCat Guitar Hand Loop

- Status: superseded
- Summary: pending
- Replaced by: [Plan 018](plan-018-mikucat-guitar-performance.md)
- Branch: `feat/mikucat-state-machine`
- Previous: [Plan 016](plan-016-mikucat-guitar-input.md)

## Goal

用户实机反馈固定往返僵硬，视觉验收未通过；本计划保留原实现与验证记录，由 Plan 018 的
演奏动画机替代，不标记为完成。下面描述的是被替代方案。

用户已确认吉他默认脸与鼠标解耦符合预期。本步只制作可手动验收的吉他手部循环，头发留待以后
研究模型升级，不同时编排头部、脸部或身体动作。

## Scope

- 仅写入 `ParamMouseX/Y`；X 为主要往返，Y 为弱辅助，沿用现有吉他手部绑定。
- 默认试调参数：900 ms 一轮，拨动占 40%、回程占 60%，X 幅度 12、Y 幅度 2，300 ms 起步。
- 选择内置 MikuCat 的“吉他”时开始；重复选择不重启；离开或销毁模型时停止并清理手部覆盖值。
- 参数集中在一个前端模块，方便 dev 调整；使用已有 Ticker，不新增定时器、依赖或配置界面。
- 不改表情素材、moc3/cmo3、physics、Rust、Agent 链路或其他模型行为。

## Tasks

1. [x] 最小失败测试与手部时间曲线、播放/停止接入。
2. [x] 目标测试、相关静态检查、增量同步 Windows 源文件。
3. [ ] 用户 dev 验收方向、幅度、节奏、循环衔接以及退出后恢复鼠标输入。

## Acceptance

- 吉他态自动循环，不依赖鼠标；头部中立、默认脸与眨眼保持前一步效果。
- 起步和循环接缝不跳变，重复选择不加速；切回其他表情或切换模型后没有残留写入。
- 现有两轴共同影响双手与吉他；不声称实现独立手指/手腕或完全静止的琴身。

## Risks / Dependencies

- 当前模型的变形绑定决定可实现的动作范围，数值检查不代表视觉上已像真实拨弦。
- Windows 画面与节奏由用户 dev 验收；助手不运行 Rust 编译或打包。
- 头发物理及模型升级不在本步处理，WAIT/DONE 与贴图仍不接入。

## Verification / Checkpoint

- `node --import tsx src/utils/guitarHandAnimation.test.ts`：最小初版 8 项中 6 项失败，实现后 8 项
  通过，覆盖起步、幅度、往返节奏、循环接缝、帧率、重复启动及停止后不再写入。
- `node --import tsx src/utils/modelMouseInput.test.ts`：7 项相关回归通过。
- 3 个相关 TS 文件 ESLint、新增动画模块与测试的定向 TypeScript 检查通过。
- 只增量同步 `live2d.ts`、`guitarHandAnimation.ts` 和对应测试到 Windows，逐文件内容比对一致；
  原 Windows live2d.ts 临时备份在 `/tmp/bongocat-guitar-hands-sync.rzi27r`。没有编译或修改素材。
- 动作调参集中在 `src/utils/guitarHandAnimation.ts` 顶部；当前等待用户通过现有吉他表情入口
  实机观察方向、幅度和节奏。数值测试通过不代表视觉效果已经验收。
