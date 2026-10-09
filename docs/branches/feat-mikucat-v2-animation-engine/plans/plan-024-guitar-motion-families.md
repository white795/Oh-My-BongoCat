# Plan 024: Sustain Sway Closure

- Status: complete
- Summary: [Summary 024](../summaries/summary-024-guitar-motion-families.md)
- Branch: `feat/mikucat-v2-animation-engine`
- Parent: [Plan 021](plan-021-mikucat-v2-animation-engine.md)

## Goal

把已经实现的 `sustain-sway` 作为本阶段最后一个新增动作完成隔离视觉验收并冻结。验收后立即回到
既有动作收尾、上下文连续性和规划器接入，不再从候选动作池继续开发新 Motif。

## Scope

本计划只处理 `sustain-sway`：四拍中第一拍完成一次下拨，第二至第三拍保持持续音和同一和弦，身体
完成一次缓慢换重心，第四拍回收并继续保持头、耳朵和头发的轻微生命感。

此前列出的 `palm-mute-chug / gallop-chug / head-follow-fret / upstroke-pop / harmonic-ping /
triplet-burst / string-rake / pick-scrape / bend-and-release / compression-release / miss-and-correct /
overstrum-recovery / fake-ending` 仅保留为远期候选，不属于任何当前活动计划，也不作为规划器开始前的
前置条件。

不在本轮中：

- 不修改生产规划器、Profile 选择、状态总线或 cue 协议；
- 不新增第二个 ticker，不引入实时音频或声音；
- 不扩展 Motif 的吉他本体、拨弦自定义轨道或 additive mixer；
- 不调整已冻结的 A/A′、Cadence 和既有 Motif；
- 不一次性实现其余动作家族候选。

## Tasks

1. [x] 先写 `sustain-sway` 数据测试，固定单次起音、两拍保持、同一按弦姿态、身体单弧线、次级生命感
       和可循环边界；确认测试因动作模块不存在而失败。
2. [x] 新增独立动作模块并登记兼容导出、注册表、开发菜单顺序及隔离预览，不改变生产调度。
3. [x] 增加播放器循环边界回归，确认身体回程跨越四拍边界时不反弹，并运行定向测试。
4. [x] 已增量同步到 Windows 镜像；由用户验收单次起音、持续保持、慢摆辨识度及自身循环边界。
5. [x] 视觉验收通过后冻结 `sustain-sway` 并结束本计划；不从候选池选择下一个动作。

## Acceptance

- 开发菜单可选择 `AUTONOMOUS / SUSTAIN SWAY`，并只在下一乐句边界切换；
- 每四拍只有第一拍出现一次明确下拨，第二至第三拍不重复制造拨弦攻击；
- 按弦手在持续音中保持同一和弦，身体只完成一条可见的慢速左右换重心，而非逐拍脉冲；
- 头部、双耳与头发在持续段保留轻微余动，不能像动画停止；
- 第四拍进入下一轮时没有横向反弹、停顿或姿态跳变；
- 当前吉他本体仍继承隔离预览载体轨迹，实机需要明确判断其余动是否破坏“持续音”语义；
- 生产模板、现有动作和状态机行为保持不变。

## Risks / Dependencies

- 当前 Motif 契约不能直接编排吉他本体和自定义拨弦轨迹，因此 `sustain-sway` 的手部保持已实现，
  琴体仍可能保留基础载体余动；若实机观感不成立，应先扩展通道所有权，而不是继续堆关键帧；
- 自动化可以固定起音数量、保持区间和边界方向，但“长音是否有呼吸感”仍只能由 Windows dev 判断；
- 远期候选的调度时长与前后继约束不同；它们已经延期，不能为了复用当前四拍结构而在本阶段重新
  塞入普通 Motif；
- 新动作保持隔离预览，尚未验证 `A → Motif → A`，通过独立动作验收后才进入上下文编排。

## Verification

动作测试先因 `sustainSway.ts` 不存在按预期失败。最小实现后，动作数据、注册表和
`GuitarHandAnimation` 三项定向测试通过；循环回归覆盖第四拍末端到下一轮起拍的身体单向回程。
TypeScript、定向 ESLint 与 `git diff --check` 通过。10 个本轮文件已增量同步到 Windows 镜像并逐项
核对 SHA-256 一致。用户完成 Windows dev 隔离观察后确认可以进入下一个动作，Plan 024 至此完成；
上下文衔接仍统一留给 Plan 021。
