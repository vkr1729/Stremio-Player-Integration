# Stremio mpv Integration

## Outcome

This personal Linux project opens streams selected on Stremio Web in the local mpv player. It keeps working for consecutive video selections without requiring a page refresh.

## Scope

- Current module: intercept Stremio player navigation, decode its stream URL, and launch mpv.
- Current module: return Stremio to its most recent non-player page before its browser player starts.
- Current module: install one private Linux protocol handler for the browser-to-mpv handoff.
- Not included: a settings screen, diagnostics panel, persistent logs, multiple local players, or support outside Chrome-compatible browsers and Linux.

## Architecture and why

There are only two runtime pieces. A Chrome content script watches Stremio Web, and a small Linux script launches mpv. They communicate through the existing `celluloid://` compatibility scheme registered by a desktop file. The legacy scheme name is retained because Chrome has already approved it on this personal machine; the handler launches mpv, not Celluloid.

The content script remembers the last Stremio hash that was not a player page. If Stremio changes to `#/player/...`, the extension restores the remembered hash immediately, then decodes and opens the stream externally. Restoring first is important: the old implementation waited for decoding and then called `history.back()`, which could leave Stremio's page state out of sync after the first video.

The handoff payload uses URL-safe Base64. This transports Unicode URLs and query strings without treating Base64 characters as URL separators. The Linux handler passes `--` before the stream URL so mpv cannot interpret it as a command-line option.

This is the simplest suitable design because the browser cannot directly start a local program. A native-messaging host would provide two-way communication, but it would add manifests and message plumbing that this one-way personal workflow does not need.

## How it works

Selection in Stremio → content script intercepts an external-player link or player hash → compressed player data is decoded → stream URL becomes `celluloid://<base64url>` → Linux desktop handler starts `open-mpv.sh` → the script decodes and validates the URL → mpv receives it as one argument.

The only external actions are browser navigation to the private protocol and starting mpv. The project stores no stream history, credentials, or logs.

## File map

| Path | What it contains | Why it exists / connects to |
| --- | --- | --- |
| `stremio-mpv-extension/manifest.json` | Minimal Manifest V3 declaration | Loads the content script on Stremio Web. |
| `stremio-mpv-extension/content.js` | Route decoding, route tracking, and click interception | Converts a Stremio selection into the private protocol URL. |
| `open-mpv.sh` | Base64url decoding, URL validation, and mpv launch | Receives the URL from Linux and performs the only local process launch. |
| `stremio-mpv-handler.desktop` | Linux protocol declaration | Connects the compatibility `celluloid://` scheme to the installed mpv script. |
| `install.sh` | Per-user installation | Copies and registers the two Linux handler files. |
| `test.js` | Three behavioral checks | Exercises actual decoding, repeated route state, and the complete handler handoff. |
| `package.json` | `npm test` command | Provides one familiar test entry point without dependencies. |

## Implementation

1. Intercept and restore player routes synchronously, then decode and open the stream.
2. Use one URL-safe protocol handler that launches mpv directly.
3. Protect those behaviors with three small checks and remove generated workflow artifacts.

## Proof checks

1. Primary journey and repeated selection: `npm test`
2. Browser script syntax: `node --check stremio-mpv-extension/content.js`
3. Linux scripts: `bash -n install.sh open-mpv.sh`

## Run and limitations

Run `./install.sh`, open `chrome://extensions`, remove the old Celluloid extension entry, and load the `stremio-mpv-extension` folder as an unpacked extension. The extension currently understands Stremio's Base64-compressed `#/player/` route and its VLC/mpv/IINA/outplayer links. If Stremio changes that route format, `content.js` will need a small matching update.
