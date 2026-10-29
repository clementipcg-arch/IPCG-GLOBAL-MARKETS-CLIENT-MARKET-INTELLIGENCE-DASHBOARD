'use strict';
/**
 * Builds the static, single-file REVIEW COPY (dist/preview.html) from:
 *   - preview/retrieved-2026-10-29.json   raw observations retrieved from the cited public sources
 *   - the SAME normalisation, validation and briefing code the server uses
 *   - scripts/demo-data.js                 clearly labelled simulated data for layout review
 * Usage: node scripts/build-preview.js
 */
const fs = require('fs');
const path = require('path');
const { INDICES, FX, COMMODITIES, SOVEREIGNS, CREDIT } = require('../config/instruments');
const { curveFromRows, fromHistory, unavailable, buildCalendar, buildPolicyRates } = require('../server/services/snapshot');
const { validateObservation } = require('../server/lib/validate');
const briefing = require('../server/services/briefing');
const { demoSnapshot } = require('./demo-data');

const ROOT = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'preview/retrieved-2026-10-29.json'), 'utf8'));
const NOW = new Date(raw.retrievedAt);
const toRows = (pairs) => pairs.map(([date, value]) => ({ date, value }));
const FRED_LABEL = { DEX: 'Federal Reserve Board H.10 release, via FRED', DTW: 'Federal Reserve Board H.10 release, via FRED', DCO: 'U.S. Energy Information Administration, via FRED', DHH: 'U.S. Energy Information Administration, via FRED', BAM: 'ICE Data Indices, LLC, via FRED' };

async function main() {
  const series = {};
  // ---- US Treasury curve
  const cols = raw.treasury.columns;
  const tRows = raw.treasury.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  const curve = curveFromRows({ rows: tRows, source: raw.treasury.source, sourceUrl: raw.treasury.sourceUrl, retrievedAt: raw.retrievedAt }, NOW);
  for (const o of curve.tenorObs) series[o.id] = o;

  // ---- reported (Reuters) figures
  const rep = raw.reported;
  const reported = (meta, x) => validateObservation({
    ...meta, value: x.value, change: x.change ?? null, changePct: x.changePct, pctDecimals: x.pctDecimals,
    prev: x.change !== undefined ? Math.round((x.value - x.change) * 100) / 100 : null, prevDate: x.change !== undefined ? '2026-10-27' : null,
    obsDate: '2026-10-28', source: rep.source, sourceUrl: rep.sourceUrl, seriesId: null, latency: 'reported', method: 'reported', reportedBy: 'Reuters',
    retrievedAt: raw.retrievedAt, note: [x.note, x.change !== undefined ? 'Previous close calculated from the reported level and point change.' : null].filter(Boolean).join(' ') || undefined,
  }, NOW);

  for (const m of [...INDICES, ...FX, ...COMMODITIES]) {
    if (rep.items[m.id]) { series[m.id] = reported(m, rep.items[m.id]); continue; }
    const fred = m.sources.find((s) => s.p === 'fred' && raw.fred[s.s]);
    if (fred) {
      series[m.id] = fromHistory(m, { rows: toRows(raw.fred[fred.s]), retrievedAt: raw.retrievedAt }, { source: FRED_LABEL[fred.s.slice(0, 3)], sourceUrl: `https://fred.stlouisfed.org/series/${fred.s}`, seriesId: fred.s, latency: fred.latency || 'end-of-day' }, NOW);
      continue;
    }
    series[m.id] = unavailable(m, 'Licensed market-data feed not connected');
  }
  // ---- sovereigns
  for (const s of SOVEREIGNS) {
    const src = s.sources[0];
    if (src.p === 'mof') series[s.id] = fromHistory(s, { rows: toRows(raw.mof[src.s]), retrievedAt: raw.retrievedAt }, { source: raw.mof.source, sourceUrl: raw.mof.sourceUrl, seriesId: `JGB ${src.s}`, asYield: true }, NOW);
    else if (src.p === 'bbk' || src.p === 'boe') series[s.id] = unavailable(s, `Connects to the ${src.p === 'bbk' ? 'Deutsche Bundesbank' : 'Bank of England'} feed on the deployed server; not captured in this review copy`);
    else if (src.p === 'hkma') series[s.id] = unavailable(s, 'HKMA feed to be configured on deployment');
    else series[s.id] = unavailable(s, 'Licensed market-data feed not connected');
  }
  // ---- credit (internal review copy shows values with an internal-only flag)
  for (const c of CREDIT) {
    const o = fromHistory(c, { rows: toRows(raw.fred[c.series]), retrievedAt: raw.retrievedAt }, { source: FRED_LABEL.BAM, sourceUrl: `https://fred.stlouisfed.org/series/${c.series}`, seriesId: c.series, asYield: true }, NOW);
    o.internalOnly = true;
    series[c.id] = o;
  }

  const policyRates = await buildPolicyRates();
  const calendar = await buildCalendar();

  const news = [
    { title: 'Federal Reserve issues FOMC statement', publisher: 'Federal Reserve', primary: true, publishedAt: '2026-10-28T18:00:00Z', link: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm', regions: ['US'], topics: ['Central banks & macro', 'Fixed income & credit'],
      summary: 'The FOMC held the federal funds target range at 3.75%–4.00%. The vote was 10–2: Governors Lisa Cook and Beth Hammack preferred a 25 bp increase. The statement describes economic activity as expanding at a strong pace.', why: 'Two dissents in favour of a rise show that some policymakers wanted tighter policy at this meeting.', numbers: [3.75, 4.0, 25] },
    { title: 'Global stocks hold gains after Fed decision, oil prices rise', publisher: 'Reuters', publishedAt: '2026-10-28', link: rep.sourceUrl, regions: ['US', 'Europe'], topics: ['Equities', 'Commodities & FX', 'Central banks & macro'],
      summary: 'Wall Street’s main indexes closed modestly higher and the STOXX 600 added 0.07%. Reuters reported Brent futures up about 1% at $115.32 a barrel on renewed supply concerns after an attack on a Saudi Arabian refinery, and spot gold up 0.27% at $4,070.28 an ounce. CME FedWatch pricing implied an 85% chance of a December hike, up from 78.3%.', numbers: [0.07, 115.32, 102.78, 4070.28, 0.27, 85, 78.3, 1, 3] },
    { title: 'Bank of Canada raises rates; New Zealand’s central bank holds at 2.75%', publisher: 'Reuters', publishedAt: '2026-10-28', link: rep.sourceUrl, regions: ['Asia'], topics: ['Central banks & macro', 'Commodities & FX'],
      summary: 'Reuters reported that the Bank of Canada raised rates for the first time in three years, while the Reserve Bank of New Zealand unexpectedly held its rate at 2.75%; the New Zealand dollar fell about 1%.', numbers: [2.75, 1] },
    { title: 'Microsoft edges higher after cloud beat; Alphabet falls after hours', publisher: 'Reuters', publishedAt: '2026-10-28', link: rep.sourceUrl, regions: ['US'], topics: ['Equities'],
      summary: 'Reuters reported that Microsoft shares edged higher after cloud revenue beat estimates, while Alphabet shares fell in after-hours trading on heavy spending and a larger cash burn.' },
    { title: 'UK budget draws little market reaction', publisher: 'Reuters', publishedAt: '2026-10-28', link: rep.sourceUrl, regions: ['Europe'], topics: ['Fixed income & credit', 'Commodities & FX'],
      summary: 'According to Reuters, the first budget from finance minister John Healey drew little reaction from British stocks, gilts or the pound, which was up 0.17%.' },
    { title: 'Agencies extend comment period on proposal to modernise Regulation (to 4 November)', publisher: 'Federal Reserve', primary: true, publishedAt: '2026-10-02T20:00:00Z', link: 'https://www.federalreserve.gov/newsevents/pressreleases/bcreg20261002a.htm', regions: ['US'], topics: ['Fixed income & credit'], summary: 'The Federal Reserve Board extended the comment period on a bank-regulation proposal until 4 November.' },
    { title: 'Federal Reserve Board announces enforcement action against American Express', publisher: 'Federal Reserve', primary: true, publishedAt: '2026-10-08T20:30:00Z', link: 'https://www.federalreserve.gov/newsevents/pressreleases/enforcement20261008a.htm', regions: ['US'], topics: ['Equities'], summary: 'The Board announced an enforcement action against American Express Company. See the release for the issues addressed.' },
    { title: 'Minutes of the FOMC meeting of 15–16 September 2026', publisher: 'Federal Reserve', primary: true, publishedAt: '2026-10-07T18:00:00Z', link: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261007a.htm', regions: ['US'], topics: ['Central banks & macro'], summary: 'The Fed published the minutes of its September policy meeting.' },
    { title: 'Fed finalises changes to stress-test transparency', publisher: 'Federal Reserve', primary: true, publishedAt: '2026-09-30T13:00:00Z', link: 'https://www.federalreserve.gov/newsevents/pressreleases/bcreg20260930a.htm', regions: ['US'], topics: ['Fixed income & credit'], summary: 'The Board finalised changes intended to make its bank stress tests more transparent and publicly accountable.', why: 'Stress-test results feed into large US banks’ capital requirements, which matter to holders of bank bonds and capital securities.' },
    { title: 'China keeps loan prime rates unchanged for a 17th month', publisher: 'Trading Economics', publishedAt: '2026-10-20', link: 'https://tradingeconomics.com/china/interest-rate/news/593249', regions: ['China'], topics: ['Central banks & macro'], summary: 'The one-year LPR stayed at 3.0% and the five-year at 3.5%, the levels in place for 17 consecutive months.' },
    { title: 'Bank of Japan changes guideline for money market operations', publisher: 'Bank of Japan', primary: true, publishedAt: '2026-09-18', link: 'https://www.boj.or.jp/en/mopo/mpmdeci/state_2026/index.htm', regions: ['Japan'], topics: ['Central banks & macro', 'Fixed income & credit'], summary: 'At its September meeting the BoJ raised its target for the uncollateralised overnight call rate to 1.25%, the highest level since 1995 according to news reports.' },
  ];

  const snap = {
    schema: 1, environment: 'preview', audience: 'internal', generatedAt: raw.retrievedAt, series, curve, policyRates, calendar, news,
    movers: { status: 'unavailable', reason: 'Licensed market-data feed not connected' },
    sectors: { status: 'unavailable', reason: 'Licensed market-data feed not connected' },
    health: [
      { provider: 'US Treasury (official)', status: 'ok' }, { provider: 'FRED – Fed H.10 FX, EIA energy', status: 'ok' }, { provider: 'Japan Ministry of Finance', status: 'ok' },
      { provider: 'Reuters (reported figures)', status: 'ok' }, { provider: 'Federal Reserve press releases', status: 'ok' },
      { provider: 'EODHD licensed market data', status: 'not-configured' }, { provider: 'Deutsche Bundesbank / Bank of England', status: 'not-configured' }, { provider: 'AI drafting (Anthropic API)', status: 'not-configured' },
    ],
    groups: { indices: INDICES.map((m) => m.id), fx: FX.map((m) => m.id), commodities: COMMODITIES.map((m) => m.id), sovereigns: SOVEREIGNS.map((m) => m.id), credit: CREDIT.map((m) => m.id), keyIndicators: ['ust2y', 'ust5y', 'ust10y', 'ust30y', 'dxy', 'usdbroad', 'xau', 'brent', 'wti', 'eurusd', 'usdjpy', 'usdcnh', 'usdcny', 'usdtwd'] },
  };

  // ---- briefing draft (AI-drafted in this session; passed through the same grounding validator the server uses)
  const facts = briefing.detectFacts(snap);
  const fid = (pred) => facts.filter(pred).map((f) => f.id);
  const newsIn = news.map((n, i) => ({ id: `N${i + 1}`, ...n }));
  const items = [
    { headline: 'Fed holds rates; two officials favoured a hike', what: 'The Federal Reserve kept its target range at 3.75%–4.00% on 28 October in a 10–2 vote. Governors Cook and Hammack dissented in favour of a 25 bp increase. Reuters reported that futures pricing implied about an 85% chance of a December hike, up from 78.3% a day earlier.', why: 'Expectations for US policy rates are a key influence on Treasury yields, the US dollar and borrowing costs globally.', affected: ['US Treasuries', 'US dollar', 'Global equities'], factIds: fid((f) => f.kind === 'policy'), newsIds: ['N1', 'N2'] },
    { headline: 'Treasury curve steepened', what: 'The 10-year Treasury yield rose 6 bp to 5.05% and the 30-year 7 bp to 5.37%, while the 2-year fell 3 bp to 4.67%. The gap between 2- and 10-year yields widened to 38 bp. Over the week, yields are still lower: the 10-year is down 8 bp since 21 October.', why: 'Longer-dated bonds are more sensitive to yield changes, so a rise at the long end weighs more on their prices. The data show what moved; they do not on their own identify the cause.', affected: ['US Treasuries', 'Fixed income'], factIds: fid((f) => f.kind === 'yield' || f.kind === 'curve'), newsIds: [] },
    { headline: 'Oil higher on supply concerns, according to Reuters', what: 'Reuters reported Brent crude futures up about 1% at $115.32 a barrel and US crude up about 3% at $102.78, citing renewed supply concerns after an attack on a Saudi Arabian refinery. Spot gold rose 0.27% to $4,070.28 an ounce.', why: 'Energy prices feed into inflation, which central banks are watching closely, and into the earnings of energy producers and heavy fuel users.', affected: ['Commodities', 'Inflation'], factIds: fid((f) => f.kind === 'commodity' && f.obsDate === '2026-10-28'), newsIds: ['N2'] },
    { headline: 'US stocks edged higher; tech earnings in focus', what: 'The S&P 500 rose 0.28% to 7,743.97, the Nasdaq Composite 0.27% to 26,549.85 and the Dow 0.19% to 52,475.10. In Europe the STOXX 600 added 0.07%. Reuters reported that Microsoft rose after cloud revenue beat estimates, while Alphabet fell after hours on heavy spending.', why: 'Large technology companies carry heavy weights in US indices, so their results can move the broader market.', affected: ['US equities', 'Europe'], factIds: fid((f) => f.kind === 'index'), newsIds: ['N2', 'N4'] },
    { headline: 'Bank of Canada raised rates; New Zealand held', what: 'Reuters reported that the Bank of Canada raised rates for the first time in three years, and that the Reserve Bank of New Zealand unexpectedly held its rate at 2.75%.', why: 'Rate decisions elsewhere affect currency moves and the relative appeal of bonds across markets.', affected: ['Central banks', 'FX'], factIds: [], newsIds: ['N3'] },
  ];
  const problems = briefing.validateAiDraft({ items }, facts, newsIn);
  if (problems.length) { console.error('Briefing failed grounding checks:', problems); process.exit(1); }
  for (const it of items) {
    it.sources = [...new Map([...it.factIds.flatMap((id) => facts.find((f) => f.id === id).sources), ...it.newsIds.map((id) => { const n = newsIn.find((x) => x.id === id); return { label: n.publisher, url: n.link }; })].map((s) => [s.url, s])).values()];
  }
  const whatToWatch = briefing.whatToWatch(snap, 8).map((w) => ({ ...w, note: /ECB/.test(w.event) ? 'today' : undefined }));
  snap.briefing = { daily: { status: 'draft', mode: 'daily', createdAt: NOW.toISOString(), snapshotAt: NOW.toISOString(), generator: 'ai:claude (review-copy draft)', items, whatToWatch }, weekly: null };
  snap.whatToWatch = whatToWatch;
  snap.publicUrl = 'https://markets.ipcg.example/';

  const demo = demoSnapshot(NOW);
  const css = fs.readFileSync(path.join(ROOT, 'public/app.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const data = JSON.stringify({ live: snap, demo }).replace(/</g, '\\u003c');
  const html = `<title>IPCG Global Markets</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="A curated daily view of global markets, interest rates, fixed income, commodities and key financial developments from IPCG.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<style>
${css}
</style>
<div id="app" aria-live="polite"><p class="boot">Loading IPCG Global Markets…</p></div>
<script>window.__IPCG_PREVIEW__ = ${data};</script>
<script>
${js}
</script>
`;
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist/preview.html'), html);
  fs.writeFileSync(path.join(ROOT, 'dist/preview-snapshot.json'), JSON.stringify(snap, null, 2));
  // Full standalone page (with doctype) for local viewing / screenshots
  fs.writeFileSync(path.join(ROOT, 'dist/preview-standalone.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${html.split('<div id="app"')[0]}</head><body><div id="app"${html.split('<div id="app"')[1]}</body></html>`);
  console.log(`preview built: ${(html.length / 1024).toFixed(0)} KB, ${facts.length} facts, briefing items ${items.length}, grounding problems: 0`);
  console.log('status summary:', Object.values(series).reduce((a, o) => ((a[o.status] = (a[o.status] || 0) + 1), a), {}));
}
main().catch((e) => { console.error(e); process.exit(1); });
