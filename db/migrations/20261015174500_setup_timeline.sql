-- Dates for the client setup timeline. The 14-day window starts after the first
-- successful setup payment (or the saved-card event for zero-setup agreements).
alter table public.contracts
  add column if not exists setup_started_at timestamptz,
  add column if not exists setup_due_at timestamptz;
