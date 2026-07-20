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

For a classic **NSIS / MSI** installer, use a third-party packager such as  
[electrobun-builder-for-windows](https://github.com/Catharacta/electrobun-builder) after the Electrobun build.

## Icons

Config (already set):

```ts
build.win.icon = "assets/zeropaste.ico"
build.linux.icon = "assets/zeropaste.png"
```

Electrobun itself often fails to embed icons (`rcedit` resolve bug [#429](https://github.com/blackboardsh/electrobun/issues/429)).  
We run `scripts/brand-windows-icons.ts` on **postBuild** + **postPackage** to force-embed the logo.

After rebuilding, taskbar / Setup / launcher should show the ZeroPaste icon instead of Bun.

## Rebuild

```bash
bun run build:stable
# from apps/desktop, or via turbo from repo root
```

## Linux

Ship the AppImage from the Linux build artifacts. Icon comes from `build.linux.icon`.
