-- Encrypted-at-rest vault wraps for multi-device restore.
-- LocalVaultMeta (salt + wraps + verify) is safe to sync: vault key stays
-- wrapped by passphrase/recovery; cloud cannot decrypt without those secrets.
alter table public.profiles
  add column if not exists vault_meta jsonb;

comment on column public.profiles.vault_meta is
  'LocalVaultMeta JSON (passphrase/recovery wraps). Not the raw vault key.';
