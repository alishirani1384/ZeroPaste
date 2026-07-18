export type ClipRow = {
  id: string;
  user_id: string;
  device_id: string | null;
  kind: string | null;
  byte_size: number | null;
  ciphertext: string;
  nonce: string;
  wrapped_key: string;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
