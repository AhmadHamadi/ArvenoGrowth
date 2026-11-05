-- Store the payment method the client saved in Checkout so recurring billing
-- can start at the setup completion date without asking them to check out twice.
alter table public.contracts
  add column if not exists stripe_payment_method_id text;
