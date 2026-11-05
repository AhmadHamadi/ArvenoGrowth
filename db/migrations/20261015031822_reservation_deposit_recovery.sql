-- Track expired/failed Checkout sessions and allow safe re-creation of their link.
alter table public.crm_reservation_deposits
  add column if not exists checkout_attempt integer not null default 1 check (checkout_attempt >= 1),
  add column if not exists refund_attempt integer not null default 0 check (refund_attempt >= 0),
  add column if not exists refund_previous_status text;

alter table public.crm_reservation_deposits
  drop constraint if exists crm_reservation_deposits_status_check;
alter table public.crm_reservation_deposits
  add constraint crm_reservation_deposits_status_check check (
    status in ('checkout_pending', 'checkout_failed', 'checkout_expired', 'paid', 'refund_pending', 'partially_refunded', 'refunded', 'payment_failed')
  );

alter table public.crm_reservation_deposits
  drop constraint if exists crm_reservation_deposits_refund_previous_status_check;
alter table public.crm_reservation_deposits
  add constraint crm_reservation_deposits_refund_previous_status_check check (
    refund_previous_status is null or refund_previous_status in ('paid', 'partially_refunded')
  );
