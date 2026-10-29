'use strict';
// Official / public-sector data adapters. All return normalised, ascending [{date:'YYYY-MM-DD', value:Number}]
// (or curve rows) and never invent values: unparseable cells become null and are dropped.
const { http, markHealth, cached } = require('../lib/infra');
const { UST_TENORS } = require('../../config/instruments');

const num = (s) => {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/^"|"$/g, '');
  if (t === '' || t === '.' || t.toUpperCase() === 'N/A' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function parseCsv(text) {
  return text.replace(/\r/g, '').split('\n').filter(Boolean).map((line) => {
    const out = []; let cur = ''; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
}

/* ---------------- US Treasury daily par yield curve ---------------- */
// https://home.treasury.gov/resource-center/data-chart-center/interest-rates  (public domain)
const UST_URL = (year) => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

function parseTreasuryCsv(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.replace(/"/g, '').trim());
  const idx = {};
  for (const [tenor, col] of UST_TENORS) idx[tenor] = header.findIndex((h) => h.toLowerCase() === col.toLowerCase());
  return rows.slice(1).map((r) => {
    const [mm, dd, yyyy] = r[0].replace(/"/g, '').split('/');
    const o = { date: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` };
    for (const [tenor] of UST_TENORS) o[tenor] = idx[tenor] >= 0 ? num(r[idx[tenor]]) : null;
    return o;
  }).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date)).sort((a, b) => a.date.localeCompare(b.date));
}

async function treasuryCurve(now = new Date()) {
  return cached('ust', 30 * 60 * 1000, async () => {
    try {
      const y = now.getUTCFullYear();
      let rows = parseTreasuryCsv(await (await http(UST_URL(y))).text());
      if (rows.length < 30) rows = parseTreasuryCsv(await (await http(UST_URL(y - 1))).text()).concat(rows); // early January
      markHealth('US Treasury', true, `${rows.length} curve observations`);
      return { rows, source: 'U.S. Department of the Treasury – Daily Treasury Par Yield Curve Rates', sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('US Treasury', false, String(e.message || e)); throw e; }
  });
}

/* ---------------- FRED (St. Louis Fed) ---------------- */
async function fredSeries(seriesId, start) {
  const key = process.env.FRED_API_KEY;
  if (!key) { markHealth('FRED', false, 'FRED_API_KEY not set', false); return null; }
  return cached(`fred:${seriesId}`, 60 * 60 * 1000, async () => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${key}&file_type=json&observation_start=${start}`;
      const j = await (await http(url)).json();
      const rows = (j.observations || []).map((o) => ({ date: o.date, value: num(o.value) })).filter((o) => o.value !== null);
      markHealth('FRED', true);
      return { rows, source: 'FRED, Federal Reserve Bank of St. Louis', sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`, retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('FRED', false, String(e.message || e)); throw e; }
  });
}

/* ---------------- Japan MoF JGB yields ---------------- */
const MOF_URL = 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv';
function parseMofCsv(text) {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => /^date$/i.test(r[0]));
  if (h < 0) throw new Error('MoF CSV header not found');
  const header = rows[h];
  return rows.slice(h + 1).map((r) => {
    const [y, m, d] = r[0].split('/');
    const o = { date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    header.forEach((col, i) => { if (i) o[col] = num(r[i]); });
    return o;
  }).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
}
async function mofJgb() {
  return cached('mof', 2 * 60 * 60 * 1000, async () => {
    try {
      const rows = parseMofCsv(await (await http(MOF_URL)).text());
      markHealth('Japan MoF', true);
      return { rows, source: 'Ministry of Finance Japan – JGB interest rates', sourceUrl: 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/index.htm', retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('Japan MoF', false, String(e.message || e)); throw e; }
  });
}

/* ---------------- SDMX-JSON (Bundesbank, ECB) ---------------- */
function parseSdmxJson(j) {
  const ds = j.data?.dataSets?.[0] || j.dataSets?.[0];
  const st = j.data?.structure || j.structure;
  const series = ds && Object.values(ds.series || {})[0];
  const times = st?.dimensions?.observation?.[0]?.values || [];
  if (!series) return [];
  return Object.entries(series.observations).map(([i, v]) => ({ date: times[i]?.id, value: num(v[0]) })).filter((o) => o.date && o.value !== null).sort((a, b) => a.date.localeCompare(b.date));
}
async function bundesbank(flowKey) {
  return cached(`bbk:${flowKey}`, 2 * 60 * 60 * 1000, async () => {
    try {
      const url = `https://api.statistiken.bundesbank.de/rest/data/${flowKey}?lastNObservations=45`;
      const j = await (await http(url, { headers: { accept: 'application/vnd.sdmx.data+json;version=1.0.0' } })).json();
      markHealth('Deutsche Bundesbank', true);
      return { rows: parseSdmxJson(j), source: 'Deutsche Bundesbank – yields on listed Federal securities', sourceUrl: 'https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields', retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('Deutsche Bundesbank', false, String(e.message || e)); throw e; }
  });
}

/* ---------------- Bank of England database ---------------- */
async function boeSeries(code) {
  return cached(`boe:${code}`, 2 * 60 * 60 * 1000, async () => {
    try {
      const from = new Date(Date.now() - 60 * 864e5).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
      const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=${from}&Dateto=now&SeriesCodes=${code}&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`;
      const rows = parseCsv(await (await http(url)).text()).slice(1).map((r) => {
        const d = new Date(r[0] + ' UTC');
        return { date: isNaN(d) ? null : d.toISOString().slice(0, 10), value: num(r[1]) };
      }).filter((o) => o.date && o.value !== null).sort((a, b) => a.date.localeCompare(b.date));
      markHealth('Bank of England', true);
      return { rows, source: 'Bank of England Database', sourceUrl: `https://www.bankofengland.co.uk/boeapps/database/`, retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('Bank of England', false, String(e.message || e)); throw e; }
  });
}

/* ---------------- HKMA Open API ---------------- */
// HKMA publishes Exchange Fund Bills & Notes / HKGB yields through its Open API. The exact
// endpoint and field name are configured (HKMA_YIELD_ENDPOINT, HKMA_YIELD_FIELD) because they
// must be confirmed on https://apidocs.hkma.gov.hk before use; disabled until configured.
async function hkmaYield() {
  const ep = process.env.HKMA_YIELD_ENDPOINT, field = process.env.HKMA_YIELD_FIELD;
  if (!ep || !field) { markHealth('HKMA', false, 'HKMA_YIELD_ENDPOINT / HKMA_YIELD_FIELD not set', false); return null; }
  return cached('hkma', 2 * 60 * 60 * 1000, async () => {
    try {
      const j = await (await http(ep)).json();
      const recs = j.result?.records || [];
      const rows = recs.map((r) => ({ date: String(r.end_of_day || r.date || '').slice(0, 10), value: num(r[field]) })).filter((o) => o.date && o.value !== null).sort((a, b) => a.date.localeCompare(b.date));
      markHealth('HKMA', true);
      return { rows, source: 'Hong Kong Monetary Authority Open API', sourceUrl: 'https://apidocs.hkma.gov.hk/', retrievedAt: new Date().toISOString() };
    } catch (e) { markHealth('HKMA', false, String(e.message || e)); throw e; }
  });
}

module.exports = { treasuryCurve, parseTreasuryCsv, fredSeries, mofJgb, parseMofCsv, bundesbank, parseSdmxJson, boeSeries, hkmaYield, parseCsv, num };
