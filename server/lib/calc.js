'use strict';
// Pure market calculations. Every function here is covered by test/calc.test.js.

/** Round to n decimals without floating-point artefacts (e.g. 0.1+0.2). */
function round(x, n = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** n;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Percentage change from prev to cur. Returns null when either side is missing or prev is 0. */
function pctChange(cur, prev) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return round(((cur - prev) / Math.abs(prev)) * 100, 4);
}

/** Absolute change. */
function absChange(cur, prev) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  return round(cur - prev, 6);
}

/** Change in basis points between two yields quoted in percent (5.05 vs 4.99 -> +6 bp). */
function bpChange(curPct, prevPct) {
  if (!Number.isFinite(curPct) || !Number.isFinite(prevPct)) return null;
  return round((curPct - prevPct) * 100, 1);
}

/** Spread in bp between a long and a short yield, both in percent. */
function spreadBp(longPct, shortPct) {
  return bpChange(longPct, shortPct);
}

/**
 * Describe the change in curve shape between two observations using the 2s10s spread
 * (and 3m10s as a cross-check). Purely arithmetical: does NOT attribute causes.
 * @returns {{shape:string, move:string, spread2s10s:number, spread3m10s:number, delta2s10s:number, style:string|null}}
 */
function curveShape(cur, prev) {
  const s = spreadBp(cur['10Y'], cur['2Y']);
  const s3m = spreadBp(cur['10Y'], cur['3M']);
  const shape = s === null ? 'unknown' : s < 0 ? 'inverted' : s < 25 ? 'flat' : 'upward-sloping';
  let move = 'unchanged', delta = null, style = null;
  if (prev) {
    const ps = spreadBp(prev['10Y'], prev['2Y']);
    delta = s !== null && ps !== null ? round(s - ps, 1) : null;
    if (delta !== null) {
      if (delta >= 2) move = 'steepening';
      else if (delta <= -2) move = 'flattening';
    }
    const d2 = bpChange(cur['2Y'], prev['2Y']);
    const d10 = bpChange(cur['10Y'], prev['10Y']);
    if (d2 !== null && d10 !== null && move !== 'unchanged') {
      // Conventional labels describing which end moved, not why.
      if (move === 'steepening') style = d10 > 0 && d2 >= 0 ? 'bear steepening' : d2 < 0 && d10 <= 0 ? 'bull steepening' : 'twist steepening';
      else style = d2 > 0 && d10 >= 0 ? 'bear flattening' : d10 < 0 && d2 <= 0 ? 'bull flattening' : 'twist flattening';
    }
  }
  return { shape, move, spread2s10s: s, spread3m10s: s3m, delta2s10s: delta, style };
}

/** Find the observation on or before a target date (YYYY-MM-DD) in an ascending [{date, ...}] list. */
function onOrBefore(rows, targetIso) {
  let best = null;
  for (const r of rows) {
    if (r.date <= targetIso) best = r; else break;
  }
  return best;
}

/** ISO date n calendar days before iso. */
function isoMinusDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** ISO date one calendar month earlier (clamped to month end). */
function isoMinusMonth(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** First calendar day of the month of iso, minus one day -> month-to-date reference (last obs of previous month). */
function monthStartRef(iso) {
  return isoMinusDays(iso.slice(0, 8) + '01', 1);
}

/**
 * Compute day / week / month-to-date changes for an ascending history [{date, value}].
 * Week = last observation on or before (latest date - 7 days). MTD = last obs of previous month.
 */
function periodChanges(history, { asYield = false } = {}) {
  if (!history || history.length < 2) return null;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const wk = onOrBefore(history, isoMinusDays(last.date, 7));
  const mtd = onOrBefore(history, monthStartRef(last.date));
  const f = asYield ? bpChange : pctChange;
  return {
    asOf: last.date,
    day: { ref: prev.date, change: f(last.value, prev.value) },
    week: wk ? { ref: wk.date, change: f(last.value, wk.value) } : null,
    mtd: mtd ? { ref: mtd.date, change: f(last.value, mtd.value) } : null,
  };
}

/**
 * Extract numeric tokens from generated text so they can be checked against the fact set.
 * "rose 6 bp to 5.05%" -> [6, 5.05]
 */
function extractNumbers(text) {
  const out = [];
  const re = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(text))) out.push(Number(m[0].replace(/,/g, '')));
  return out;
}

/**
 * Grounding check for AI-drafted commentary: every number in the text must match
 * (to the shown precision) a number present in the supplied facts, or be a small
 * ordinal/calendar number (years, day-of-month, counts up to 31).
 */
function ungroundedNumbers(text, factNumbers) {
  const allowed = new Set();
  for (const n of factNumbers) {
    if (!Number.isFinite(n)) continue;
    for (const d of [0, 1, 2, 3, 4]) allowed.add(round(n, d)); allowed.add(round(Math.abs(n), 0)); allowed.add(round(Math.abs(n), 1)); allowed.add(round(Math.abs(n), 2));
  }
  // Numbers that are part of instrument names are not data points.
  const cleaned = String(text).replace(/\b(S&P|STOXX( Europe)?|EURO STOXX|Russell|Nikkei|CAC|FTSE|CSI|DAX|KOSPI|Hang Seng|MSCI [A-Z ]+?)\s?\d+\b/gi, '$1').replace(/\bH\.\d+\b/g, '');
  return extractNumbers(cleaned).filter((x) => {
    const ax = Math.abs(x);
    if (Number.isInteger(ax) && ax <= 31) return false; // dates, counts, ordinals
    if (Number.isInteger(ax) && ax >= 1990 && ax <= 2100) return false; // years
    return !allowed.has(round(x, 4)) && !allowed.has(round(ax, 4));
  });
}

module.exports = { round, pctChange, absChange, bpChange, spreadBp, curveShape, onOrBefore, isoMinusDays, isoMinusMonth, monthStartRef, periodChanges, extractNumbers, ungroundedNumbers };
