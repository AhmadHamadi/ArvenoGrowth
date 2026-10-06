# Arveno Growth

Marketing, AI systems, and growth consulting website.

- GitHub: https://github.com/AhmadHamadi/ArvenoGrowth
- Active website branch: `feature/arveno-growth-website`
- Local website: `~/Desktop/Arveno Growth/Website`
- Corrected brand kit: `../brand/Arveno_Growth_Brand_Kit`
- Brand name, email, and site origin: `src/brand-config.json`
- Calculator inputs and methodology: `src/calculator-data.js` and `CALCULATOR-BENCHMARKS.md`

## Run locally

Use Node 22 and install dependencies with `npm ci`.

```sh
npm run dev
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
```

The static preview does not execute Vercel serverless email endpoints. Configure the deployment environment using `.env.example` before testing real delivery.

## GitHub updates

Commit changes and run `git push` on the active branch to save them to GitHub. Merely saving a file locally does not upload it. The repository was renamed from AveroGrowth to ArvenoGrowth with its history preserved. Deployment connection and production-domain status must be checked in Vercel separately.
