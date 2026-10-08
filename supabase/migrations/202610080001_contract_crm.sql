-- Private contract CRM. All data access goes through the authenticated Vercel API.
create extension if not exists pgcrypto;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  client_business text not null,
  client_contact text not null,
  client_email text not null,
  client_phone text,
  package_name text,
  currency text not null default 'CAD' check (currency in ('CAD', 'USD')),
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0),
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  status text not null default 'sent' check (status in ('draft', 'sent', 'signed', 'archived')),
  agreement jsonb not null,
  contract_token_hash text not null unique,
  signed_by text,
  signed_at timestamptz,
  signed_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_status_created_idx on public.contracts (status, created_at desc);
create index if not exists contracts_client_email_idx on public.contracts (lower(client_email));
alter table public.contracts enable row level security;
revoke all on public.contracts from anon, authenticated;
grant all on public.contracts to service_role;

create or replace function public.touch_contract_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists contracts_touch_updated_at on public.contracts;
create trigger contracts_touch_updated_at before update on public.contracts
for each row execute function public.touch_contract_updated_at();

-- Signed PDFs are kept private; downloads are provided only by the admin API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signed-contracts', 'signed-contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists "contract files are server managed" on storage.objects;
create policy "contract files are server managed" on storage.objects
for all to service_role using (bucket_id = 'signed-contracts') with check (bucket_id = 'signed-contracts');
