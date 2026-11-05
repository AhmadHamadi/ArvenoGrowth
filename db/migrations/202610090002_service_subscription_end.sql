-- Display the scheduled end of a finite-term service subscription in the CRM.
alter table public.contracts
  add column if not exists stripe_subscription_end_at timestamptz;
