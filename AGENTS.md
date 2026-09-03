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

打包完成后仍需安装并验收实际安装版本，尤其要确认安装路径、应用身份、自启动、持久化数据和
Codex bridge 指向的 exe 路径。开发态 bridge 当前默认指向
`D:\VibeTool\BongoCat\target\debug\bongo-cat.exe`，不会自动改为安装版路径。

## 仓库外 Codex 配置

Codex ambient bridge 还依赖 WSL 用户目录中的以下文件，它们不属于本 Git 仓库，提交代码时
不会被一起保存：

- `/home/devuser/.codex/hooks.json`
- `/home/devuser/.codex/launcher.sh`

前者把四个 lifecycle hook 接入 `integration/codex-ambient-hook.sh`，后者把 legacy notify
接入相同 bridge，同时保留原 Windows toast。迁移、恢复环境或切换仓库路径时，必须单独核对
这两个文件。
