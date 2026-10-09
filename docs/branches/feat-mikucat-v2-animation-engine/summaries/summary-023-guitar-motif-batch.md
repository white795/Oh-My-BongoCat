# Summary 023: Guitar Motif Batch

- Plan: [Plan 023](../plans/plan-023-guitar-motif-batch.md)
- Branch: `feat/mikucat-v2-animation-engine`

## Delivered

- 将 Motif 拆成独立动作模块、独立数据测试、公共类型和唯一注册表，开发菜单按 Profile 生成；
- 批量制作六个候选动作，并根据 Windows dev 反馈逐项重编具有清楚视觉锚点的
  `call-response-sway / syncopated-chord-walk / two-note-answer / tuning-listen / lazy-arpeggio`；
- 联同此前完成的 `immersed-double-nod / fretboard-slide-accent` 和 Plan 024 的 `sustain-sway`，冻结
  八项最终动作目录；
- 保留 `single-pick-ack` 实验模块和孤立 console 预览，但从冻结目录、开发菜单和未来规划器候选中
  排除。

## Decisions

- 动作资产先独立验收、再进行确定上下文验收，最后才允许规划器调度；不再把动作直接加入随机池；
- 最终目录固定为 `tuning-listen / lazy-arpeggio / sustain-sway / two-note-answer /
syncopated-chord-walk / call-response-sway / immersed-double-nod / fretboard-slide-accent`；
- 本计划结束后不再新增或重写动作主体。入口/出口问题归 Plan 021 连贯性阶段，状态资格、冷却与
  前后继归后续规划器阶段。

## Verification

- 各动作均经过数据测试和播放器运行时测试；需要重编的动作先以旧实现确认目标行为失败，再完成
  最小实现；
- Windows dev 已逐项确认八项最终动作的主体语义、幅度和自身循环观感；
- 最后一项 `lazy-arpeggio` 已确认四次轻拨可分辨、低头看弦和单侧慢弧线自然；
- 冻结目录测试确认仅保留八项，实验性 `single-pick-ack` 不再出现在目录中。

## Known Limitations

- 除已经验收的 `immersed-double-nod` 外，其余动作尚未完成人工 `A → Motif → A` 上下文验收；
- 当前动作目录仍是开发态能力，不代表生产规划器已经具备资格、合法前后继、冷却或历史规则；
- 特效机与真实状态总线接线继续等待动画规划器稳定，不属于本计划。
