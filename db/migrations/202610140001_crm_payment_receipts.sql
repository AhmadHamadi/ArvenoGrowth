-- Keep Stripe's standard receipt URL beside the verified payment history.
alter table public.crm_payments
  add column if not exists receipt_url text;
