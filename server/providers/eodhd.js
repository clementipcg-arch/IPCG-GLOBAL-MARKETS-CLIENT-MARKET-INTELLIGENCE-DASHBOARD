'use strict';
/**
 * Licensed market-data adapter: EOD Historical Data (https://eodhd.com).
 * Chosen because one subscription covers global indices, FX, commodities, a stock screener
 * (top movers), an economic-events calendar and a news API. Before go-live, confirm with
 * EODHD: (1) the plan includes every exchange you display, (2) the latency of each feed
 * (most index quotes are delayed 15–20 min; some are end-of-day only), and (3) that your
 * licence permits display to external clients (redistribution / "display" licence).
 *
 * To swap provider, implement the same five functions (quotes, history, movers, calendar,
 * news) in a new file and point MARKET_DATA_PROVIDER at it in server/services/snapshot.js.
 */
const { http, markHealth, cached } = require('../lib/infra');

const BASE = 'https://eodhd.com/api';
const key = () => process.env.EODHD_API_KEY;
const configured = () => Boolean(key());
const NAME = 'EODHD (licensed market data)';

function guard() {
  if (!configured()) { markHealth(NAME, false, 'EODHD_API_KEY not set', false); return false; }
  return true;
}

/** Delayed/real-time quotes for many symbols in one call. Returns Map(symbol -> quote). */
async function quotes(symbols) {
  if (!guard() || !symbols.length) return new Map();
  return cached(`eod:q:${symbols.join(',')}`, Number(process.env.QUOTE_TTL_SECONDS || 300) * 1000, async () => {
    try {
      const [first, ...rest] = symbols;
      const url = `${BASE}/real-time/${encodeURIComponent(first)}?api_token=${key()}&fmt=json${rest.length ? '&s=' + rest.map(encodeURIComponent).join(',') : ''}`;
      const j = await (await http(url)).json();
      const arr = Array.isArray(j) ? j : [j];
      const m = new Map();
      for (const q of arr) {
        const close = Number(q.close), prev = Number(q.previousClose);
        m.set(q.code, {
          value: Number.isFinite(close) ? close : null,
          prev: Number.isFinite(prev) ? prev : null,
          change: Number.isFinite(Number(q.change)) ? Number(q.change) : null,
          changePct: Number.isFinite(Number(q.change_p)) ? Number(q.change_p) : null,
          obsTime: q.timestamp ? new Date(q.timestamp * 1000).toISOString() : null,
          volume: Number(q.volume) || null,
        });
      }
      markHealth(NAME, true, `${m.size} quotes`);
      return m;
    } catch (e) { markHealth(NAME, false, String(e.message || e)); throw e; }
  });
}

/** End-of-day history for weekly / month-to-date changes. */
async function history(symbol, from) {
  if (!guard()) return null;
  return cached(`eod:h:${symbol}:${from}`, 6 * 60 * 60 * 1000, async () => {
    const j = await (await http(`${BASE}/eod/${encodeURIComponent(symbol)}?api_token=${key()}&fmt=json&from=${from}`)).json();
    return (j || []).map((r) => ({ date: r.date, value: Number(r.close) })).filter((r) => Number.isFinite(r.value));
  });
}

/**
 * Top gainers/losers from a defined, liquid universe (never the whole tape, which surfaces
 * illiquid micro-caps). Universe = exchange + minimum market cap + minimum average volume.
 */
async function movers({ exchange, minMarketCap = 5e9, minAvgVolume = 200000, limit = 8 }) {
  if (!guard()) return null;
  return cached(`eod:mv:${exchange}`, 15 * 60 * 1000, async () => {
    const filters = JSON.stringify([["exchange", "=", exchange], ["market_capitalization", ">", minMarketCap], ["avgvol_200d", ">", minAvgVolume]]);
    const get = async (sort) => {
      const url = `${BASE}/screener?api_token=${key()}&filters=${encodeURIComponent(filters)}&sort=${sort}&limit=${limit}`;
      const j = await (await http(url)).json();
      return (j.data || []).map((r) => ({
        name: r.name, ticker: r.code, exchange: r.exchange, sector: r.sector || null,
        price: Number(r.adjusted_close) || null, changePct: Number(r.refund_1d_p), change: Number(r.refund_1d),
        volume: Number(r.avgvol_1d) || null, avgVolume: Number(r.avgvol_200d) || null, obsDate: r.last_day_data_date || null,
      }));
    };
    const [gainers, losers] = await Promise.all([get('refund_1d_p.desc'), get('refund_1d_p.asc')]);
    return { gainers, losers, universe: `${exchange} listings with market cap > ${minMarketCap / 1e9}bn (local ccy) and 200-day avg volume > ${minAvgVolume.toLocaleString()}` };
  });
}

/** Economic events with actual / previous / consensus as supplied by the provider. */
async function calendar(fromIso, toIso) {
  if (!guard()) return null;
  return cached(`eod:cal:${fromIso}:${toIso}`, 30 * 60 * 1000, async () => {
    const j = await (await http(`${BASE}/economic-events?api_token=${key()}&fmt=json&from=${fromIso}&to=${toIso}&limit=1000`)).json();
    return (j || []).map((e) => ({
      dateUtc: e.date ? new Date(e.date.replace(' ', 'T') + 'Z').toISOString() : null,
      country: e.country, event: e.type, period: e.period || null,
      actual: e.actual ?? null, previous: e.previous ?? null, consensus: e.estimate ?? null,
      source: 'EODHD economic events',
    }));
  });
}

/** Financial news headlines (licensed). Summaries are shortened, never reproduced in full. */
async function news({ tag, limit = 30 }) {
  if (!guard()) return null;
  return cached(`eod:news:${tag}`, 10 * 60 * 1000, async () => {
    const j = await (await http(`${BASE}/news?api_token=${key()}&fmt=json&t=${encodeURIComponent(tag)}&limit=${limit}`)).json();
    return (j || []).map((n) => ({ title: n.title, summary: String(n.content || '').slice(0, 280), publishedAt: n.date, link: n.link, publisher: (() => { try { return new URL(n.link).host.replace(/^www\./, ''); } catch { return 'EODHD'; } })(), priority: 5 }));
  });
}

module.exports = { quotes, history, movers, calendar, news, configured, NAME };
