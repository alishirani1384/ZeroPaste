# ZeroPaste

Open-source clipboard manager — Paste.app-style UI on Windows/Linux/Android, CopyCat-style sync via Supabase, **default-on E2E encryption**.

## Apps

| App | Path | Stack |
|-----|------|--------|
| Desktop | `apps/desktop` | Electrobun (Win/Linux) |
| Native | `apps/native` | Expo / React Native (Android) |
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
bun run dev:native     # Expo
```

Desktop hotkey: **Ctrl+Shift+V**. Bridge API: `http://127.0.0.1:47821`.

**Linux:** see [apps/desktop/LINUX.md](./apps/desktop/LINUX.md) for X11 (`xdotool`, `xclip`) and Wayland (`wtype`/`ydotool`, `wl-copy`) paste tools. Electrobun needs GTK/WebKitGTK build deps on Ubuntu 22.04+.

### Vault (E2E)

On first launch, create a vault passphrase and save the recovery key. Unlock is required before the clipboard shelf. Lock from the toolbar. Account/sync UI: `/account`.

## Supabase

1. Create a free project and run `supabase/migrations/*.sql`
2. Copy `apps/web/.env.example` → `apps/web/.env` with URL + anon key
3. Sign in at `/account` — clips sync as ciphertext only

See [SECURITY.md](./SECURITY.md).
