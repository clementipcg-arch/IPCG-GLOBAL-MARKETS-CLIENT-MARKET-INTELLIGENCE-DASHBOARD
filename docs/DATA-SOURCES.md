# Data sources

Status key: **Live** = adapter built and works without a paid key · **Key** = adapter built, needs a free key · **Licensed** = adapter built, needs a paid subscription and a display licence · **Manual** = maintained by IPCG in config.

| Data | Provider | Status | Latency | Notes |
|---|---|---|---|---|
| US Treasury par curve (3M–30Y), 2s10s, 3m10s | U.S. Treasury daily par yield curve CSV | Live | End of day, published after NY close | Public domain. Refreshed every 30 min. |
| Japan 2Y / 10Y JGB | Japan Ministry of Finance `jgbcme.csv` | Live | End of day | Public. |
| Germany 2Y / 10Y | Deutsche Bundesbank SDMX API | Live | End of day | Series keys in `config/instruments.js`; confirm on first run. |
| UK 10Y gilt | Bank of England database (`IUDMNPY`) | Live | End of day | Attribution: Bank of England. Confirm series code meets your preferred benchmark. |
| Hong Kong 10Y | HKMA Open API | Config | End of day | Set `HKMA_YIELD_ENDPOINT` / `HKMA_YIELD_FIELD` after confirming on apidocs.hkma.gov.hk. Label identifies whether it's an Exchange Fund Note or HKGB. |
| China / Taiwan 10Y | EODHD government-bond symbols | Licensed | End of day | No reliable free API found. Alternative: ChinaBond / TPEx data licence. |
| FX fallback (EUR, GBP, JPY, CNY, HKD, TWD), Fed broad dollar index | FRED: Fed H.10 | Key | Daily noon NY rates, **released weekly** | Public domain; shown as "Lagged". Not DXY. |
| WTI / Brent spot, Henry Hub | FRED: EIA | Key | Daily, Brent released weekly | Public domain. Spot, clearly separated from futures. |
| Fed funds target range cross-check | FRED `DFEDTARL` / `DFEDTARU` | Key | Daily | Flags a mismatch with `config/central-banks.json`. |
| US IG / HY OAS | FRED (ICE BofA) | Key, **internal only** | Daily | FRED terms: no publication to third parties without ICE permission. Client view shows "Licence required" until `ICE_BOFA_CLIENT_LICENCE=true`. |
| Global indices (US, Europe, Asia), DXY, CNH, spot gold/silver, Brent/WTI/copper futures | EODHD real-time/delayed + EOD | Licensed | Usually 15–20 min delayed; some indices EOD | Confirm each symbol, latency and display licence before go-live. |
| Top movers | EODHD screener | Licensed | Delayed | Universe = exchange + market cap > 5bn + 200-day avg volume > 200k; stated on screen. |
| US sector performance | EODHD quotes for Select Sector SPDR ETFs | Licensed | Delayed | Labelled as ETF proxy. |
| Economic calendar (actual / previous / consensus) | EODHD economic events | Licensed | — | Consensus shown only when supplied; otherwise "Not available". |
| Central-bank meeting dates & policy rates | Official websites | Manual | — | `config/central-banks.json`, verified 29 Oct 2026. Update after each decision (5–10 min). |
| News | Fed, ECB, BoE, BoJ, HKMA RSS; EODHD news | Live / Licensed | Minutes | Headline + short summary + link only. Fed feed confirmed; others to confirm on first run (health panel shows status). |
| AI drafting | Anthropic API | Key | — | Optional. Deterministic drafts work without it. |

## Before go-live, confirm with each paid provider

1. **Display / redistribution rights.** Showing prices to external clients usually needs a "display" or "non-professional redistribution" licence and sometimes per-exchange fees (e.g. index providers S&P DJI, STOXX, FTSE Russell, Nikkei, TWSE). Get this in writing.
2. **Latency per instrument** and set `EODHD_LATENCY` to match. The UI labels values accordingly.
3. **Symbols.** Run the server, open `/admin`, and check every series shows `ok`. Adjust symbols in `config/instruments.js` if not.
4. **Attribution text** required by each provider; add it to the footer if needed.
5. **Rate limits.** Defaults: quotes cached 5 min, history 6 h, movers 15 min, calendar 30 min, news 10 min, Treasury 30 min. Adjust TTLs in the adapters or via env vars.

## Alternatives considered

- Bloomberg B-PIPE / Data License, LSEG (Refinitiv) Data Platform, ICE Data Services: best coverage (including AT1/bond-level YTW/YTC, OAS, ratings) and clear redistribution terms, at institutional cost. If IPCG already licenses Bloomberg, the cleanest route for bond-level data is a Data License feed or an approved B-PIPE/Server API redistribution agreement; Terminal (Desktop API) data may not be redistributed to clients.
- Twelve Data, Financial Modeling Prep, Polygon: viable swaps for EODHD; coverage of Asian indices and calendar consensus varies.
- Scraping public websites (Yahoo, Investing.com, etc.) is **not used**: terms of use prohibit it.

## Swapping a provider

Each adapter returns the same normalised shape. To replace EODHD, implement `quotes`, `history`, `movers`, `calendar`, `news`, `configured` in a new file under `server/providers/`, change the `p:` codes in `config/instruments.js`, and point `server/services/snapshot.js` at it. Nothing in the UI changes.
