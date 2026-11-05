-- Keep client and agreement history while allowing former clients to be hidden
-- from new-contract workflows and restored later.
alter table public.clients
  add column if not exists former_at timestamptz;
