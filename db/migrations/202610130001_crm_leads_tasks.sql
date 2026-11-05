-- Real website leads and internal follow-up tasks for the private CRM.
-- Access is through the authenticated Vercel API using the service role only.
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business text,
  email text not null,
  phone text,
  city text,
  services text,
  website text,
  message text,
  source text not null default 'website',
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contacted_at timestamptz
);
create index if not exists crm_leads_stage_created_idx on public.crm_leads (stage, created_at desc);
create index if not exists crm_leads_email_idx on public.crm_leads (lower(email));
alter table public.crm_leads enable row level security;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'revoke all on public.crm_leads from anon, authenticated'; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant all on public.crm_leads to service_role'; end if; end $$;

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 180),
  details text,
  due_at date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists crm_tasks_status_due_idx on public.crm_tasks (status, due_at);
alter table public.crm_tasks enable row level security;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'revoke all on public.crm_tasks from anon, authenticated'; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant all on public.crm_tasks to service_role'; end if; end $$;

create or replace function public.touch_crm_record_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists crm_leads_touch_updated_at on public.crm_leads;
create trigger crm_leads_touch_updated_at before update on public.crm_leads
for each row execute function public.touch_crm_record_updated_at();
drop trigger if exists crm_tasks_touch_updated_at on public.crm_tasks;
create trigger crm_tasks_touch_updated_at before update on public.crm_tasks
for each row execute function public.touch_crm_record_updated_at();
