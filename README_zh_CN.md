# 思源滴答同步

这是一个仅面向思源桌面端的插件，用于通过本机 `dida` CLI 同步 Markdown 待办块和滴答清单。

当前处于 MVP 开发阶段。

## Windows 使用提示

- 先在 Windows 终端确认 `dida --version` 可用；如果思源找不到命令，在插件设置里填写 `dida.cmd` 的绝对路径。
- Windows 10/11 通常自带 `curl.exe`，插件代理模式会用它访问滴答开放 API。
- 如果使用代理，请把插件设置里的代理地址改为 Windows 电脑实际可用的地址，例如 `http://127.0.0.1:7890`。
- `dida auth login` 保存的 token 需要在每台电脑各登录一次。
