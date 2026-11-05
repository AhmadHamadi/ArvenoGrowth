-- Keep the active customer-facing signing URL beside the CRM agreement so an
-- Admin can reopen/copy it; the server still validates its hash and expiry.
alter table public.contracts add column if not exists signing_url text;
