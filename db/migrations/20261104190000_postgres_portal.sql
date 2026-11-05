-- Plain Postgres portal support: signed PDF storage and portal sign-in.
-- Safe to run on Supabase too (it only adds tables).

create table if not exists public.crm_files (
  bucket text not null,
  path text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes integer not null,
  bytes bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, path),
  constraint crm_files_size_limit check (size_bytes between 0 and 10485760)
);

create table if not exists public.crm_admin_users (
  email text primary key,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_admin_users_email_lower check (email = lower(trim(email)) and length(email) > 3)
);

alter table public.crm_files enable row level security;
alter table public.crm_admin_users enable row level security;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then
  execute 'revoke all on public.crm_files from anon, authenticated';
  execute 'revoke all on public.crm_admin_users from anon, authenticated';
  execute 'grant all on public.crm_files to service_role';
  execute 'grant all on public.crm_admin_users to service_role';
end if; end $$;

drop trigger if exists crm_files_touch_updated_at on public.crm_files;
create trigger crm_files_touch_updated_at before update on public.crm_files
for each row execute function public.touch_contract_updated_at();
drop trigger if exists crm_admin_users_touch_updated_at on public.crm_admin_users;
create trigger crm_admin_users_touch_updated_at before update on public.crm_admin_users
for each row execute function public.touch_contract_updated_at();
