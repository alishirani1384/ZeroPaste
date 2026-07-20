# ZeroPaste on Linux

Electrobun officially supports **Ubuntu 22.04+** (GTK3 + webkit2gtk-4.1). Other distros are community-supported.

## Required build packages (Ubuntu/Debian)

```bash
sudo apt install build-essential cmake pkg-config \
  libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

## Paste / focus tools

ZeroPaste uses Electrobun `showInactive()` so the shelf can open without stealing focus, then injects **Ctrl+V** into the caret app.

| Session | Install | Used for |
|---------|---------|----------|
| **X11** | `sudo apt install xdotool xclip` | Focus capture, window activate, Ctrl+V, clipboard fallback |
| **Wayland** | `ydotool` or `wtype`, plus `wl-clipboard` (`wl-copy`) | Ctrl+V + clipboard fallback |

Detect session: `echo $XDG_SESSION_TYPE` (`x11` or `wayland`).

On boot the host logs:

```text
[ZeroPaste] Linux session=wayland tools=[wl-copy, wtype]
```

### Wayland notes

- `xdotool` usually does **not** work on pure Wayland (only on XWayland windows).
- Prefer `wtype` (compositor-dependent) or `ydotool` (needs `ydotoold` / uinput permissions).
- Some compositors block synthetic input; if paste fails, check that the target app still has focus after opening the shelf.

## Run

```bash
bun install
bun run dev:desktop
```

Confirm health: `curl http://127.0.0.1:47821/health` — `hostBuild` should include `linux`.

## Autostart

On first launch ZeroPaste writes `~/.config/autostart/zeropaste.desktop` so it starts at login. Toggle under Account → “Start ZeroPaste when this device boots”.

## Icons

Packaged builds use `apps/desktop/assets/zeropaste.png` (AppImage / `.desktop` icon). Source master: `apps/desktop/zeropaste.png`.

## Feature parity

| Feature | Status |
|---------|--------|
| Shelf UI / vault / sync | Same as Windows |
| Clipboard capture | Electrobun `Utils.clipboard*` |
| Open without focus steal | `showInactive` + `activate: false` |
| Click / drag paste | Ctrl+V via xdotool / ydotool / wtype |
| Drag mouse watch | Electrobun `Screen.getMouseButtons` |
| Login autostart | `~/.config/autostart/zeropaste.desktop` |
| Win32 `WS_EX_NOACTIVATE` | Windows only (Linux uses showInactive) |
