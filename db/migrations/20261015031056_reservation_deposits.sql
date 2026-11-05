-- Client reservation deposits are independent of a contract payment ledger.
-- Stripe webhooks, not browser redirects, move a deposit to paid/refunded.
create table if not exists public.crm_reservation_deposits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_refund_id text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('CAD', 'USD')),
  status text not null default 'checkout_pending'
    check (status in ('checkout_pending', 'paid', 'refund_pending', 'partially_refunded', 'refunded', 'payment_failed')),
  checkout_url text,
  receipt_url text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_reservation_deposits_client_idx
  on public.crm_reservation_deposits(client_id, created_at desc);
create index if not exists crm_reservation_deposits_status_idx
  on public.crm_reservation_deposits(status, created_at desc);
alter table public.crm_reservation_deposits enable row level security;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'revoke all on public.crm_reservation_deposits from anon, authenticated'; end if; end $$;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant all on public.crm_reservation_deposits to service_role'; end if; end $$;
drop trigger if exists reservation_deposits_touch_updated_at on public.crm_reservation_deposits;
create trigger reservation_deposits_touch_updated_at before update on public.crm_reservation_deposits
for each row execute function public.touch_contract_updated_at();
