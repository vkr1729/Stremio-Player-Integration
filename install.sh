#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"

if ! command -v mpv &>/dev/null; then
    echo "Error: install mpv before running this installer" >&2
    exit 1
fi

mkdir -p "$BIN_DIR" "$APP_DIR"
install -m 755 "$PROJECT_DIR/open-mpv.sh" "$BIN_DIR/open-stremio-mpv"
sed "s|EXEC_PATH|$BIN_DIR/open-stremio-mpv|g" \
    "$PROJECT_DIR/stremio-mpv-handler.desktop" \
    > "$APP_DIR/stremio-mpv-handler.desktop"

xdg-mime default stremio-mpv-handler.desktop x-scheme-handler/celluloid
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APP_DIR"
fi

echo "Installed the celluloid:// compatibility handler for mpv."
echo "Load the stremio-mpv-extension folder at chrome://extensions."
