# Source Review 001: Input Statistics

- Date: 2026-08-12
- Scope: Phase 1 源码审查
- Result: 可以实施；本阶段未修改业务代码
- Plan: [plan-001-input-statistics.md](../plans/plan-001-input-statistics.md)

## 1. Executive Conclusion

最小侵入方案是以 TypeScript 为主、Rust 仅补持久化容错的分层实现：

1. 在现有 `useDevice` 和 `useGamepad` 事件监听器入口旁路记录统计。
2. Statistics Core、日期聚合、Pinia store 和设置页 UI 放在 TypeScript。
3. 复用项目已安装的 `@tauri-store/pinia`，生成独立的本地 `statistics` JSON store。
4. 使用内存增量缓冲和周期性合并，避免每个输入都做 IPC 或写盘；磁盘保存使用 throttle，并保留退出时尽力 flush。
5. 只在设置页增加 Statistics，不修改 `src/pages/main/index.vue` 的模板或桌宠外观。

不建议把 Statistics 放进 `useModel`：该位置只看到模型支持或转换后的按键，会漏掉真实输入，并把统计与动画语义耦合。

## 2. Existing Input Chains

### Keyboard

```text
OS global hook
  -> rdev::listen
  -> EventType::KeyPress / KeyRelease
  -> DeviceEventKind::KeyboardPress / KeyboardRelease
  -> app.emit("device-changed")
  -> useDevice listener
  -> getSupportedKey / Windows auto release
  -> useModel.handlePress / handleRelease
  -> modelStore.pressedKeys
  -> main page watcher
  -> Live2D hand state / key image
```

Evidence:

- Rust 入口与事件映射：`src-tauri/src/core/device.rs:24-60`
- 前端监听与模型调用：`src/composables/useDevice.ts:186-219`
- 主窗口启动监听：`src/pages/main/index.vue:31-42`
- 最终按键贴图与手部状态：`src/pages/main/index.vue:102-112, 200-205`

`getSupportedKey` 会将不受模型支持的功能键或修饰键归一化。统计应在它之前接入，否则计数取决于当前模型资源，而不是用户输入。

### Mouse

```text
OS global hook
  -> rdev::listen
  -> ButtonPress / ButtonRelease / MouseMove
  -> MousePress / MouseRelease / MouseMove
  -> app.emit("device-changed")
  -> useDevice listener
  -> button: useModel.handleMouseChange
  -> move: Pixi ticker smoothing -> useModel.handleMouseMove
  -> Live2D parameters
```

Evidence:

- Rust 入口与事件映射：`src-tauri/src/core/device.rs:32-57`
- 按钮和移动分流：`src/composables/useDevice.ts:211-218`
- 移动平滑：`src/composables/useDevice.ts:53-76`

当前 Rust `match` 忽略了未列出的事件，因此滚轮没有进入前端管线。MVP 的 mouse count 应定义为鼠标按钮按下次数；移动、释放和滚轮不计数。

### Controller

```text
OS gamepad backend
  -> gilrs event loop
  -> ButtonChanged / AxisChanged
  -> app.emit("gamepad-changed")
  -> useGamepad listener
  -> sticks: reactive stick state / Live2D axis
  -> buttons: useModel.handlePress / handleRelease
  -> main page watcher
  -> Live2D hand state
```

Evidence:

- Rust 入口与事件映射：`src-tauri/src/core/gamepad.rs:21-49`
- 根据模型模式启停监听：`src/composables/useGamepad.ts:48-54`
- 轴与按钮分流：`src/composables/useGamepad.ts:68-98`

手柄没有与键鼠共享统一 Rust 入口；两条管线只在主窗口的前端 composables 层并列存在。当前手柄监听仅在模型模式为 `gamepad` 时运行。为了不改变资源占用和现有手柄行为，本版不接入手柄统计；若未来要求任何模型模式下都统计手柄，需要另行扩大范围并先解决 Rust 轮询生命周期。

## 3. Recommended Insertion Points

| Source     | Insert point                                      | Count rule                                     | Why                                      |
| ---------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Keyboard   | `useDevice` 收到 payload 后、`getSupportedKey` 前 | 第一次 `KeyboardPress` +1，release 清除 active | 覆盖模型不支持的键，不改变动画           |
| Mouse      | 同一 `useDevice` listener                         | `MousePress` +1                                | 避开 move 高频事件与 release 重复        |
| Controller | `useGamepad` 收到 payload 后、动画 switch 前      | `ButtonChanged` 的 `0 -> >0` +1                | 模拟按钮可能连续报告 value，轴事件不计数 |

两处都调用同一个独立的 input-statistics recorder。该 recorder 只接受事件并更新内存增量，不能调用模型逻辑。

## 4. Event Semantics

### Keyboard repeat

目标语义是“一次物理按下算一次”，而不是每个 OS repeat 都计数。现有 `DeviceEvent` 没有 repeat 标志，因此采用内存 active-key set：

- 第一个 press 计数并标为 active。
- active 状态下的重复 press 不计数。
- release 清除 active。
- 为 Windows 丢失 release 的既有兼容场景增加短期兜底清理；重复 press 只刷新兜底计时，不增加次数。

限制：Linux/X11 的键盘自动重复可能表现为合成 release + press，单靠现有事件无法在所有键盘布局和桌面环境中完美区分。该行为必须在目标平台做手工验证，不能只靠单元测试宣称完全一致。

### Controller values

`ButtonChanged` 可能连续发送模拟值。应按按钮名维护 active set，仅把 `value > 0` 的第一次转换算作一次。`AxisChanged` 永远不计数。

### Privacy

按键或按钮名只允许短暂存在于 active set 中，不得写入 Pinia state、日志或 JSON。持久化内容只有日期和三个分类整数。

## 5. State and Persistence

### Existing mechanism

- `src/main.ts:14-15` 为 Pinia 注册 `createPlugin({ saveOnChange: true })`。
- `src/App.vue:35-45` 依次启动 app、model、cat、general、shortcut stores。
- `src-tauri/src/lib.rs:41` 注册 `tauri_plugin_pinia`。
- `src-tauri/capabilities/default.json:32` 已启用 `pinia:default`。
- 自定义模型资源另存于 `appDataDir/custom-models`；代码中未发现 localStorage、SQLite 或另一套业务状态持久化。

锁文件中的实际版本为 `@tauri-store/pinia 3.7.1`、`tauri-plugin-pinia 3.7.1` 和 `tauri-store 0.12.1`。该机制默认以 JSON 保存独立 store，并支持跨窗口同步、save-on-change、throttle/debounce 和 graceful-exit 保存。

### Proposed persisted shape

```json
{
  "schemaVersion": 1,
  "daily": {
    "2026-08-12": {
      "keyboard": 0,
      "mouse": 0,
      "controller": 0
    }
  }
}
```

不持久化 `total`、week 或 month。它们全部从 daily history 求和，避免双份状态不一致；每天只有一个小对象，长期规模不构成数据库需求。

### Write strategy

```text
input event
  -> in-memory pendingDaily += 1
  -> every ~1 second merge pending deltas into statistics Pinia store
  -> immediate frontend/backend sync for that batch
  -> saveOnChange + throttle(~10 seconds) to JSON
  -> explicit quit/relaunch: flush pending batch + saveNow
  -> Tauri RunEvent::Exit: plugin performs graceful-exit save
```

这样每次输入只修改小型内存缓冲，不逐次序列化整份 history，也不逐次写磁盘。异常终止仍可能丢失最后一个批次或最后一个写盘周期，这是定期写盘方案的固有取舍。

精确版本审查还发现：`@tauri-store/pinia 3.7.1` 的实例方法 `$tauri.saveNow()` 实际调用普通 `save()`，会继续遵守 throttle/debounce。实现强制 flush 时应使用包顶层导出的 `saveNow('statistics')`，不要使用该实例方法。

### Missing and damaged data

- 文件不存在：插件加载为空 store，前端默认 state 生效。
- JSON 结构合法但字段无效：`beforeFrontendSync` 调用纯函数 normalization，丢弃非法日期和非安全、负数计数。
- JSON 语法损坏：`tauri-store` 在 frontend hook 之前反序列化并返回错误，单靠 TypeScript hook 无法恢复。

锁定的 `tauri-store 0.12.1` 没有较新版本的 custom marshaler API。为满足“损坏数据不能导致应用崩溃”，statistics 专用 Tauri 插件必须排在 Pinia 之前：合法 JSON 原样保留；语法损坏则移为 `.corrupt` 备份，使 Pinia 以空 state 加载。该适配不新增依赖，`serde_json` 已存在，其他已有 stores 不受影响。

## 6. Application Lifecycle

- 两个窗口由 `src-tauri/tauri.conf.json:14-36` 在启动时创建，分别加载 `/` 和 `/preference`。
- Vue store 启动入口是 `src/App.vue:35-46`；statistics store 应在 RouterView 挂载前启动。
- `src-tauri/src/lib.rs:65-70` 拦截所有 CloseRequested，隐藏窗口并阻止销毁，所以关闭设置或桌宠窗口不等于退出，统计应继续运行。
- 正常退出和重启入口位于 `src/composables/useAppMenu.ts:95-105`、`src/components/update-app/index.vue:113-129`、`src/pages/preference/components/general/components/windows-permissions/index.vue:23-34`。
- `tauri-plugin-pinia` 自身监听 Tauri `RunEvent::Exit` 并保存已同步到 Rust 的 store。

由于托盘菜单在 preference Webview 中创建，而输入缓冲在 main Webview 中，显式退出 flush 需要一个小型跨窗口请求/确认流程，最终退出动作仍只执行一次。异常 kill 或系统强制终止无法保证最后一批数据落盘。

## 7. Settings UI

`src/pages/preference/index.vue:32-63` 使用菜单数组组织 Cat、General、Model、Shortcut、About。新增 Statistics 组件并在 About 前注册即可，不需要新路由，也不需要改桌宠主窗口。

建议的第一版页面：

- 顶部 period cards：Today、Yesterday、This Week、This Month、Total。
- 当前选定周期的 Keyboard、Mouse、Controller 和 Activity 合计。
- 最近 14 或 30 天的紧凑柱状历史，使用现有 CSS/UnoCSS，不增加图表依赖。
- 页面只读；第一版不增加清空统计、导入导出或主界面显示开关。

UI 参考 Codex `/usage` 的紧凑信息层级，但不复制终端布局。

## 8. Expected File Changes

### New

- `src/utils/statistics.ts`：数据结构、normalize、日期键、聚合纯函数。
- `src/utils/statistics.test.ts`：Statistics Core 行为测试。
- `src/stores/statistics.ts`：Pinia state、批次合并、派生统计与持久化配置。
- `src/composables/useInputStatistics.ts`：事件语义、active sets、内存增量与周期 flush。
- `src/pages/preference/components/statistics/index.vue`：设置页 Usage 面板。
- `src-tauri/src/core/statistics.rs`：Pinia 前置的损坏 JSON 恢复插件及其测试。

### Modified

- `src/App.vue`：启动 statistics store。
- `src/composables/useDevice.ts`：键盘/鼠标旁路接入。
- `src/pages/preference/index.vue`：增加 Statistics 菜单和组件。
- `src/locales/{en-US,zh-CN,zh-TW,vi-VN,pt-BR}.json`：补齐现有语言键。
- `src-tauri/src/lib.rs`：在 Pinia 前注册 statistics JSON 恢复插件。
- `package.json`：增加使用现有 `tsx` 的 test script，不增加依赖。
- 退出/重启相关文件与事件常量：只用于协调显式 flush；具体最小落点在 Phase 4 实施前根据测试确定。

明确不需要修改：`src/pages/main/index.vue` 的模板、模型资源、Skin/Model 系统、Tauri capabilities、Cargo 依赖和路由。

## 9. Cross-platform and Operational Risks

1. 输入权限：macOS Input Monitoring、Windows 管理员权限和 Linux/X11 能力决定原始事件能否被现有 hook 捕获；统计不会绕过这些限制。
2. Linux 支持范围：项目 README 明确支持 Linux(X11)，不应把 Wayland 宣称为已支持。
3. Repeat 差异：rdev 在不同平台对自动重复和丢失 release 的表现可能不同，物理按下计数只能在现有事件能力内尽力一致。
4. Controller 生命周期：当前只在 gamepad 模型模式监听；全局手柄统计不是无成本改动。
5. 多窗口：只能由 main 记录，preference 只读，否则同一 Tauri 事件可能被重复计算。
6. 日期变化：每次事件按当时本地日期入桶；跨午夜无需 rollover。用户手动修改时区或系统时钟时，日期键可能非单调，但不会覆盖其他日期。
7. 数据丢失窗口：强制结束进程或断电可能丢失最后约一个批次加一个写盘周期的数据。
8. 文件损坏：恢复插件可保证启动，但无法从不可解析文件还原原统计值；原文件会保留为 `.corrupt` 备份。

## 10. Test Plan

### Red-Green core tests

项目当前没有 test script 或现有测试文件。使用已安装的 `tsx` 配合 Node 内置 `node:test`，不新增测试框架依赖。

先写失败测试，再实现：

- keyboard、mouse 各自 +1，分类不串线；controller 兼容字段保持为 0。
- press/release、key repeat 和丢失 release 后的恢复口径。
- Activity 等于三个分类之和。
- Today、Yesterday、ISO This Week、This Month、Total。
- 2026-07-31 / 2026-08-01 跨月。
- 2026-12-31 / 2027-01-01 跨年。
- 事件发生时直接使用本地日期，模拟运行中跨午夜。
- normalize 缺失字段、非法日期、负数、小数、NaN/Infinity 和超过 safe integer 的值。
- JSON state serialize/load round trip。
- 多次输入只触发一次批次 commit；持续输入按 throttle 周期保存。
- 损坏 JSON 会被移为本地 `.corrupt` 备份，Rust 单元测试验证 Pinia 可从空 state 继续启动。

### Integration and manual checks

- 设置页出现 Statistics，桌宠主窗口 DOM/视觉无新增内容。
- 主窗口持续输入时，设置窗口在一个批次周期内刷新。
- 按住键只计一次；快速重复敲击逐次计数。
- 鼠标点击计数，移动和滚轮不计数。
- 当前版本不修改 `useGamepad`，controller 兼容字段保持为 0。
- 关闭设置窗口后继续计数；重新打开数据正确。
- 托盘 Quit、Restart、应用更新 relaunch 后数据保留。
- 手工破坏 statistics JSON 后应用可启动并回到默认统计。
- Windows、macOS、Linux/X11 各做一次真实输入权限与 repeat 冒烟测试。

### Validation commands after implementation

- `pnpm test`
- `pnpm exec eslint src`（不使用现有会自动修改文件的 `pnpm lint`）
- `pnpm build:vite`
- `cargo test -p bongo-cat statistics`
- `cargo check -p bongo-cat`（仅因本方案包含小型 Rust 适配）
- 最终复核 `git diff --check` 和范围内 diff。

## 11. Phase Order

1. Statistics Core：测试先行，完成 daily-only 模型、normalize 和聚合。
2. Input integration：接入两处前端监听器，保持动画调用完全不变。
3. Persistence：内存批次、throttled JSON、启动恢复和显式退出 flush。
4. Settings UI：Usage 风格页面和多语言文本，不改主界面。
5. Regression：自动测试、构建、三平台手工清单。

Phase 2 开始前的产品边界已经确认：当前版本以键盘为核心，同时统计鼠标按钮，不修改手柄管线。全模式手柄监听可作为后续独立改进。
