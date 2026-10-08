# Contract CRM setup

The CRM is served at `/admin`. It uses Supabase Auth for sign-in, a private Postgres table for client and agreement records, and a private Storage bucket for signed PDFs. The Vercel API verifies each access token with Supabase Auth and checks the email against `CONTRACT_ADMIN_EMAILS` before reading or changing records. The Supabase service-role key is server-only.

## Connect the database

1. Create or select the Arveno Growth Supabase project.
2. Run `supabase/migrations/202610080001_contract_crm.sql` in the Supabase SQL Editor (or apply it with the Supabase CLI).
3. Create the admin user in Supabase Auth. Use a unique account and a strong password; do not use a shared default password.
4. In Vercel Project Settings → Environment Variables, set the variables listed in `.env.example` for Production and Preview. Set `CONTRACT_ADMIN_EMAILS` to the exact admin email address or comma-separated authorized addresses. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; never prefix it with `VITE_`.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the Vite build, then redeploy. For local development, use the same values in an ignored `.env.local` file.
6. Visit `/admin`, sign in, then open `/contract`, finish a client agreement, and use **Save**. The CRM saves it as awaiting signature. Once the client signs the matching agreement, the API records the signer and timestamp and stores the PDF in the private bucket.

The signed-contract totals are **contracted amounts**, not Stripe receipts or proof of money collected. CAD and USD totals are kept separate. Stripe payment reconciliation is intentionally not connected yet.

The old `/contracts` register remains a browser-local archive for legacy records. It is not automatically imported because there is no trustworthy shared source from which to recover its localStorage data. Use its export and keep the export private; a future import can be added after reviewing its records.

## Local verification

Without Supabase environment variables, `/admin` intentionally reports that the CRM is not configured and API requests fail closed. The page and API can still be build-checked locally; production database and sign-off verification require a connected Supabase project and the deployed Vercel environment variables.
