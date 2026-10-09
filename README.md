> [Oh-My-BongoCat](https://github.com/white795/Oh-My-BongoCat) 是基于
> [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) 的个人扩展版，新增输入统计、
> Agent 状态联动及 MikuCat 动画与特效。默认稳定分支为 `main`，新增功能主要在 Windows 实机验收。
> 开发从 [main 分支入口](docs/branches/main/todo.md) 与 [开发约定](AGENTS.md) 开始，
> 后续功能通过本仓库的 PR 向 `main` 合入；上游介绍、社区和致谢另行标注。

![Oh-My-BongoCat](https://socialify.git.ci/white795/Oh-My-BongoCat/image?custom_description=&description=1&font=Source+Code+Pro&forks=1&issues=1&logo=https%3A%2F%2Fgithub.com%2Fwhite795%2FOh-My-BongoCat%2Fblob%2Fmain%2Fsrc-tauri%2Fassets%2Flogo-mac.png%3Fraw%3Dtrue&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

<div align="center">
  <div>
    <a href="https://github.com/white795/Oh-My-BongoCat/releases"><img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB0PSIxNzI2MzA1OTcxMDA2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjE1NDgiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cGF0aCBkPSJNNTI3LjI3NTU1MTYxIDk2Ljk3MTAzMDEzdjM3My45OTIxMDY2N2g0OTQuNTEzNjE5NzVWMTUuMDI2NzU3NTN6TTUyNy4yNzU1NTE2MSA5MjguMzIzNTA4MTVsNDk0LjUxMzYxOTc1IDgwLjUyMDI4MDQ5di00NTUuNjc3NDcxNjFoLTQ5NC41MTM2MTk3NXpNNC42NzA0NTEzNiA0NzAuODMzNjgyOTdINDIyLjY3Njg1OTI1VjExMC41NjM2ODE5N2wtNDE4LjAwNjQwNzg5IDY5LjI1Nzc5NzUzek00LjY3MDQ1MTM2IDg0Ni43Njc1OTcwM0w0MjIuNjc2ODU5MjUgOTE0Ljg2MDMxMDEzVjU1My4xNjYzMTcwM0g0LjY3MDQ1MTM2eiIgcC1pZD0iMTU0OSIgZmlsbD0iI2ZmZmZmZiI+PC9wYXRoPjwvc3ZnPg==" /></a>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img alt="macOS 上游版本" src="https://img.shields.io/badge/macOS-upstream-black?style=flat-square&logo=apple&logoColor=white" /></a>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img alt="Linux 上游版本" src="https://img.shields.io/badge/Linux-upstream-yellow?style=flat-square&logo=linux&logoColor=white" /></a>
  </div>

  <p>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/white795/Oh-My-BongoCat?style=flat-square" /></a>
    <a href="https://github.com/white795/Oh-My-BongoCat/releases"><img src="https://img.shields.io/github/package-json/v/white795/Oh-My-BongoCat?style=flat-square"/></a>
  </p>

  <p>以下推荐来自上游 BongoCat。</p>

  <p>
    <a href="https://trendshift.io/developers/8507" target="_blank"><img src="https://trendshift.io/api/badge/developers/8507" alt="ayangweb | Trendshift" width="250" height="55" /></a>
    <a href="https://trendshift.io/repositories/14605" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14605" alt="ayangweb%2FBongoCat | Trendshift" width="250" height="55" /></a>
    <a href="https://hellogithub.com/repository/7d23863fd4be47b39e816193ded385c9" target="_blank">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=dark" />
        <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=neutral" />
        <img alt="Star History Chart" src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=neutral" width="250" height="55" />
      </picture>
    </a>
  </p>
</div>

上游 BongoCat 的跨平台示例：

| macOS                                                                                        | Windows                                                                                        | Linux(x11)                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ![macOS](https://i0.hdslb.com/bfs/openplatform/dff276b96d49c5d6c431b74b531aab72191b3d87.png) | ![Windows](https://i0.hdslb.com/bfs/openplatform/a4149b753856ee7f401989da902cf3b5ad35b39e.png) | ![Linux](https://i0.hdslb.com/bfs/openplatform/3b49f961819d3ff63b2b80251c1cc13c27e986b0.png) |

## 上游赞助商

<a href="https://www.toolsetlink.com">
  <img height="54" alt="UpgradeLink" src="https://github.com/user-attachments/assets/6b84fb0f-3f1d-44b5-9932-2298bc999d8d" />
</a>

## 开发背景

Oh-My-BongoCat 在上游 BongoCat 的桌宠功能之上，增加输入统计、多 Agent Session 状态接收、
底部状态星标、屏幕边缘提示，以及 MikuCat 的吉他、生气和完成动画。

上游由 [ayangweb](https://github.com/ayangweb) 开发，灵感来自
[MMmmmoko](https://github.com/MMmmmoko) 的 [Bongo-Cat-Mver](https://github.com/MMmmmoko/Bongo-Cat-Mver)，
使用 [Tauri](https://github.com/tauri-apps/tauri) 实现跨平台桌宠。本仓库保留上游来源与致谢，
GitHub 仓库改名不改变已安装应用的 BongoCat 名称和数据身份。

## 下载

- [本仓库 GitHub Releases](https://github.com/white795/Oh-My-BongoCat/releases)：本分支安装包入口，以页面实际发布资产为准。
- [上游 GitHub Releases](https://github.com/ayangweb/BongoCat/releases) / [上游夸克网盘](https://pan.quark.cn/s/70f2f2663ce1)：不包含本仓库新增功能。

不确定下载哪一个？请查阅[下载指南](.github/DOWNLOAD_GUIDE.md)。

## 功能介绍

- 沿用上游跨平台架构；本分支新增功能主要在 Windows 验收，macOS / Linux 的扩展表现需另行验证。
- 根据键盘、鼠标或手柄的操作，同步对应的动作。
- 支持导入自定义模型，自由打造专属猫咪形象。
- 程序源码采用 [MIT 许可证](LICENSE)，MikuCat 素材另受
  [专有素材许可证](src-tauri/assets/models/mikucat/LICENSE)约束；不收集用户数据。
- 支持离线运行，无需联网，保护用户隐私。

## Agent 状态联动

Agent 氛围灯、屏幕边缘提示和 MikuCat 状态动画是可选功能。BongoCat 内置状态接收与显示，
但安装包不会自动注册 Agent hook 或部署发送中间件；只安装 BongoCat 不会自动获得 Agent 状态，
不配置这些组件也不影响原有键盘、鼠标和手柄功能。

维护者当前使用的是 **WSL Agent + Windows BongoCat**，链路为：

```text
Agent lifecycle hook -> WSL adapter -> WSL relay
                     -> PowerShell dispatcher -> Windows named pipe -> BongoCat
```

接入需要完成三项配置：

1. 在 Agent 侧注册 lifecycle hooks：Codex 使用六个事件，Claude Code 使用八个事件，
   具体映射与命令见 [integration/README.md](integration/README.md)。
2. 部署对应 hook/adapter 的稳定运行副本，以及 WSL relay、dispatcher 和 systemd 用户
   socket/service；仓库提供源码，不会随 BongoCat 安装包自动配置它们。
3. 运行 Windows BongoCat，并开启“Agent 氛围灯”或“Agent 接管模型”；模型接管仅适用于
   内置 MikuCat，两个开关独立。发送器与接收端须使用同一 Windows 用户。

给后续开发者 / Agent：先读 [integration/README.md](integration/README.md) 的接入前提与
运行链路，以及 [AGENTS.md](AGENTS.md) 的“仓库外 agent 配置”。排查顺序是 hook 注册/触发
→ adapter → relay → named pipe → BongoCat 消费开关，不必先遍历模型动画代码。
Codex legacy `notify` 只负责 Windows toast，不是氛围灯的完成事件源；完成由 `Stop` 驱动。

Windows 原生 Codex 连接件是本地可选补丁，`integration/windows-codex-bridge/` 被 Git 忽略，
不随 clone/pull 或默认安装包提供，也不是当前 WSL 链路的依赖；问题记录见
[Plan 030](docs/branches/feat-mikucat-state-machine/plans/plan-030-windows-codex-bridge.md)。

## 模型转换

如果你想将 Bongo-Cat-Mver 应用中的模型转换为兼容 BongoCat 的格式，可以使用以下工具：

🔗 [在线转换](https://bongocat.vteamer.cc)

## 更多模型

你可以在这个仓库中探索、下载更多猫咪模型，或提交你的创作，与大家一起分享：

📦 [Awesome-BongoCat](https://github.com/ayangweb/Awesome-BongoCat)

## 上游社区交流

<table>
  <thead>
    <tr>
      <th>QQ 群 1</th>
      <th>QQ 群 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="https://qm.qq.com/q/AS3gNv2Vzy">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcset="https://i0.hdslb.com/bfs/openplatform/8ecdc4982ab01b59d7731fcca3ec26631a274560.png"
            />
            <source
              media="(prefers-color-scheme: light)"
              srcset="https://i0.hdslb.com/bfs/openplatform/09f56580397063e1819c4c2ed63d07dee12720e1.png"
            />
            <img
              alt="QQ Group 1"
              src="https://i0.hdslb.com/bfs/openplatform/09f56580397063e1819c4c2ed63d07dee12720e1.png"
              height="250"
            />
          </picture>
        </a>
      </td>
      <td>
        <a href="https://qm.qq.com/q/TmltLAod2O">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcset="https://i0.hdslb.com/bfs/openplatform/473c522487ff33e0f32b15466aeb0734f17161c8.png"
            />
            <source
              media="(prefers-color-scheme: light)"
              srcset="https://i0.hdslb.com/bfs/openplatform/d5ae8c5af6ae1d0a1f066705ee822d1287384cf6.png"
            />
            <img
              alt="QQ Group 2"
              src="https://i0.hdslb.com/bfs/openplatform/d5ae8c5af6ae1d0a1f066705ee822d1287384cf6.png"
              height="250"
            />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

## 赞赏上游作者

每一份认可都值得被珍视！赞赏随缘，心意无价，谢谢你的支持 ❤️

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://i0.hdslb.com/bfs/openplatform/e7438bff14cdfb6bfd0feacbb482f99ea4093294.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://i0.hdslb.com/bfs/openplatform/da55cc3ec1556580c91e59f589792866c998c7c6.png" />
  <img alt="微信赞赏码" src="https://i0.hdslb.com/bfs/openplatform/da55cc3ec1556580c91e59f589792866c998c7c6.png" height="250" />
</picture>

## 贡献指南

本仓库的 PR 请提交到
[white795/Oh-My-BongoCat 的 main](https://github.com/white795/Oh-My-BongoCat/pulls)，
具体流程见[贡献指南](.github/CONTRIBUTING.md)。下图保留上游贡献者记录：

<a href="https://openomy.com/ayangweb/BongoCat" target="_blank" style="display: block; width: 100%;" align="center">
  <img src="https://openomy.com/svg?repo=ayangweb/BongoCat&chart=bubble" alt="Contribution Leaderboard" style="display: block; width: 100%;" />
</a>

## 历史星标

<a href="https://www.star-history.com/#white795/Oh-My-BongoCat&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=white795/Oh-My-BongoCat&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=white795/Oh-My-BongoCat&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=white795/Oh-My-BongoCat&type=Date" />
 </picture>
</a>
