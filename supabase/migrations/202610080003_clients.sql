-- Reusable CRM client records. Contracts keep a snapshot of billing/contact
-- details and reference the client record for grouping and future agreements.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_business_name_nonempty check (length(trim(business_name)) > 0),
  constraint clients_first_name_nonempty check (length(trim(first_name)) > 0),
  constraint clients_last_name_nonempty check (length(trim(last_name)) > 0),
  constraint clients_email_nonempty check (length(trim(email)) > 0)
);

create unique index if not exists clients_business_email_unique_idx
  on public.clients (lower(business_name), lower(email));
create index if not exists clients_name_idx on public.clients (lower(last_name), lower(first_name));

alter table public.clients enable row level security;
revoke all on public.clients from anon, authenticated;
grant all on public.clients to service_role;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at before update on public.clients
for each row execute function public.touch_contract_updated_at();

alter table public.contracts
  add column if not exists client_id uuid references public.clients(id) on delete restrict;
create index if not exists contracts_client_created_idx on public.contracts(client_id, created_at desc);
