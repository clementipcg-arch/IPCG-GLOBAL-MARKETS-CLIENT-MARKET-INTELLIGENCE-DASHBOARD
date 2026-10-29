# IPCG Global Markets: build status (29 Oct 2026)

## Delivered
- Working Node app (no runtime dependencies): client dashboard (6 sections, EN/繁中, larger-text mode, light/dark), admin review console, scheduler, provider adapters, validation, tests (10 groups passing).
- Internal review copy published as a private claude.ai artifact ("Review copy 29 Oct"). It is a fixed snapshot of verified data retrieved 29 Oct 2026 11:40 SGT: the Treasury curve to 28 Oct, Fed H.10 FX and EIA energy via FRED, MoF JGBs, ICE BofA OAS (internal only), Reuters-reported closes, and the 28 Oct FOMC decision. It also includes a draft briefing that passed the grounding validator. NOT for clients.
- Source zip with Dockerfile, render.yaml (Singapore), .env.example, docs.

## Key decisions
- Vanilla JS front end and zero-dependency Node server, chosen for fast loading in WhatsApp's in-app browser and low maintenance.
- EODHD chosen as the single licensed feed (indices, FX, commodities, movers, calendar, news). It can be swapped through the adapter interface.
- ICE BofA OAS is internal-only until it is licensed (FRED terms).
- No briefing reaches clients without a named reviewer's approval. AI drafts must cite facts, and every number must appear in the source data.
- Branding is provisional and labelled as such.

## Remaining before client use
1. Hosting account + domain (Render Singapore or Azure/AWS SG). Set PUBLIC_URL and ADMIN_TOKEN.
2. FRED key (free), EODHD subscription with display licence confirmed in writing, optional Anthropic key + model id.
3. Confirm EODHD symbols and Bundesbank/BoE/HKMA series on first run (/admin health panel).
4. Official IPCG logo/colours; compliance sign-off on disclaimer and workflow.
5. Keep config/central-banks.json current after each decision (ECB 29 Oct, BoJ 30 Oct and BoE 5 Nov are pending as of this build).
