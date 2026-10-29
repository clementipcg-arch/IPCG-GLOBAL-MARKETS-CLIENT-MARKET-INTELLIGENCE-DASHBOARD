'use strict';
/**
 * SIMULATED snapshot for layout and design review ONLY.
 * Every value is generated, flagged method:'simulated', and the environment is 'demo', which makes
 * the UI show a hatched "SIMULATED DATA" banner on every screen. The server only serves this when
 * DEMO_MODE=true, and it must never be enabled in the client-facing deployment.
 */
const { INDICES, FX, COMMODITIES, SOVEREIGNS, CREDIT, UST_TENORS } = require('../config/instruments');
const { SECTOR_ETFS } = require('../server/services/snapshot');

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function demoSnapshot(now = new Date()) {
  const r = rng(20261029);
  const d = now.toISOString().slice(0, 10);
  const series = {};
  const base = { spx: 6000, ccmp: 20000, indu: 45000, rty: 2300, sxxp: 520, sx5e: 5000, dax: 22000, ukx: 9000, cac: 7600, nky: 40000, hsi: 24000, shcomp: 3500, csi300: 4000, taiex: 23000, kospi: 3000 };
  const mk = (m, value, chgPct, extra = {}) => ({ ...m, value, prev: value / (1 + chgPct / 100), change: value - value / (1 + chgPct / 100), changePct: chgPct, obsDate: d, obsTime: now.toISOString(), source: 'SIMULATED', seriesId: 'demo', latency: 'delayed', method: 'simulated', status: 'ok', periods: { asOf: d, day: { change: chgPct }, week: { ref: d, change: chgPct * 2.1 }, mtd: { ref: d, change: chgPct * 3.4 } }, ...extra });
  for (const m of INDICES) series[m.id] = mk(m, base[m.id] * (0.97 + r() * 0.06), (r() - 0.5) * 3);
  for (const m of FX) series[m.id] = mk(m, { dxy: 100, usdbroad: 120, eurusd: 1.1, gbpusd: 1.3, usdjpy: 150, usdcnh: 7.1, usdcny: 7.1, usdhkd: 7.8, usdtwd: 31 }[m.id] * (0.99 + r() * 0.02), (r() - 0.5) * 1.2);
  for (const m of COMMODITIES) series[m.id] = mk(m, { xau: 2500, xag: 30, brent: 80, wti: 76, brent_spot: 80, wti_spot: 76, copper: 4.5, natgas: 3 }[m.id] * (0.97 + r() * 0.06), (r() - 0.5) * 4);
  for (const m of SOVEREIGNS) series[m.id] = { ...mk(m, 2 + r() * 2.5, 0), changeBp: Math.round((r() - 0.5) * 12), periods: { day: { change: 0 }, week: { ref: d, change: Math.round((r() - 0.5) * 20) }, mtd: { ref: d, change: Math.round((r() - 0.5) * 30) } } };
  for (const m of CREDIT) series[m.id] = { ...mk(m, m.id === 'us_hy_oas' ? 3 + r() : 0.8 + r() * 0.3, 0), changeBp: Math.round((r() - 0.5) * 16) };
  const curveVals = {}; let y = 4.2;
  for (const [k] of UST_TENORS) { y += (r() - 0.35) * 0.12; curveVals[k] = Math.round(y * 100) / 100; }
  const shift = (v, bp) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round((x - bp / 100) * 100) / 100]));
  for (const k of ['2Y', '5Y', '10Y', '30Y', '3M']) series[`ust${k.toLowerCase()}`] = { ...mk({ id: `ust${k.toLowerCase()}`, label: `US ${k} Treasury (simulated)`, kind: 'yieldPct' }, curveVals[k], 0), changeBp: Math.round((r() - 0.5) * 14) };
  const names = ['Example Holdings', 'Sample Industries', 'Placeholder Bank', 'Demo Semiconductor', 'Specimen Energy', 'Mock Retail', 'Test Pharma', 'Illustrative Telecom'];
  const sectors = ['Technology', 'Financials', 'Energy', 'Health care', 'Consumer discretionary'];
  const movers = (sign) => names.map((n, i) => ({ name: n + ' (simulated)', ticker: 'DEMO' + (i + 1), exchange: 'DEMO', sector: sectors[i % sectors.length], price: 20 + r() * 200, changePct: sign * (2 + r() * 8), change: sign * r() * 10, volume: 1e6 + r() * 2e7, avgVolume: 5e6 })).sort((a, b) => sign * (b.changePct - a.changePct));
  const regions = Object.fromEntries(['US', 'Europe', 'China', 'Hong Kong', 'Japan', 'Taiwan', 'Asia-Pacific'].map((k) => [k, { gainers: movers(1), losers: movers(-1), universe: 'SIMULATED universe' }]));
  return {
    schema: 1, environment: 'demo', generatedAt: now.toISOString(),
    series,
    curve: { status: 'ok', asOf: d, tenors: UST_TENORS.map(([k]) => k), current: { date: d, values: curveVals }, compare: { prevDay: { date: d, values: shift(curveVals, 4) }, week: { date: d, values: shift(curveVals, -9) }, month: { date: d, values: shift(curveVals, 18) } }, shape: { spread2s10s: Math.round((curveVals['10Y'] - curveVals['2Y']) * 100), spread3m10s: Math.round((curveVals['10Y'] - curveVals['3M']) * 100), delta2s10s: 2, move: 'steepening' }, source: 'SIMULATED', sourceUrl: '#' },
    policyRates: [{ id: 'demo', bank: 'Example Central Bank (simulated)', zh: '範例央行（模擬）', rate: '0.00%', instrument: 'Simulated', lastDecision: d, decision: 'Simulated', source: 'SIMULATED', sourceUrl: '#', verifiedAt: d }],
    calendar: { providerStatus: 'ok', events: [{ date: d, dateUtc: now.toISOString(), event: 'Example inflation release (simulated)', region: 'US', importance: 'high', kind: 'data', previous: '0.0%', consensus: '0.0%', actual: null, localTime: '—', source: 'SIMULATED' }] },
    news: [{ title: 'Example headline used for layout review (simulated)', summary: 'This card shows how a news item is laid out. It is not a real story.', publisher: 'SIMULATED', publishedAt: now.toISOString(), link: '#', regions: ['US'], topics: ['Equities'] }],
    movers: { status: 'ok', regions, note: 'SIMULATED.' },
    sectors: { status: 'ok', rows: SECTOR_ETFS.map(([label, zh]) => ({ label, zh, changePct: (r() - 0.5) * 3 })).sort((a, b) => b.changePct - a.changePct), method: 'SIMULATED.', source: 'SIMULATED' },
    health: [{ provider: 'Demonstration data', status: 'not-configured' }],
    briefing: { daily: { status: 'draft', mode: 'daily', createdAt: now.toISOString(), snapshotAt: now.toISOString(), generator: 'deterministic', items: [{ headline: 'Example briefing item (simulated)', what: 'This shows where a reviewed briefing item appears. The text is placeholder copy, not market commentary.', why: 'Layout review only.', affected: ['Example'], sources: [] }], whatToWatch: [] }, weekly: null },
    groups: { indices: INDICES.map((m) => m.id), fx: FX.map((m) => m.id), commodities: COMMODITIES.map((m) => m.id), sovereigns: SOVEREIGNS.map((m) => m.id), credit: CREDIT.map((m) => m.id), keyIndicators: ['ust2y', 'ust5y', 'ust10y', 'ust30y', 'dxy', 'xau', 'brent', 'wti', 'eurusd', 'usdjpy', 'usdcnh', 'usdtwd'] },
  };
}

module.exports = { demoSnapshot };
