'use strict';
// Assembles the normalised market snapshot served to the client. Every figure carries provenance.
const { INDICES, FX, COMMODITIES, UST_TENORS, SOVEREIGNS, CREDIT } = require('../../config/instruments');
const centralBanks = require('../../config/central-banks.json');
const official = require('../providers/official');
const eodhd = require('../providers/eodhd');
const news = require('../providers/news');
const { pctChange, absChange, bpChange, curveShape, onOrBefore, isoMinusDays, isoMinusMonth, periodChanges } = require('../lib/calc');
const { validateObservation } = require('../lib/validate');
const { zonedToUtc } = require('../lib/time');
const { healthReport, log } = require('../lib/infra');

const SECTOR_ETFS = [
  ['Technology', '資訊科技', 'XLK.US'], ['Financials', '金融', 'XLF.US'], ['Health care', '醫療保健', 'XLV.US'], ['Energy', '能源', 'XLE.US'],
  ['Consumer discretionary', '非必需消費', 'XLY.US'], ['Industrials', '工業', 'XLI.US'], ['Consumer staples', '必需消費', 'XLP.US'],
  ['Utilities', '公用事業', 'XLU.US'], ['Materials', '原物料', 'XLB.US'], ['Real estate', '房地產', 'XLRE.US'], ['Communication services', '通訊服務', 'XLC.US'],
];
// Screener exchange codes – confirm against your EODHD plan.
const MOVER_UNIVERSES = { US: 'us', Europe: 'XETRA', China: 'SHG', 'Hong Kong': 'HK', Japan: 'TSE', Taiwan: 'TW', 'Asia-Pacific': 'KO' };

const unavailable = (meta, reason) => ({ ...meta, value: null, status: 'unavailable', reason });

function fromHistory(meta, h, { source, sourceUrl, seriesId, latency = 'end-of-day', method = 'observed', asYield = false }, now = new Date()) {
  if (!h || !h.rows?.length) return unavailable(meta, 'No observations returned');
  const rows = h.rows;
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const o = {
    ...meta, value: last.value, prev: prev?.value ?? null, prevDate: prev?.date ?? null, obsDate: last.date,
    change: absChange(last.value, prev?.value), changePct: pctChange(last.value, prev?.value),
    changeBp: asYield ? bpChange(last.value, prev?.value) : undefined,
    periods: periodChanges(rows, { asYield }), history: rows.slice(-45),
    source, sourceUrl, seriesId, latency, method, retrievedAt: h.retrievedAt,
  };
  return validateObservation(o, now);
}

async function resolveInstrument(meta, quoteMap) {
  for (const src of meta.sources) {
    try {
      if (src.p === 'eodhd' && eodhd.configured()) {
        const q = quoteMap.get(src.s);
        if (!q || q.value === null) continue;
        let periods = null;
        try { const h = await eodhd.history(src.s, isoMinusDays(new Date().toISOString().slice(0, 10), 40)); periods = periodChanges(h); } catch { /* optional */ }
        return validateObservation({
          ...meta, value: q.value, prev: q.prev, change: q.change ?? absChange(q.value, q.prev), changePct: q.changePct ?? pctChange(q.value, q.prev),
          obsTime: q.obsTime, obsDate: q.obsTime ? q.obsTime.slice(0, 10) : null, volume: q.volume, periods,
          source: eodhd.NAME, seriesId: src.s, latency: process.env.EODHD_LATENCY || 'delayed', method: 'observed', retrievedAt: new Date().toISOString(),
        });
      }
      if (src.p === 'fred') {
        const h = await official.fredSeries(src.s, isoMinusDays(new Date().toISOString().slice(0, 10), 60));
        if (!h) continue;
        return fromHistory(meta, h, { source: h.source, sourceUrl: h.sourceUrl, seriesId: src.s, latency: src.latency || 'end-of-day' });
      }
    } catch (e) { log('warn', 'instrument source failed', { id: meta.id, provider: src.p, error: String(e.message || e) }); }
  }
  const needsLicensed = meta.sources.every((s) => s.p === 'eodhd');
  return unavailable(meta, needsLicensed ? 'Licensed market-data feed not connected' : 'Data temporarily unavailable');
}

/** Pure: turn Treasury curve rows into the curve block + per-tenor observations. */
function curveFromRows(t, now = new Date()) {
  const rows = t.rows;
  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const week = onOrBefore(rows, isoMinusDays(cur.date, 7));
  const month = onOrBefore(rows, isoMinusMonth(cur.date));
  const pick = (r) => r && { date: r.date, values: Object.fromEntries(UST_TENORS.map(([k]) => [k, r[k]])) };
  const names = { '3M': '3-month', '2Y': '2-year', '5Y': '5-year', '10Y': '10-year', '30Y': '30-year' };
  const tenorObs = ['2Y', '5Y', '10Y', '30Y', '3M'].map((k) => validateObservation({
    id: `ust${k.toLowerCase()}`, label: `US ${names[k]} Treasury`, zh: `美國${names[k].replace('-year', '年期').replace('-month', '個月期')}公債`, kind: 'yieldPct', decimals: 2, unit: '%',
    value: cur[k], prev: prev?.[k], prevDate: prev?.date, obsDate: cur.date, changeBp: bpChange(cur[k], prev?.[k]),
    periods: periodChanges(rows.map((r) => ({ date: r.date, value: r[k] })).filter((r) => r.value !== null), { asYield: true }),
    history: rows.slice(-45).map((r) => ({ date: r.date, value: r[k] })),
    source: t.source, sourceUrl: t.sourceUrl, seriesId: `Daily par yield curve, ${k}`, latency: 'end-of-day', method: 'observed', retrievedAt: t.retrievedAt,
    note: 'Par yields published by the US Treasury after the New York close, based on indicative bid-side quotations at or near 3:30 pm New York time.',
  }, now));
  return {
    status: 'ok', asOf: cur.date, tenors: UST_TENORS.map(([k]) => k), current: pick(cur),
    compare: { prevDay: pick(prev), week: pick(week), month: pick(month) },
    shape: curveShape(cur, prev), shapeWeek: week ? curveShape(cur, week) : null,
    source: t.source, sourceUrl: t.sourceUrl, retrievedAt: t.retrievedAt, tenorObs,
  };
}

async function buildCurve() {
  try {
    return curveFromRows(await official.treasuryCurve());
  } catch (e) {
    return { status: 'unavailable', reason: 'US Treasury data temporarily unavailable', error: String(e.message || e) };
  }
}

async function buildSovereigns() {
  const out = [];
  let mof = null;
  for (const s of SOVEREIGNS) {
    const src = s.sources[0];
    try {
      if (src.p === 'mof') {
        mof = mof || await official.mofJgb();
        const rows = mof.rows.map((r) => ({ date: r.date, value: r[src.s] })).filter((r) => r.value !== null);
        out.push(fromHistory(s, { rows, retrievedAt: mof.retrievedAt }, { source: mof.source, sourceUrl: mof.sourceUrl, seriesId: `JGB ${src.s}`, asYield: true }));
      } else if (src.p === 'bbk') {
        const h = await official.bundesbank(src.s);
        out.push(fromHistory(s, h, { source: h.source, sourceUrl: h.sourceUrl, seriesId: src.s, asYield: true }));
      } else if (src.p === 'boe') {
        const h = await official.boeSeries(src.s);
        out.push(fromHistory(s, h, { source: h.source, sourceUrl: h.sourceUrl, seriesId: src.s, asYield: true }));
      } else if (src.p === 'hkma') {
        const h = await official.hkmaYield();
        out.push(h ? fromHistory(s, h, { source: h.source, sourceUrl: h.sourceUrl, seriesId: src.s, asYield: true }) : unavailable(s, 'HKMA feed not configured'));
      } else if (src.p === 'eodhd') {
        if (!eodhd.configured()) { out.push(unavailable(s, 'Licensed market-data feed not connected')); continue; }
        const h = await eodhd.history(src.s, isoMinusDays(new Date().toISOString().slice(0, 10), 45));
        out.push(fromHistory(s, { rows: h, retrievedAt: new Date().toISOString() }, { source: eodhd.NAME, seriesId: src.s, asYield: true }));
      }
    } catch (e) { out.push(unavailable(s, 'Data temporarily unavailable')); }
  }
  return out;
}

async function buildCredit(audience) {
  const clientLicensed = process.env.ICE_BOFA_CLIENT_LICENCE === 'true';
  const out = [];
  for (const c of CREDIT) {
    if (audience === 'client' && c.licence === 'internal' && !clientLicensed) { out.push({ ...c, value: null, status: 'restricted', reason: c.licenceNote }); continue; }
    try {
      const h = await official.fredSeries(c.series, isoMinusDays(new Date().toISOString().slice(0, 10), 60));
      if (!h) { out.push(unavailable(c, 'FRED_API_KEY not set')); continue; }
      const o = fromHistory(c, h, { source: 'ICE Data Indices, LLC, via FRED', sourceUrl: h.sourceUrl, seriesId: c.series, asYield: true });
      o.internalOnly = c.licence === 'internal' && !clientLicensed;
      out.push(o);
    } catch { out.push(unavailable(c, 'Data temporarily unavailable')); }
  }
  return out;
}

async function buildPolicyRates() {
  const rates = centralBanks.policyRates.map((r) => ({ ...r, verifiedAt: centralBanks.verifiedAt }));
  try {
    const lo = await official.fredSeries('DFEDTARL', isoMinusDays(new Date().toISOString().slice(0, 10), 120));
    const hi = await official.fredSeries('DFEDTARU', isoMinusDays(new Date().toISOString().slice(0, 10), 120));
    if (lo?.rows.length && hi?.rows.length) {
      const fed = rates.find((r) => r.id === 'fed');
      const l = lo.rows.at(-1).value, u = hi.rows.at(-1).value;
      const auto = `${l.toFixed(2)}% – ${u.toFixed(2)}%`;
      if (auto !== fed.rate) { fed.rateCheck = `FRED shows ${auto} (as of ${hi.rows.at(-1).date}); configured value is ${fed.rate}. Please review.`; }
    }
  } catch { /* optional cross-check */ }
  return rates;
}

const HIGH_IMPORTANCE = /(cpi|consumer price|pce|non.?farm|payroll|unemployment rate|gdp|ism|pmi|interest rate decision|retail sales|export|trade balance)/i;
const COUNTRIES = { US: 'US', EU: 'Europe', DE: 'Europe', GB: 'UK', UK: 'UK', JP: 'Japan', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan' };

async function buildCalendar() {
  const now = new Date();
  const events = centralBanks.meetings.map((m) => {
    const utc = m.time ? zonedToUtc(m.date, m.time, m.tz) : null;
    return { ...m, kind: 'central-bank', dateUtc: utc ? utc.toISOString() : null, localTime: m.time ? `${m.time} ${m.tz}` : 'Time not pre-announced', previous: null, consensus: null, actual: null, source: m.bank + ' official schedule' };
  }).filter((e) => (e.dateUtc ? new Date(e.dateUtc) : new Date(e.date + 'T23:59:00Z')) >= new Date(now - 2 * 864e5));
  let providerStatus = 'not-configured';
  if (eodhd.configured()) {
    try {
      const from = isoMinusDays(now.toISOString().slice(0, 10), 3), to = isoMinusDays(now.toISOString().slice(0, 10), -14);
      const ev = (await eodhd.calendar(from, to)) || [];
      for (const e of ev) {
        const region = COUNTRIES[e.country];
        if (!region || !HIGH_IMPORTANCE.test(e.event)) continue;
        events.push({ ...e, region, importance: /cpi|payroll|gdp|pce/i.test(e.event) ? 'high' : 'medium', kind: 'data', consensus: e.consensus ?? null });
      }
      providerStatus = 'ok';
    } catch { providerStatus = 'error'; }
  }
  events.sort((a, b) => String(a.dateUtc || a.date).localeCompare(String(b.dateUtc || b.date)));
  return { providerStatus, events };
}

async function buildMovers() {
  if (!eodhd.configured()) return { status: 'unavailable', reason: 'Licensed market-data feed not connected' };
  const regions = {};
  for (const [region, exchange] of Object.entries(MOVER_UNIVERSES)) {
    try { regions[region] = await eodhd.movers({ exchange }); } catch { regions[region] = { status: 'unavailable' }; }
  }
  return { status: 'ok', regions, note: 'Screened universe only; see universe description per region. Prices may be delayed.' };
}

async function buildSectors() {
  if (!eodhd.configured()) return { status: 'unavailable', reason: 'Licensed market-data feed not connected' };
  try {
    const q = await eodhd.quotes(SECTOR_ETFS.map((s) => s[2]));
    const rows = SECTOR_ETFS.map(([label, zh, sym]) => ({ label, zh, symbol: sym, changePct: q.get(sym)?.changePct ?? null, obsTime: q.get(sym)?.obsTime ?? null })).filter((r) => r.changePct !== null).sort((a, b) => b.changePct - a.changePct);
    return { status: 'ok', rows, method: 'US sector performance proxied by Select Sector SPDR ETFs (daily % change).', source: eodhd.NAME };
  } catch { return { status: 'unavailable', reason: 'Data temporarily unavailable' }; }
}

/** Main entry. audience: 'client' (default) or 'internal' (admin console). */
async function buildSnapshot({ audience = 'client' } = {}) {
  const started = Date.now();
  const allMeta = [...INDICES, ...FX, ...COMMODITIES];
  let quoteMap = new Map();
  try { quoteMap = await eodhd.quotes(allMeta.flatMap((m) => m.sources.filter((s) => s.p === 'eodhd').map((s) => s.s))); } catch { /* per-instrument fallback below */ }
  const [instruments, curve, sovereigns, credit, policyRates, calendar, newsItems, movers, sectors] = await Promise.all([
    Promise.all(allMeta.map((m) => resolveInstrument(m, quoteMap))),
    buildCurve(), buildSovereigns(), buildCredit(audience), buildPolicyRates(), buildCalendar(),
    news.allNews().catch(() => []), buildMovers(), buildSectors(),
  ]);
  const series = Object.fromEntries(instruments.map((o) => [o.id, o]));
  if (curve.tenorObs) for (const o of curve.tenorObs) series[o.id] = o;
  for (const o of sovereigns) series[o.id] = o;
  for (const o of credit) series[o.id] = o;
  const snap = {
    schema: 1, environment: process.env.APP_ENV || 'production', audience, generatedAt: new Date().toISOString(), buildMs: Date.now() - started,
    series, curve, policyRates, calendar, news: newsItems, movers, sectors, health: healthReport(),
    groups: {
      indices: INDICES.map((m) => m.id), fx: FX.map((m) => m.id), commodities: COMMODITIES.map((m) => m.id),
      sovereigns: SOVEREIGNS.map((m) => m.id), credit: CREDIT.map((m) => m.id),
      keyIndicators: ['ust2y', 'ust5y', 'ust10y', 'ust30y', 'dxy', 'usdbroad', 'xau', 'brent', 'wti', 'eurusd', 'usdjpy', 'usdcnh', 'usdcny', 'usdtwd'],
    },
  };
  return snap;
}

module.exports = { buildSnapshot, curveFromRows, fromHistory, unavailable, buildCalendar, buildPolicyRates, SECTOR_ETFS, MOVER_UNIVERSES };
