# Arveno Growth CRM: current setup

## Database: Postgres support in `feature/postgres-portal` (2026-11-04)

This branch adds a plain-Postgres backend. Production still runs on Supabase from `main` until a separately approved deployment and data migration are complete. On this branch, setting `DATABASE_URL` selects Postgres even when Supabase variables remain set; Vercel Preview and Production must never share a database URL.

**Run it locally (no installs, no Docker):**

```bash
npm install
npm run db -- admin you@yourdomain.com   # first time: creates the local DB + your portal login
npm run dev:portal                        # site + portal + API + DB on http://localhost:3000 (portal: /admin)
```

The local database lives in `.data/postgres` (git-ignored). `npm run db -- status` shows tables and row counts, `npm run db:local` runs only the database, and `npm run db:migrate` applies `db/migrations`.

**Production migration plan (not started; Ahmad approves each gate):**

1. Create separate, isolated Postgres targets for Vercel Preview/staging and Production. In Vercel, set the Preview `DATABASE_URL` only to synthetic-data staging and the Production `DATABASE_URL` only to the migrated production database. Never put the Production URL in Preview; never add one URL to all environments. A Preview URL selects Postgres and can expose/write whatever data is in that target.
2. Use the provider's TLS-enabled connection string with certificate validation. Do not set `DATABASE_SSL=no-verify` in Production; that disables certificate verification. Confirm the selected pooler supports both the Vercel API and the migration CLI.
3. Validate Preview against synthetic data only. Do not copy live client records or signed PDFs into a public/protected Preview environment. Set a separate Preview `ADMIN_SESSION_SECRET` and verify the admin allowlist.
4. For Production migration, schedule a maintenance window and pause CRM writes before the final export/import. `import-supabase` currently pages with `offset`, inserts rows, and ignores conflicts; it does **not** update an already-imported row. Record source/destination table counts and signed-file counts. Missing PDFs currently warn and continue, so resolve every warning and compare counts before cutover.
5. Create the Production Postgres schema and import the final, write-frozen Supabase snapshot. Supabase remains the source of truth until the final reconciliation is accepted. Run the Production admin-password setup separately because Supabase Auth passwords cannot be exported.
6. Set the Production-scoped `DATABASE_URL` and `ADMIN_SESSION_SECRET`; retain `CONTRACT_ADMIN_EMAILS`. Preview must remain on its separate staging URL. Confirm API health, sign-in, clients, contracts, signed-PDF downloads, billing history, webhooks, and logs without making a real payment.
7. Decide the rollback point before accepting writes. Once Production Postgres has accepted new CRM writes, simply removing `DATABASE_URL` sends the app back to stale Supabase and can lose those writes. A safe rollback requires a tested reverse-sync/restore procedure or an explicit decision to keep Postgres authoritative.
8. Keep Supabase backups and credentials until reconciliation, a restore drill, and the agreed stabilization period are complete. Do not remove `SUPABASE_*` / `VITE_SUPABASE_*` variables until the code path and rollback plan no longer require them.

How it works: `lib/db.js` runs the handlers' existing REST-style requests (`contracts?id=eq.X&select=...`) as parameterized SQL, so no handler changed. Signed PDFs live in `crm_files`; portal logins live in `crm_admin_users` (scrypt hashes, 5-try lockout, 30-day signed sessions remembered on the device until sign-out; a password reset ends them all). `tests/postgres.test.js` runs the API against a real temporary Postgres. The importer is an insert-only copy tool, not a live replication or rollback system.

---

The sections below describe the current Supabase production setup, which stays in place until the move above is done.

## Project and domain map

| Environment | Vercel project | Supabase project | Supabase URL |
|---|---|---|---|
| Production | `arveno-growth` | `Arveno Growth Database` (`bsafayqiszcdiqgewmfs`) | `https://bsafayqiszcdiqgewmfs.supabase.co` |
| Preview branch `feature/arveno-growth-website` | `arveno-growth` | `Arveno Growth Preview CRM` (`ckanqxvbwshyhaduzmgz`) | `https://ckanqxvbwshyhaduzmgz.supabase.co` |

These are the normal Supabase project domains. Production resolves to the Production project; both generic Preview and the CRM Preview branch resolve to the Preview project. The public Vite URL and publishable key have separate Production and Preview scopes. The CRM branch also has a branch-scoped server URL and secret key. Do not use `NEXT_PUBLIC_SUPABASE_URL` in this Vite app; it is a stale compatibility variable and is not the active client configuration.

The Vercel project is `arveno-growth` in the `averno-growth` team. The public site uses `https://www.arvenogrowth.com` / `https://arvenogrowth.com`; the CRM route is `/admin`. Preview deployments may be protected by Vercel Authentication.

## Supabase schema status

The Production project is healthy and has the CRM schema applied. It contains `clients`, `contracts`, `crm_payments`, `crm_stripe_events`, `crm_leads`, and `crm_tasks`; all six tables have row-level security enabled, with access routed through the authenticated server API. Additive fields track Stripe receipt URLs and Stripe's current recurring amount separately from signed contract terms. The `signed-contracts` bucket is private with a 10 MiB PDF limit. CRM tables contain real records only; the admin creates no sample clients, leads, tasks, or payments.

Preview has its separate schema and database. Its `crm_reservation_deposits` table was added on the Preview project only; Production was not changed for this feature. Do not copy Preview records into Production as part of setup. Admin API access uses the server-only Supabase secret key; browser access uses the publishable key. Never expose the secret key with a `VITE_` or `NEXT_PUBLIC_` prefix.

## Stripe status

The Arveno Growth Stripe account is connected in live mode. Vercel Production has the live key, webhook signing secret, and `STRIPE_LIVE_MODE_ENABLED`; the Production endpoint is `https://www.arvenogrowth.com/api/stripe/webhook`. The endpoint syncs completed checkouts, paid/failed invoices, subscription changes, successful charges, and refunds. Keep all secret values server-side. Never run test payments through Production. Preview must use its separate test-mode key and webhook secret.

For current contract version 7, the client signs first, then pays the signed setup fee through one Stripe Checkout. That checkout saves the payment method and starts the signed monthly service subscription automatically 14 calendar days after the first successful setup payment (or saved-card setup when no setup fee is due); no separate monthly link is needed. The CRM tracks the scheduled service billing alongside the 14-day setup-completion deadline, and fixed terms stop after the agreed successful monthly charges. Setup can be paid in full or in three installments. The CRM also has a separate refundable reservation-deposit flow for a client already in the CRM: it creates a one-time Checkout link, records payment only from a verified Stripe webhook, keeps its receipt, supports renewal of expired/failed links, and lets an admin request or complete a full refund. Delayed payment success/failure, partial refunds, failed refunds, and out-of-order refund events are synced separately from contract billing. Deposit amounts do not silently reduce signed setup fees; crediting one requires a signed agreement or amendment and must be reconciled against the remaining setup collection. Stripe may retain the original processing fee when the client receives a full refund. No Stripe Tax is applied. Formal one-time Stripe invoices remain disabled; use Checkout receipts and Stripe's subscription invoices without activating the separately priced one-time invoice feature.

## Email and Drive status

Production and Preview have Resend configuration. Website lead notification and four-minute no-booking follow-up use the transactional email path. Production emails the client a signing invitation when an agreement is saved; Preview intentionally suppresses client invitations. After signature, the signed PDF and payment link are emailed. Keep API keys server-side and do not print or copy their values into source control.

Signed PDFs are stored in Supabase private storage and can be downloaded from the client record after signing. The signature form requires a drawn signature, a typed full name, the exact business name from the agreement, and a date; the typed business is stored beside the typed name in the CRM and signed PDF. Google Drive filing is not connected to the app: the Drive MCP connection alone does not upload verified PDFs to a `Contracts` folder. Calendly read access is configured for upcoming and recent past meetings. Google Calendar still needs a valid app-side authorization; it is not currently connected to the CRM. Website booking continues through the public Calendly link.

## Contract and CRM behavior

- A contract invite is emailed from Production when the admin saves it. The client must provide a drawn signature, typed full name, matching typed business name, and date. New signing links expire after 24 hours; Admin can email the active link again or renew it.
- Signed PDFs remain pending until an Admin verifies them. CRM client records group contacts and agreements by business; marking a client former preserves prior agreements.
- Monthly amounts follow the selected contract package. Foundation Engine is $297 USD/month for 12 months. Setup can be paid once or split across three installments. Fixed terms stop after the required successful billing cycles; month-to-month has no automatic end date.
- The CRM tracks payments from verified Stripe webhooks; signed contract totals alone are not payments collected.
- The CRM admin user must exist in the matching Supabase Auth project and its email must match `CONTRACT_ADMIN_EMAILS` for that deployment. There is no shared `admin/123` login; sign in with the authorized email and Supabase password.
- Clients, contracts, leads, tasks, billing, payment history, and receipt links live in separate CRM sections, with agreements and billing history grouped on each client record.

## Safe deployment checklist

1. Keep Vercel Production pointed only at `bsafayqiszcdiqgewmfs`; keep the Preview branch `feature/arveno-growth-website` pointed only at `ckanqxvbwshyhaduzmgz`.
2. `SUPABASE_SECRET_KEY` is now marked **Secret** for Production and remains server-only. Keep it paired with that environment's Supabase URL. Preview already stores its server key as a branch-scoped Secret.
3. Production Stripe and email settings are configured. When publishing CRM or site changes, target this existing `arveno-growth` project and retain the Production-to-Production Supabase mapping.
4. Do not enable paid Supabase/Vercel/Resend features without checking the price and getting the user's approval. A custom Supabase domain is not required; the project-ref `.supabase.co` hostname is correct.
