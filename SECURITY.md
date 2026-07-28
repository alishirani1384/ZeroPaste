# ZeroPaste security

## Threat model

ZeroPaste assumes Supabase (Postgres, Realtime, Storage) and network observers are **untrusted for content confidentiality**. An attacker with full database access must not recover clip plaintext.

## Design

- **Supabase Auth** identifies the user and drives RLS only. Auth credentials are not vault keys.
- **Vault passphrase** → Argon2id → `vault_key`.
- Each clip uses a random content key, encrypted with **AES-256-GCM**, then the content key is wrapped with `vault_key`.
- Images/files are encrypted client-side before upload to Storage.
- **Search runs locally** over a decrypted cache (accurate FTS). The server never receives searchable plaintext indexes in v1.
- Device linking / desktop host secrets: Android uses SecureStore (Keystore). Desktop seals `~/.zeropaste` session and clipboard state with DPAPI (Windows CurrentUser) or AES-GCM keyed by a mode-0600 host key (Linux/macOS). The local bridge requires a per-install token (injected into the WebView); CORS is origin-locked (no `*`).

## What stays plaintext on the server

Minimal sync routing metadata only: ids, timestamps, optional coarse kind, byte size, storage path. Bodies, titles, source apps, URLs, and previews are ciphertext.

## Recovery

A one-time recovery key is generated at vault creation. Losing both passphrase and recovery key means cloud ciphertext cannot be decrypted.
