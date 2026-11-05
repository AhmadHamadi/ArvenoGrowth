-- Keep one Stripe customer identity per reusable CRM client across agreements.
alter table public.clients add column if not exists stripe_customer_id text;
