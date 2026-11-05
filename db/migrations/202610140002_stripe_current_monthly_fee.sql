-- Keep the amount Stripe currently bills visible beside the signed monthly fee.
alter table public.contracts
  add column if not exists stripe_current_monthly_fee numeric(10, 2);
