'use strict';
// Data validation: missing values, staleness, implausible jumps, unit sanity, duplicate news.
const { weekdaysBetween, isoDateIn } = require('./time');

/**
 * Expected maximum age (in weekdays) before an observation counts as stale, by latency class.
 * - real-time / delayed quotes: 1 weekday (allows for the market's own overnight close)
 * - end-of-day official series: 2 weekdays (publication lag + time-zone gap)
 * - weekly-released series (e.g. Fed H.10 FX): 8 weekdays
 */
const STALE_WEEKDAYS = { 'real-time': 1, delayed: 1, 'end-of-day': 2, weekly: 8, monthly: 30, reported: 2 };

/** Plausible single-day moves. Anything larger is flagged "check" rather than shown silently. */
const MAX_DAILY_MOVE = { index: 12, fx: 5, commodity: 15, yieldBp: 60, spreadBp: 120 };

/** Plausible value ranges as a unit sanity check (catches percent vs decimal, cents vs dollars). */
const RANGES = {
  yieldPct: [-2, 25],
  spreadPct: [0, 30],
  fx: [0.0001, 100000],
  index: [1, 1000000],
  commodity: [0.01, 100000],
  policyRatePct: [-2, 30],
};

/**
 * Validate one normalised observation in place; returns it with `status` and `flags`.
 * status: ok | lagged | stale | check | unavailable | restricted
 */
function validateObservation(obs, now = new Date()) {
  const flags = [];
  if (obs.status === 'unavailable' || obs.status === 'restricted') return obs;
  if (obs.value === null || obs.value === undefined || !Number.isFinite(obs.value)) {
    obs.status = 'unavailable';
    obs.flags = ['missing-value'];
    return obs;
  }
  const range = RANGES[obs.kind];
  if (range && (obs.value < range[0] || obs.value > range[1])) flags.push('out-of-range');

  const limit = obs.kind === 'yieldPct' ? MAX_DAILY_MOVE.yieldBp : obs.kind === 'spreadPct' ? MAX_DAILY_MOVE.spreadBp : MAX_DAILY_MOVE[obs.kind];
  const move = obs.kind === 'yieldPct' || obs.kind === 'spreadPct' ? Math.abs(obs.changeBp ?? 0) : Math.abs(obs.changePct ?? 0);
  if (limit && move > limit) flags.push('large-move');

  let status = 'ok';
  if (obs.obsDate) {
    const age = weekdaysBetween(obs.obsDate, isoDateIn(now, 'America/New_York'));
    const maxAge = STALE_WEEKDAYS[obs.latency] ?? 2;
    obs.ageWeekdays = age;
    if (age > maxAge * 3) status = 'stale';
    else if (age > maxAge) status = obs.latency === 'weekly' ? 'lagged' : 'stale';
    else if (obs.latency === 'weekly') status = 'lagged';
  } else {
    flags.push('no-observation-date');
    status = 'check';
  }
  if (flags.includes('out-of-range') || flags.includes('large-move')) status = 'check';
  obs.status = status;
  obs.flags = flags;
  return obs;
}

/** Normalise a headline for duplicate detection. */
function headlineKey(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9一-鿿 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3).sort().join(' ');
}

/** Jaccard similarity of word sets. */
function similarity(a, b) {
  const A = new Set(a.split(' ')), B = new Set(b.split(' '));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Remove duplicate news. When two stories are near-identical, keep the one with the
 * higher source priority (primary/official sources first), then the earlier publication.
 */
function dedupeNews(items, threshold = 0.6) {
  const sorted = [...items].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || String(a.publishedAt).localeCompare(String(b.publishedAt)));
  const kept = [];
  for (const it of sorted) {
    const key = headlineKey(it.title);
    if (kept.some((k) => k.link === it.link || similarity(k._key, key) >= threshold)) continue;
    kept.push({ ...it, _key: key });
  }
  return kept.map(({ _key, ...rest }) => rest).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}

module.exports = { validateObservation, dedupeNews, headlineKey, similarity, STALE_WEEKDAYS, MAX_DAILY_MOVE, RANGES };
