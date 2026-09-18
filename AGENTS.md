# BongoCat Windows 开发与打包约定

## 工作区对应关系

- WSL 开发仓库：`/home/devuser/VibeTool/BongoCat`
- Windows 构建与实机验收仓库：`D:\VibeTool\BongoCat`
- 从 WSL 访问 Windows 仓库：`/mnt/d/VibeTool/BongoCat`
- `D:\VibeTool\BongoCat2` 是曾出现文件损坏的复制副本，不作为构建或验收目录。

WSL 与 Windows 是两个独立工作副本。代码修改完成后，应只同步本次涉及的文件到 Windows
仓库，并保留 Windows 仓库已有的 `node_modules` 和 `target` 缓存；不要通过重新复制整个仓库
或重装依赖来代替增量同步。

## Windows 验收与打包流程

本项目固定采用“先开发态验收，再生成安装包”的顺序。除非用户明确要求，不要跳过 dev 验收
直接打包，也不要替用户执行 Windows 构建。

### 1. 同步修改

将 WSL 仓库本次修改的源文件同步到：

```text
D:\VibeTool\BongoCat
```

同步后核对目标文件，并确保没有覆盖 Windows 工作区中无关的用户改动、依赖目录或编译缓存。

### 2. 开发态测试

在 Windows PowerShell 中执行：

```powershell
Set-Location D:\VibeTool\BongoCat
pnpm.cmd tauri dev
```

使用 `pnpm.cmd` 是为了避开 PowerShell 对 `pnpm.ps1` 的执行策略限制。dev 启动后先进行人工
验收；当前 Codex 氛围灯至少检查：

- 主猫完整显示，Live2D、输入、拖动、托盘和偏好设置没有回归。
- 开启“Codex 氛围灯”后，手动事件与真实 Codex hook 状态显示正确。
- WAITING 首次进入时主显示器工作区边缘播放两次琥珀红连续呼吸，DONE 首次进入时播放绿色单次
  扫边；动画结束后不残留透明窗口，且不抢焦点或拦截鼠标。
- ambient 事件不打开偏好设置、不抢焦点，也不产生第二个常驻 BongoCat 实例。

发现问题时先停止 dev、修改和重新同步，再次运行 dev；不要用安装包构建代替快速验证。

### 3. 生成安装包

只有 dev 验收通过后，才在同一个 Windows 仓库中执行：

```powershell
Set-Location D:\VibeTool\BongoCat
pnpm.cmd tauri build
```

Windows NSIS 安装包通常生成在：

```text
D:\VibeTool\BongoCat\target\release\bundle\nsis\
```

打包完成后仍需安装并验收实际安装版本，尤其要确认应用身份、自启动、持久化数据和管理员
BongoCat 与普通权限 Codex 的 named pipe bridge。bridge 不依赖开发版或安装版 exe 路径。

## 仓库外 agent 配置

氛围灯有两条互相独立的 bridge，它们依赖 WSL 用户目录中的以下文件。这些文件不属于本 Git
仓库，提交代码时不会被一起保存。

Codex：

- `/home/devuser/.codex/hooks.json`
- `/home/devuser/.codex/launcher.sh`
- `/home/devuser/.codex/ambient/codex-ambient-hook.sh`
- `/home/devuser/.codex/ambient/codex_ambient_adapter.py`
- `/home/devuser/.codex/ambient/codex-ambient-dispatch.ps1`

`hooks.json` 把六个 lifecycle hook（含 `Stop` 与 `SessionEnd`）接入 `~/.codex/ambient`；
`launcher.sh` 只处理 legacy notify 的 Windows toast，不得把 notify 转发给氛围灯。Codex DONE
由 `Stop` 驱动，避免 `/recap` 产生的 notify 重建已经结束的会话槽位。

Claude Code：

- `/home/devuser/.claude/settings.json`（`hooks` 字段，8 个事件）
- `/home/devuser/.claude/ambient/claude-ambient-hook.sh`
- `/home/devuser/.claude/ambient/claude_ambient_adapter.py`
- `/home/devuser/.claude/ambient/claude-ambient-dispatch.ps1`

两条 bridge 的三个文件是**故意不共享代码**的独立副本：两种 agent 的 payload 形状与生命周期
不同，隔离后修一侧永远不会回归另一侧，也不必每次改动都做双向回归。修改任一侧的 bridge
协议时，只需同步该侧的仓库副本。

`settings.json` 同时含 `ANTHROPIC_AUTH_TOKEN`，编辑时应程序化改写而不是整文件覆盖，避免把
密钥回显到日志或对话中。迁移或恢复环境时，必须单独核对并同步以上全部文件。
