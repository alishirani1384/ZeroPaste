# ZeroPaste

Open-source clipboard manager — Paste.app-style UI on Windows/Linux/Android, CopyCat-style sync via Supabase, **default-on E2E encryption**.

## Apps

| App | Path | Stack |
|-----|------|--------|
| Desktop | `apps/desktop` | Electrobun (Win/Linux) |
| Native | `apps/native` | Expo / React Native (Android native build) |
| Web UI | `apps/web` | Next.js (desktop panel + later account) |

## Packages

- `@paste/clipboard-core` — clip model, classifier, search, seed data
- `@paste/crypto` — Argon2id + AES-GCM envelopes
- `@paste/env`, `@paste/ui`, `@paste/config`

## Develop

```bash
bun install
bun run dev:web        # UI at http://localhost:3001
bun run dev:desktop    # Electrobun + HMR (clipboard bridge on :47821)
bun run dev:native     # Expo Metro
bun run prebuild:native && bun run android:native  # Android APK install
```

Desktop hotkey: **Ctrl+Shift+V**. Bridge API: `http://127.0.0.1:47821`.

**Android:** [apps/native/README.md](./apps/native/README.md) — icon from `apps/web/public/favicon/`. Background clipboard watch uses a sticky notification (Account → Stay ready in background).

**Linux:** see [apps/desktop/LINUX.md](./apps/desktop/LINUX.md) for X11 (`xdotool`, `xclip`) and Wayland (`wtype`/`ydotool`, `wl-copy`) paste tools. Electrobun needs GTK/WebKitGTK build deps on Ubuntu 22.04+.

### Journey (desktop)

1. **Account** — sign in / sign up, or Continue offline  
2. **Vault** — create (new), unlock (local), or restore wraps from cloud then unlock  
3. **Shelf** — history persists in `~/.zeropaste/`; cloud pull/push when signed in  

Lock from the toolbar. Account/sync: cloud icon or `/account`.

## Supabase

1. Create a free project and run **all** `supabase/migrations/*.sql` (includes `vault_meta`)  
2. Copy `apps/web/.env.example` → `apps/web/.env` with URL + anon key  
3. Sign in during onboarding — vault wraps + clips sync as ciphertext only

See [SECURITY.md](./SECURITY.md).
