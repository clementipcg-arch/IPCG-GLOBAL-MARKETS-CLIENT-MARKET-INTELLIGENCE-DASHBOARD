# Deployment

The app is a single Node 20+ process with no runtime dependencies, plus a small data folder (briefing drafts, approvals). Any HTTPS host that runs Docker or Node works. A Singapore region keeps it fast for clients in Taiwan and Singapore.

## Option A – Render (simplest)

1. Put this folder in a private GitHub repository.
2. Render Dashboard → **Blueprints → New Blueprint Instance** → pick the repo. `render.yaml` creates an always-on Docker web service in **Singapore** with a 1 GB persistent disk at `/data`.
3. Fill the secret variables: `PUBLIC_URL`, `FRED_API_KEY`, `EODHD_API_KEY`, optionally `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`. `ADMIN_TOKEN` is generated; copy it from the dashboard.
4. Custom domain: Settings → Custom Domains → add e.g. `markets.ipcg.com.sg`, create the CNAME at your DNS provider. TLS is automatic.
5. Set `PUBLIC_URL` to that https URL (used in WhatsApp previews and share text) and redeploy.

## Option B – any Docker host

```bash
docker build -t ipcg-global-markets .
docker run -d --name ipcg -p 8080:8080 --env-file .env -v ipcg-data:/data ipcg-global-markets
```
Put it behind an HTTPS load balancer / reverse proxy (Azure App Service Southeast Asia, AWS App Runner ap-southeast-1, Google Cloud Run asia-southeast1, Fly.io `sin`). Mount persistent storage at `/data`. Run **one instance** (the scheduler and file store are single-instance by design; for multiple instances, move `server/lib/infra.js` store functions to Postgres/Redis and run the scheduler in one place).

## Environment variables

See `.env.example`. Minimum for production: `PUBLIC_URL`, `ADMIN_TOKEN`, `FRED_API_KEY`, `EODHD_API_KEY`. Never set `DEMO_MODE=true` on the client URL. Keys stay on the server; the browser only ever calls `/api/snapshot`.

## Go-live checklist

- [ ] Provider display licences confirmed in writing (see DATA-SOURCES.md).
- [ ] `/admin` → every series `ok`, `lagged` (expected for weekly releases) or intentionally unavailable. No `check`.
- [ ] `config/central-banks.json` verified on the day of launch.
- [ ] Compliance (Mabel / Head of Compliance) has approved the disclaimer text in `public/app.js` (`disclaimer` strings, EN and 繁中) and the review workflow.
- [ ] Official IPCG logo, colours and fonts applied (see README → Branding); og-image regenerated.
- [ ] Paste the URL into a WhatsApp chat to check the link preview (WhatsApp caches previews; add `?v=2` to force a refresh).
- [ ] First daily draft reviewed and approved in `/admin`, then visible on the client page.
- [ ] Uptime monitor on `https://…/api/health` (returns 207 when a provider is failing) and `ALERT_WEBHOOK_URL` set.

## Daily operation (≈5 minutes)

1. ~07:00 SGT a draft appears in `/admin` (or click **New daily draft**).
2. Read it against the facts list; edit wording; enter your name; **Approve and publish**.
3. Click **Copy WhatsApp text** or use **Share today's briefing** on the client page; paste into WhatsApp.
4. After any central-bank decision, update `config/central-banks.json` (rate, decision, date, next meeting) and redeploy.

## Access and privacy

The client dashboard is public-by-link with `noindex` and no personal data. An unlisted URL is not a security control: if IPCG later adds proprietary research or client-specific content, put that behind authentication (e.g. magic-link email login or the host's access layer such as Cloudflare Access) rather than relying on the URL. `/admin` is protected by a bearer token compared in constant time; rotate it if an RM leaves. Security headers (CSP, HSTS, frame-deny, nosniff) and a per-IP API rate limit are enabled.

## Troubleshooting

| Symptom | Check |
|---|---|
| Everything "not connected" | Keys not set in the host's environment; restart after setting. |
| Treasury curve unavailable | Treasury site occasionally changes CSV URLs; check logs for `US Treasury` failures and update `UST_URL` in `server/providers/official.js`. |
| A series shows "Under review" | Validation flagged an out-of-range value or a move larger than the threshold (index 12%, FX 5%, commodity 15%, yields 60 bp). Check the source; adjust thresholds in `server/lib/validate.js` only if the move is real. |
| "Stale" on an index | Market holiday or provider delay. Holidays are not modelled; the label is conservative. |
| Link preview shows no image | `PUBLIC_URL` must be the public https URL; WhatsApp caches previews for days. |
| AI draft always rejected | See the reasons on the draft card; usually the model added a number not in the facts. The fact-only draft is used instead. |
| Admin shows 401 | Token mismatch; tokens are case-sensitive and have no spaces. |

Logs are JSON lines on stdout (`provider failure`, `AI draft rejected by grounding checks`, `daily draft prepared for review`).
