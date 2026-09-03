#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 celluloid://<base64url>" >&2
    exit 1
fi

PAYLOAD="${1#celluloid://}"
PAYLOAD="${PAYLOAD%/}"

# Convert URL-safe Base64 back to standard Base64 and restore its padding.
PAYLOAD="${PAYLOAD//-/+}"
PAYLOAD="${PAYLOAD//_/\/}"
case $((${#PAYLOAD} % 4)) in
    0) ;;
    2) PAYLOAD="${PAYLOAD}==" ;;
    3) PAYLOAD="${PAYLOAD}=" ;;
    *) echo "Error: Invalid stream payload" >&2; exit 2 ;;
esac

if ! STREAM_URL=$(printf '%s' "$PAYLOAD" | base64 --decode 2>/dev/null); then
    echo "Error: Invalid stream payload" >&2
    exit 2
fi

case "$STREAM_URL" in
    http://*|https://*|file://*) ;;
    *) echo "Error: Unsupported stream URL" >&2; exit 3 ;;
esac

if ! command -v mpv &>/dev/null; then
    echo "Error: mpv is not installed" >&2
    exit 4
fi

exec mpv --force-window=immediate -- "$STREAM_URL"
