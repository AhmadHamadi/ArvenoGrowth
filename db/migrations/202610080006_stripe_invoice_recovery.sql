-- Surface an unpaid Stripe invoice to Admin when automatic email delivery is
-- not configured, and clear it when that invoice is paid.
alter table public.contracts
  add column if not exists stripe_latest_invoice_id text,
  add column if not exists stripe_latest_invoice_url text;
