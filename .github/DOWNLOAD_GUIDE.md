# 下载指南

## 本分支与上游版本

Oh-My-BongoCat 安装包从
[本仓库 Releases](https://github.com/white795/Oh-My-BongoCat/releases) 获取，以页面实际附件为准。
发布页没有提供的包不视为已发布；克隆源码也不会自动安装 Agent hook 发送中间件。

本分支新增功能主要在 Windows 验收。下方 macOS / Linux 命令与文件名示例来自上游，
对应 [上游 Releases](https://github.com/ayangweb/BongoCat/releases)，不包含本仓库新增功能。

## 系统要求

- macOS 12 或更高版本。
- Windows 10 或更高版本。
- Linux 带有 X11 环境。

## macOS

### 手动下载

- Apple Silicon：下载 `BongoCat_aarch64.dmg`
- Intel Chip：下载 `BongoCat_x64.dmg`

### Homebrew 下载

1. 添加 BongoCat 的 tap 源：

```bash
brew tap ayangweb/BongoCat
```

2. 安装：

```bash
brew install --no-quarantine bongo-cat
```

3. 更新：

```bash
brew upgrade bongo-cat
```

4. 卸载：

```bash
brew uninstall --cask bongo-cat

brew untap ayangweb/BongoCat
```

## Windows

本分支请选择本仓库发布页实际提供、与系统架构匹配的 Windows 安装包，不假定已提供 x86 或 ARM64。
安装后若要使用 Agent 联动，还需按 [接入说明](../integration/README.md) 注册 hook 和部署发送中间件。

仅使用上游版本时，原文件名示例为 `BongoCat_x64.exe`、`BongoCat_x86.exe`、`BongoCat_arm64.exe`；
具体同样以上游发布页实际附件为准。

## Linux(X11)

### 手动下载

- 64 位系统：
  - Debian / Ubuntu：下载 `BongoCat_amd64.deb`
  - Fedora / RHEL：下载 `BongoCat_x86_64.rpm`
  - 通用版本：下载 `BongoCat_amd64.AppImage`
- ARM64 架构：
  - Debian / Ubuntu：下载 `BongoCat_arm64.deb`
  - Fedora / RHEL：下载 `BongoCat_aarch64.rpm`
  - 通用版本：下载 `BongoCat_aarch64.AppImage`

### AUR 下载

- Manjaro / ArchLinux: `yay -S bongo-cat`
