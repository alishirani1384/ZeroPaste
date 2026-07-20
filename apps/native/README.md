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
