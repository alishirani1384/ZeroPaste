# ZeroPaste Native (Android)

Paste 6–style clipboard history for Android: liquid-glass bottom bar, pinboards, search/filters, Quick Look, vault + encrypted Supabase sync.

## Setup

```bash
# from repo root
bun install

# apps/native/.env needs the same Supabase project as desktop/web:
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY

bun run dev:native          # Expo Go / Metro (limited native modules)
```

## Android native build (recommended)

Uses the ZeroPaste logo from `apps/web/public/favicon/` (`web-app-manifest-512x512.png`).

```bash
cd apps/native

# 1) Generate the android/ project (links zeropaste-source UsageStats module)
bun run prebuild:android

# 2) Debug install on emulator/device
bun run android

# or release APK/AAB locally
bun run build:android
```

From repo root:

```bash
bun run prebuild:native
bun run android:native
```

### After install

1. Open **Account → Enable Usage Access** so local clips can show source app names  
2. Sign in with the same account as desktop and unlock the vault  

### GitHub Actions release (recommended)

Builds a **publish-key–signed** sideload APK on Ubuntu and attaches it to a [GitHub Release](https://github.com/alishirani1384/ZeroPaste/releases).

Workflow: `.github/workflows/release.yml` (Android job).

#### One-time: create a release keystore

Do this once on a secure machine. **Back up the `.keystore` file and passwords offline** — losing them means you cannot update the same package name with a new signature (users must uninstall first).

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore zeropaste-release.keystore \
  -alias zeropaste \
  -keyalg RSA -keysize 2048 -validity 10000
```

Encode for GitHub (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("zeropaste-release.keystore")) | Set-Clipboard
```

Or (macOS/Linux):

```bash
base64 -w0 zeropaste-release.keystore | pbcopy   # or xclip / just print
```

#### Required Actions secrets

| Secret | Purpose |
|--------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Baked into the APK |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Baked into the APK |
| `ANDROID_KEYSTORE_BASE64` | Base64 of `zeropaste-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | e.g. `zeropaste` |
| `ANDROID_KEY_PASSWORD` | Key password (often same as store) |

Optional: `EXPO_PUBLIC_SERVER_URL`

Ship by bumping `apps/native/package.json` version and pushing to `main` (or **Actions → Release → Run workflow** with force Android).

**Note:** Builds signed with the old debug key cannot update in place over a publish-key APK (and vice versa). Uninstall the debug build first.

### Local release signing

After `bun run prebuild:android`:

```bash
# place keystore at apps/native/android/app/zeropaste-release.keystore
export ANDROID_KEYSTORE_PASSWORD=...
export ANDROID_KEY_ALIAS=zeropaste
export ANDROID_KEY_PASSWORD=...
bun run configure:android-signing
bun run build:android
```

### EAS (optional)

```bash
cd apps/native
npx eas-cli build --platform android --profile preview
```

## Capture limits (Android)

Android **blocks silent background clipboard reads** (privacy). ZeroPaste stays ready via a **foreground service** + sticky notification:

1. Copy in another app  
2. The watcher briefly gains focus, reads the clip, and stores it  
3. Or open ZeroPaste — it also retries + polls while visible  

Toggle in **Account → Stay ready in background**. Notification actions: **Capture now** / **Stop**.

**Source app names** need this **native/dev build** plus **Usage Access**. Expo Go cannot ship that module. Synced desktop clips still keep real app names from Windows/Linux.

## Icons

| Asset | Source |
|-------|--------|
| `assets/icon.png` | `apps/web/public/favicon/web-app-manifest-512x512.png` |
| `assets/adaptive-icon.png` | same |
| `assets/splash-icon.png` | same |
| `assets/favicon.png` | `favicon-96x96.png` |
