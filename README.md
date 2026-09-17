# 扫雷 · Minesweeper

经典 Windows 98 风格的扫雷：**一个 HTML 文件，双击即玩，零依赖、零联网**。
内置桌面安装脚本，装完在桌面上就是一个带地雷图标、没有地址栏的独立小窗口。

```
minesweeper.html   ← 游戏本体（单文件，26 KB，直接双击就能玩）
install-windows.ps1 ← Windows 一键安装（生成图标 + 创建桌面快捷方式）
install-linux.sh    ← Linux 一键安装（写 .desktop 启动器）
```

## 特点

- **单文件、离线**：所有 HTML / CSS / JS / 图标都是内联的，不加载任何外部资源，断网也能玩。
- **经典手感**：7 段数码管显示雷数与计时、3D 立体格子、笑脸按钮重开、1/2/3 数字经典配色。
- **首点永不踩雷**：第一次点击之后再布雷，且必然从数字 0 开始展开一片区域。
- **完整的经典操作**：左键翻开、右键循环「插旗 → 问号 → 取消」、双击或中键在数字上快速展开（和弦）。
- **三种难度 + 自定义**：初级 9×9/10 雷、中级 16×16/40 雷、高级 30×16/99 雷，也可以自定义尺寸与雷数。
- **最佳成绩**：按难度分别记录在浏览器本地（`localStorage`），通关刷新纪录时会提示。
- **会自动适配窗口**：格子大小跟着窗口缩放，窄屏 / 手机也能玩（手机长按 = 插旗）。
- **键盘快捷键**：`1` `2` `3` 切难度，`R` 重开一局。

## 安装教程

### Windows（推荐：一键脚本）

1. 把 `minesweeper.html` 和 `install-windows.ps1` 放在**同一个文件夹**里（如果是 clone 或下载 zip，解压后就已经在同一目录了）。
2. 在该文件夹里按住 `Shift` + 右键空白处，选择「在此处打开 PowerShell 窗口」（Windows 11 可先点「在终端中打开」）。
3. 执行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Open
   ```

   脚本会做两件事：在本目录生成 `assets\icon.ico`（用 .NET 现画一个地雷图标），然后在桌面创建快捷方式 **「扫雷 Minesweeper」**，
   用 Edge / Chrome 的**应用模式**打开游戏 —— 没有地址栏、没有标签页，看起来就是一个独立小软件。加上 `-Open` 参数会在装完后直接启动。

   常用参数：

   ```powershell
   # 自定义快捷方式名字
   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Name "Minesweeper"

   # 卸载（只删除桌面快捷方式，不动游戏文件）
   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Uninstall
   ```

> 如果提示「无法加载文件，因为在此系统上禁止运行脚本」，就是执行策略的问题 —— 上面命令里的 `-ExecutionPolicy Bypass` 已经绕过它了，请照抄完整命令。
> 如果电脑上没装 Edge / Chrome，脚本会自动改成用系统默认浏览器打开。

### Windows（手动，不用脚本）

1. 双击 `minesweeper.html` 就能玩（会在默认浏览器里打开）。
2. 想要桌面图标：右键 `minesweeper.html` → 「发送到」→ 「桌面快捷方式」，再右键该快捷方式 → 「属性」→ 「更改图标」选一个顺眼的图标即可。
3. 想要独立窗口（没有地址栏）：用 Chrome / Edge 打开后，菜单 → 「投放、保存和共享」或「更多工具」→ 「创建快捷方式」，勾选「以窗口形式打开」。

### macOS

1. 双击 `minesweeper.html`，默认浏览器会打开游戏，直接玩。
2. 想要一个能放在程序坞 / 桌面的图标，用系统自带的 Automator：
   - 打开「自动操作（Automator）」→ 新建「应用程序」→ 搜索并添加「运行 Shell 脚本」；
   - 脚本内容填 `open -a Safari "$HOME/Downloads/minesweeper.html"`（路径和浏览器换成你自己的）；
   - 保存为 `扫雷.app`，拖到桌面或程序坞即可。
3. 也可以直接用 Safari 打开游戏后，菜单「文件 → 添加到程序坞」，得到更接近独立应用的效果。

### Linux

```bash
chmod +x install-linux.sh
./install-linux.sh
```

脚本会在 `~/.local/share/applications/` 和桌面各写一个启动器（优先用 Chrome / Chromium / Edge 的应用模式）。手动做法是把下面内容存成 `~/.local/share/applications/minesweeper.desktop`：

```ini
[Desktop Entry]
Type=Application
Name=扫雷 Minesweeper
Comment=经典扫雷（离线单文件版）
Exec=google-chrome --app="file:///绝对路径/minesweeper.html"
Terminal=false
Categories=Game;LogicGame;
```

## 玩法

| 操作 | 效果 |
| --- | --- |
| 左键 | 翻开格子 |
| 右键 | 插旗 → 问号 → 取消（循环） |
| 双击 / 中键点数字 | 周围旗数与数字相符时，快速翻开其余格子 |
| 手机长按 | 插旗 |
| 点笑脸 / `R` | 重新开始 |
| `1` `2` `3` | 切换初级 / 中级 / 高级 |

数字表示它周围 8 格里的雷数，颜色沿用了原版的经典配色（1 蓝、2 绿、3 红……）。
把所有非雷格子翻完即通关；踩到雷就结束，会标出所有雷，插错的旗子会打红叉。

## 项目结构

```
.
├── minesweeper.html      # 游戏本体：单文件，HTML + CSS + JS 全内联
├── install-windows.ps1   # Windows 安装脚本（生成图标 + 桌面快捷方式）
├── install-linux.sh      # Linux 安装脚本（生成 .desktop 启动器）
├── test/test.mjs         # 自动化测试（jsdom，49 项断言）
├── package.json          # 仅用于跑测试，游戏本身不需要 npm
└── LICENSE               # MIT
```

## 开发与测试

游戏本身**不需要任何构建步骤**，改完 `minesweeper.html` 直接刷新浏览器即可。

仓库里的自动化测试用 jsdom 真实加载页面、模拟鼠标事件，覆盖首点安全（随机 200 局）、插旗计数、
和弦展开、胜负判定、难度切换、自定义上下限、窗口贴合棋盘等 49 项断言：

```bash
npm install     # 只装 jsdom
npm test
```

## 常见问题

**为什么双击后是浏览器标签页而不是独立窗口？**
手动双击 HTML 时，浏览器会用自己的窗口打开。用安装脚本（应用模式）或者在浏览器里「创建快捷方式 → 以窗口形式打开」才有独立窗口的效果。

**成绩存在哪里？会不会被清掉？**
存在浏览器的 `localStorage` 里，按难度分别记录。清除浏览器数据 / 换浏览器会丢失。

**格子太小 / 太大？**
拖动窗口大小即可，格子会跟着自适应（16–30 像素之间）；自定义难度也能调棋盘尺寸。

**能不能改难度上限？**
可以。`minesweeper.html` 里 `newGame()` 对宽、高、雷数做了夹紧（宽 5–60、高 5–40，雷数不超过格子总数 −9，保证首点安全），按需改即可。

## 兼容性

Chrome / Edge / Firefox / Safari 的近几年版本都可以，手机浏览器也能玩。选「应用模式」安装时用的是 Edge 或 Chrome。

## 许可

[MIT](LICENSE)，随便用、改、发。代码主要由 AI 编程助手（Codex）按需求编写，游戏逻辑与界面均为原创实现，没有复制第三方代码。
