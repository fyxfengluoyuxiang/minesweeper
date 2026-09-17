#!/usr/bin/env sh
# 扫雷 Minesweeper · Linux 安装脚本
# 在 ~/.local/share/applications 和桌面各写一个启动器，优先使用 Chrome / Chromium / Edge 的应用模式。
#
# 用法：
#   chmod +x install-linux.sh && ./install-linux.sh
# 卸载：
#   ./install-linux.sh uninstall

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
GAME="$DIR/minesweeper.html"
APPS="$HOME/.local/share/applications"
NAME="minesweeper.desktop"

if [ ! -f "$GAME" ]; then
    echo "找不到 minesweeper.html，请把本脚本和它放在同一目录。" >&2
    exit 1
fi

if [ "${1:-}" = "uninstall" ]; then
    rm -f "$APPS/$NAME" "$HOME/Desktop/$NAME"
    echo "已删除启动器。"
    exit 0
fi

# 找一个支持 --app 的浏览器
BROWSER=""
for c in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser; do
    if command -v "$c" >/dev/null 2>&1; then
        BROWSER=$(command -v "$c")
        break
    fi
done

if [ -n "$BROWSER" ]; then
    EXEC="$BROWSER --app=\"file://$GAME\" --window-size=820,760"
else
    EXEC="xdg-open \"$GAME\""
fi

mkdir -p "$APPS"
cat > "$APPS/$NAME" <<EOF
[Desktop Entry]
Type=Application
Name=扫雷 Minesweeper
Comment=经典扫雷（离线单文件版）
Exec=$EXEC
Terminal=false
Categories=Game;LogicGame;
EOF
chmod +x "$APPS/$NAME"

# 桌面启动器（没有 Desktop 目录就跳过）
if [ -d "$HOME/Desktop" ]; then
    cp "$APPS/$NAME" "$HOME/Desktop/$NAME"
    chmod +x "$HOME/Desktop/$NAME"
    if command -v gio >/dev/null 2>&1; then
        gio set "$HOME/Desktop/$NAME" metadata::trusted true 2>/dev/null || true
    fi
    echo "已创建桌面启动器：$HOME/Desktop/$NAME"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPS" 2>/dev/null || true
fi

echo "安装完成，在应用菜单里搜索「扫雷 Minesweeper」即可启动。"
echo "卸载：./install-linux.sh uninstall"
