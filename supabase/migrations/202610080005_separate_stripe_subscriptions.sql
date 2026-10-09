-- Setup installment collection and ongoing service billing are distinct
-- subscriptions. Keep their lifecycle state in separate CRM fields.
alter table public.contracts
  add column if not exists stripe_setup_subscription_id text,
  add column if not exists stripe_setup_subscription_status text not null default 'not_started';
