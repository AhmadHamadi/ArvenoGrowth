-- Stripe billing state for the private CRM. Only the authenticated Vercel API
-- uses the service key; browser clients receive no access to these tables.
alter table public.contracts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_setup_checkout_session_id text,
  add column if not exists stripe_setup_mode text,
  add column if not exists setup_payment_status text not null default 'not_started',
  add column if not exists setup_installments_paid integer not null default 0,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists stripe_service_checkout_session_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text not null default 'not_started',
  add column if not exists onboarding_status text not null default 'contract_sent',
  add column if not exists stripe_paid_total numeric(12,2) not null default 0,
  add column if not exists stripe_last_payment_at timestamptz;

update public.contracts set setup_payment_status = 'not_required' where setup_fee = 0 and setup_payment_status = 'not_started';
update public.contracts set onboarding_status = case when status = 'signed' then 'signed' else 'contract_sent' end where onboarding_status = 'contract_sent';

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  stripe_object_id text not null unique,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  billing_kind text not null check (billing_kind in ('setup_full', 'setup_installment', 'service_monthly', 'refund')),
  amount_paid numeric(12,2) not null,
  currency text not null check (currency in ('CAD', 'USD')),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists crm_payments_contract_paid_idx on public.crm_payments(contract_id, paid_at desc);
create index if not exists crm_payments_currency_paid_idx on public.crm_payments(currency, paid_at desc);
alter table public.crm_payments enable row level security;
revoke all on public.crm_payments from anon, authenticated;
grant all on public.crm_payments to service_role;

create table if not exists public.crm_stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.crm_stripe_events enable row level security;
revoke all on public.crm_stripe_events from anon, authenticated;
grant all on public.crm_stripe_events to service_role;
