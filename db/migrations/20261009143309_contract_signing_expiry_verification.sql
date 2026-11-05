-- Signing links are valid for 24 hours. A signed PDF remains pending until an
-- Admin verifies it; Drive filing can be attached to that explicit decision.
alter table public.contracts
  add column if not exists signing_expires_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by text,
  add column if not exists drive_file_id text,
  add column if not exists drive_file_url text;
