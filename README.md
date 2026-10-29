# IPCG Global Markets

Client-facing market intelligence dashboard for Invest Partners Capital Group (IPCG). One HTTPS link that relationship managers paste into WhatsApp; clients open it on their phone with no app or login and see the day's market picture in about 30 seconds.

**Status:** working application, tested locally. **Not yet deployed.** It needs a hosting account, a domain and the data-provider keys listed below. A static review copy (fixed snapshot of verified data, 29 Oct 2026) was built from the same code for design and content review.

---

## What's in it

| Section | What clients see | Data source (production) |
|---|---|---|
| **Market Overview** (landing) | Reviewed daily briefing (3–5 items: what happened, why it matters, who is affected, sources), What to Watch, global index snapshot (US / Europe / Asia, 1D·1W·MTD), key indicators | All below |
| **Global Equities** | Region selector (US, Europe, China, HK, Japan, Taiwan, Asia-Pacific), indices, top gainers/losers from a defined liquid universe with sector filter, US sector bars, regional news | EODHD (licensed) |
| **Rates & Fixed Income** | Interactive Treasury curve (tap for yields; compare previous day / 1 week / 1 month), plain-English steepening/flattening note, 2s10s and 3m10s, curve table, 2Y/5Y/10Y/30Y with history chart, global sovereigns, six central-bank policy rates, IG/HY OAS, fixed-income news, bond-term explainers | US Treasury (official), Japan MoF, Bundesbank, Bank of England, HKMA, FRED, EODHD |
| **Commodities & FX** | Gold, silver, Brent, WTI (futures and EIA spot clearly separated), copper, Henry Hub; DXY, Fed broad dollar, EUR, GBP, JPY, CNH/CNY, HKD, TWD with "which currency strengthened" lines; HKD peg, TWD and CNY/CNH explainers | EODHD; FRED (Fed H.10, EIA) as fallback |
| **Latest Market News** | Filter by region, topic and 24h/7d/30d; expandable cards with publisher, time, summary, why it matters, tags and source link; duplicates merged in favour of the primary source | Official RSS (Fed, ECB, BoE, BoJ, HKMA) + EODHD news |
| **Economic Calendar** | Grouped by day, SGT times with local time, importance, previous / consensus / actual ("Not available" when no reliable consensus) | Official central-bank schedules (config) + EODHD economic events |

Everywhere: English / 繁體中文 interface toggle, larger-text toggle, light/dark themes, refresh button, "page updated" time distinct from each figure's own observation time, tap-to-see provenance on every line, disclaimer, "About this data" panel showing source status.

### Honesty rules built into the code

- Every figure carries source, series id, observation date/time, retrieval time, data type (real-time / delayed / end-of-day / weekly-released / reported) and method (observed / calculated / reported).
- `server/lib/validate.js` checks missing values, staleness by data type, implausible moves, unit ranges and duplicate news. Failing series show **Unavailable / Stale / Lagged / Under review**, never a substitute value.
- A failed refresh keeps the **last verified observation with its own timestamp** (cache fallback), and the provider is flagged in health status (and in an optional alert webhook after 3 failures).
- Missing API key ⇒ "Licensed data feed not connected". Nothing pretends to be live.
- ICE BofA spreads from FRED are marked **internal only**: FRED's terms prohibit publishing them to third parties without an ICE licence. They show in `/admin`, not to clients, until `ICE_BOFA_CLIENT_LICENCE=true`.
- Demo data exists only behind `DEMO_MODE=true`, is labelled "SIMULATED" on every screen with a hatched banner, and must never be enabled on the client deployment.

### Briefing automation and review

1. 07:00 SGT weekdays (configurable) the server prepares a **daily draft**; Saturdays 08:00 a **weekly draft**. RMs/PMs can also generate one any time in `/admin`.
2. `detectFacts()` turns the snapshot into numbered facts (yield moves in bp, curve change, index/FX/commodity moves above thresholds, spreads, central-bank decisions in the last 3 days).
3. A deterministic fact-only draft is always produced. If `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are set, an AI draft is requested **using only those facts and retrieved headlines** and passed through `validateAiDraft()`: every item must cite fact/news ids that exist; **every number in the text must appear in the cited data**; recommendation or certainty language ("buy", "will rise", "guaranteed"…) is rejected. Any failure ⇒ the AI draft is discarded and the reasons are shown to the reviewer.
4. Nothing reaches clients until a **named reviewer approves** it in `/admin`. Edits are re-checked for unsupported numbers. Approved briefings are locked; history (generated / edited / approved / withdrawn, by whom, when) is stored with the facts and sources used.
5. "Share today's briefing" builds WhatsApp text with a link to the dashboard; RMs copy it or open WhatsApp pre-filled. **Nothing is sent automatically** (no WhatsApp Business API integration is implemented).

---

## Run it locally

Requires Node 20+. No `npm install` needed (zero runtime dependencies).

```bash
cp .env.example .env          # fill in what you have
set -a; source .env; set +a
npm start                     # http://localhost:8080 ; admin at /admin
npm test                      # 10 test groups: calculations, validation, parsers, time zones, AI guardrails, approval workflow
npm run dev                   # same, with DEMO_MODE on for layout review
```

With no keys at all, the app still runs: official public sources (US Treasury, Japan MoF, Bundesbank, BoE, central-bank RSS) load directly; everything licensed shows as not connected.

## Deploy (stable HTTPS URL)

**Free option:** GitHub Actions + Cloudflare Pages, scheduled updates 3× a day and briefing approval by merging a pull request. See **[docs/FREE-HOSTING.md](docs/FREE-HOSTING.md)**.

**Server option:**

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for step-by-step instructions (Render Singapore via `render.yaml`, or any Docker host such as Azure App Service Southeast Asia / AWS App Runner ap-southeast-1 / Fly.io `sin`), domain and TLS, environment variables, go-live checklist and troubleshooting.

## Data providers

See **[docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)** for what each provider supplies, cost/licensing points to confirm, refresh intervals, and how to swap providers.

## Project layout

```
server/index.js            HTTP server, routes, security headers, rate limit, scheduler, OG tags
server/lib/                calc (bp, %, curve shape, periods, grounding), validate, time (SGT), infra (log, health, cache, http, store)
server/providers/          official.js (Treasury, FRED, MoF, Bundesbank, BoE, HKMA), eodhd.js (licensed), news.js (RSS + tagging)
server/services/           snapshot.js (normalised snapshot + provenance), briefing.js (facts, drafts, AI guardrails, approval, share text)
config/instruments.js      every instrument, its sources in priority order, licence class
config/central-banks.json  policy rates and official meeting dates (verified 29 Oct 2026; maintained by IPCG)
public/                    client app (index.html, app.css, app.js), admin console, favicon, og-image.png
scripts/                   build-preview (static review copy), demo-data (simulated), qa-screens, make-og-image
test/                      node:test suite
```

## Branding

Styling is **provisional** (deep navy, ivory, muted champagne; Source Serif 4 / Source Sans 3) and is labelled as such in the footer. The "IPCG" mark is set in type, not a designed logo. To apply official assets: replace the tokens at the top of `public/app.css`, swap `.mono` in the masthead for the official logo file, regenerate `public/og-image.png` (`npm run og-image`, after editing the script) and `public/favicon.svg`.
