# ZeroPaste packaging (Windows / Linux)

## What to send someone (Windows)

**Do not send only `ZeroPaste-Setup.exe` (≈0.4 MB).**  
That file is a tiny extractor. The real app is the sibling archive.

### Best option
Send the zip from artifacts:

`apps/desktop/artifacts/stable-win-x64-ZeroPaste-Setup.zip`

It contains everything the recipient needs.

### Or send these two files together
From `apps/desktop/build/stable-win-x64/`:

1. `ZeroPaste-Setup.exe`
2. `ZeroPaste-Setup.tar.zst` (**required**, ~275 MB)

They must stay in the **same folder** when the user runs the Setup exe.

## Why it looks like a console extractor (not Electron NSIS)

Electrobun’s default Windows “installer” is **not** an Electron-style wizard. It is:

1. A small extractor EXE (opens a console briefly)
2. A `.tar.zst` archive next to it
3. Extract → install/run

That is expected for stock Electrobun (`electrobun build --env=stable`).
A brief console window during extract is normal for `ZeroPaste-Setup.exe`.

**If Setup.exe does nothing when double-clicked:** it must stay next to
`ZeroPaste-Setup.tar.zst`, and it must remain a **console** binary. Do not
force GUI subsystem on Setup (only on `launcher.exe` / `bun.exe`).

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
We run `scripts/brand-windows-icons.ts` on **postBuild** + **postPackage** to force-embed the logo.

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

Ship the AppImage from the Linux build artifacts. Icon comes from `build.linux.icon`.
