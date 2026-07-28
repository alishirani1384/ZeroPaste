# ZeroPaste packaging (Windows / Linux)

## CI release (GitHub Actions)

Workflow: [`.github/workflows/release.yml`](../../.github/workflows/release.yml)

1. Bump `version` in `apps/desktop/package.json` (and/or `apps/native/package.json`)
2. Push to `main`
3. CI publishes only apps whose version **changed** in that push  
   - Desktop → tag `desktop-vX.Y.Z` with **Windows Setup zip** + **Linux Setup tar.gz**  
   - Android → tag `android-vX.Y.Z` + APK  

Manual: Actions → **Release** → Run workflow → force Android/Desktop.

## What to send someone (Windows)

**Do not send only `ZeroPaste-Setup.exe` (≈0.4 MB).**  
That file is a tiny extractor. The real app is the sibling archive.

### Best option
Send the zip from artifacts:

`apps/desktop/artifacts/stable-win-x64-ZeroPaste-Setup.zip`

It contains everything the recipient needs. After unzipping, they should run
**`Install ZeroPaste.exe`** (not Setup alone) — that runs Electrobun’s extractor,
then launches ZeroPaste automatically when install finishes.

Zip layout:

| Path | Role |
|---|---|
| `Install ZeroPaste.exe` | **Double-click this** — install + auto-launch |
| `ZeroPaste-Setup.exe` | Electrobun extractor (called by the wrapper) |
| `.installer/ZeroPaste-Setup.tar.zst` | App payload |
| `.installer/ZeroPaste-Setup.metadata.json` | Channel / identity |

### Or send these files together
From `apps/desktop/build/stable-win-x64/`:

1. `Install ZeroPaste.exe` (recommended entry point)
2. `ZeroPaste-Setup.exe`
3. `ZeroPaste-Setup.tar.zst` (or the `.installer/` folder from the zip)

`Install ZeroPaste.exe` and Setup must stay next to the archive / `.installer` folder.

## Why it looks like a console extractor (not Electron NSIS)

Electrobun’s default Windows “installer” is **not** an Electron-style wizard. It is:

1. A small extractor EXE (opens a console briefly)
2. A `.tar.zst` archive (usually under `.installer/`)
3. Extract → shortcuts — **does not** start the app by itself

`Install ZeroPaste.exe` (built in `postPackage`) wraps that flow and starts
`launcher.exe` when extract finishes. That is expected for stock Electrobun
(`electrobun build --env=stable`). A brief console window during extract is
normal for `ZeroPaste-Setup.exe`.

**If Setup.exe does nothing when double-clicked:** keep the `.installer` folder
(or adjacent `.tar.zst`) next to it, and keep Setup a **console** binary. Do not
force GUI subsystem on Setup (only on `launcher.exe` / `bun.exe` / the Install wrapper).

For a classic **NSIS / MSI** installer, use a third-party packager such as  
[electrobun-builder-for-windows](https://github.com/Catharacta/electrobun-builder) after the Electrobun build.

## Desktop shortcut & uninstall (Windows)

Electrobun’s stock `ZeroPaste-Setup.exe` is only an extractor. It does **not** create a
desktop shortcut or an Apps & Features uninstall entry by itself.

ZeroPaste does this on **every launch** of a packaged `launcher` / `bun` host:

| Item | Location |
|---|---|
| Desktop shortcut | Desktop `\ZeroPaste.lnk` (OneDrive Desktop if redirected) |
| Start Menu | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\ZeroPaste.lnk` |
| Uninstall entry | Settings → Apps → Installed apps → **ZeroPaste** |
| Uninstall script | `%USERPROFILE%\.zeropaste\uninstall.ps1` (**always written first**) |
| Login autostart | hidden `wscript` → launcher `--autostart` (no PowerShell window) |

If `uninstall.ps1` is missing after a launch, check the host log for
`skip desktop integration` or `uninstall registration failed` — older builds
skipped when `process.execPath` was `bun.exe` instead of `launcher.exe`.

### How to uninstall fully

1. **Recommended:** Settings → Apps → Installed apps → ZeroPaste → Uninstall  
2. **Or run:**
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.zeropaste\uninstall.ps1"
   ```

That removes:

- Running ZeroPaste processes  
- Login autostart (Run key)  
- Desktop + Start Menu shortcuts  
- Install folder under `%LOCALAPPDATA%\app.zeropaste.desktop\`  
- User data in `%USERPROFILE%\.zeropaste\` (vault meta / local clips)  
- The Apps & Features uninstall entry  

### Want a classic NSIS wizard (shortcuts at install time)?

Use [electrobun-builder-for-windows](https://github.com/Catharacta/electrobun-builder) after `electrobun build --env=stable` to produce NSIS/MSI with built-in shortcut + uninstall UI.

## Dynamic window size (WebView2)

WebView2 cannot click through transparent pixels. The host HWND is resized to the
opaque UI via `POST /window-fit`.

**Critical:** create the window at the **max** canvas (shelf + Quick Look). Growing
past the create size leaves dead click zones ([electrobun#410](https://github.com/blackboardsh/electrobun/issues/410)).
Vault/account steps shrink that HWND; the shelf grows back within the ceiling.

Stay on `bundleCEF: false` + `defaultRenderer: "native"`.

## Icons

Config (already set):

```ts
build.win.icon = "assets/zeropaste.ico"
build.linux.icon = "assets/zeropaste.png"
```

Electrobun itself often fails to embed icons (`rcedit` resolve bug [#429](https://github.com/blackboardsh/electrobun/issues/429)).  
We run `scripts/brand-windows-icons.ts` on **postBuild** + **postPackage** to force-embed the logo via **resedit** (strip all `RT_ICON` / `RT_GROUP_ICON`, then write one clean multi-size group). Plain `rcedit --set-icon` left Bun’s primary group pointing at 16×16 → blurry taskbar.

`assets/zeropaste.ico` must be a **multi-size** ICO (16–256). A single 48px frame looks fine in the tray overflow but pixelates on the taskbar (HiDPI upscale). Regenerate from the master PNG:

```bash
python apps/desktop/scripts/generate-icons.py
```

After rebuilding, taskbar / Setup / launcher should show a sharp ZeroPaste icon. If Windows still shows a blurry cached icon, restart the app (or sign out / restart Explorer once).

## Rebuild

```bash
bun run build:stable
# from apps/desktop, or via turbo from repo root
```

## Linux

CI publishes `ZeroPaste-desktop-vX.Y.Z-linux-x64-Setup.tar.gz` (Electrobun self-extracting
`installer` + README — not AppImage, so no libfuse2). Icon comes from `build.linux.icon`.

```bash
tar -xzf ZeroPaste-desktop-vX.Y.Z-linux-x64-Setup.tar.gz
./installer
```

Extracts to `~/.local/share/` and creates a desktop shortcut.
