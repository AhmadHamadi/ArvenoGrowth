# Contract CRM setup

The CRM is served at `/admin`. It uses Supabase Auth for sign-in, a private Postgres table for client and agreement records, and a private Storage bucket for signed PDFs. The Vercel API verifies each access token with Supabase Auth and checks the email against `CONTRACT_ADMIN_EMAILS` before reading or changing records. The Supabase service-role key is server-only.

## Connect the database

1. In the [Supabase dashboard](https://supabase.com/dashboard), create an organization/project for Arveno Growth. Name the project `arveno-growth-crm`, generate a unique strong database password and save it in a password manager, and choose **Canada Central (`ca-central-1`)** for the Canada-based team. Supabase says the project region determines where its primary data is stored. The Free plan is fine for a short test, but it can pause after a week of low activity and does not include automatic backups; use a paid plan for the live client record system if you need it continuously available and backed up.
2. In the project, open **SQL Editor → New query**, paste the full contents of `supabase/migrations/202610080001_contract_crm.sql`, and run it. This creates the private contracts table and signed-PDF bucket.
3. Create the admin user in Supabase Auth. Use a unique account and a strong password; do not use a shared default password.
4. From **Project → Connect** or **Settings → API Keys**, copy the Project URL, **publishable** key, and **secret** key. Use the new `sb_publishable_…` / `sb_secret_…` keys. The browser publishable key is public; the secret key has elevated access and must remain server-only.
5. In the [Vercel dashboard](https://vercel.com/dashboard), open the project connected to this website, then **Settings → Environment Variables**. For isolated Preview testing, target these values to **Preview only** and use the dedicated Preview project credentials. Do not reuse the Production Supabase URL or keys in Preview. The URL is used by both the browser and server; the publishable key also has a browser and a server variable. Set `CONTRACT_ADMIN_EMAILS` to the exact Supabase Auth email for the Preview administrator. Never prefix `SUPABASE_SECRET_KEY` with `VITE_`, put it in source control, or send it in chat. Keep Production environment variables unchanged unless separately commissioning Production.
6. Redeploy after saving the variables; Vercel applies changed environment variables to new deployments.
7. Visit `/admin` and sign in. Then open `/contract`, finish a client agreement, and use **Save**. The CRM saves it as awaiting signature. Once the client signs that same agreement, the API records the signer and timestamp and stores the PDF in the private bucket.

Required Vercel variable names:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
CONTRACT_ADMIN_EMAILS
```

The signed-contract totals are **contracted amounts**, not proof of money collected. CAD and USD totals are kept separate. Stripe payments are reconciled from signed webhook events into the CRM payment ledger. Complete this flow in Preview with Stripe test mode before considering any Production billing configuration.

## Isolated Stripe Preview test

Use the separate `Arveno Growth Preview CRM` Supabase Free project (`ckanqxvbwshyhaduzmgz`, Canada Central) and target its URL, publishable key, and secret key to the Vercel Preview branch `feature/arveno-growth-website` only. Supabase confirmed the project's current creation cost is $0/month. The Free project can pause after a week of low activity. The CRM and billing migrations are applied there; do not apply them to the existing Production project. This keeps Preview CRM records and signed files isolated from Production.

Add `STRIPE_SECRET_KEY` as a restricted **test-mode** key (`rk_test_…`) and `STRIPE_WEBHOOK_SECRET` from a test-mode webhook endpoint, also targeting **Preview only**. The restricted key needs Checkout Sessions and Subscriptions write access and Payment Intents read access. The webhook endpoint is `/api/stripe/webhook` on the Preview deployment and needs these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `charge.refunded`. Create the Preview administrator in this separate Supabase project's Auth users before signing in. Do not set `STRIPE_LIVE_MODE_ENABLED`. Do not add Stripe keys to Production, change Production billing, or configure Resend as part of Preview testing.

The old `/contracts` register remains a browser-local archive for legacy records. It is not automatically imported because there is no trustworthy shared source from which to recover its localStorage data. Use its export and keep the export private; a future import can be added after reviewing its records.

## Local verification

Without Supabase environment variables, `/admin` intentionally reports that the CRM is not configured and API requests fail closed. The page and API can still be build-checked locally; production database and sign-off verification require a connected Supabase project and the deployed Vercel environment variables.
