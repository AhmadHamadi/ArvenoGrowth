-- Retain the business name the client types when signing, beside their typed name.
alter table public.contracts
  add column if not exists signed_by_business text;
