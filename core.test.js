'use strict';
process.env.DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'ipcg-test-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../server/lib/calc');
const { validateObservation, dedupeNews } = require('../server/lib/validate');
const { parseTreasuryCsv, parseMofCsv, parseSdmxJson, num } = require('../server/providers/official');
const { parseFeed, classify } = require('../server/providers/news');
const briefing = require('../server/services/briefing');
const { zonedToUtc, weekdaysBetween } = require('../server/lib/time');

test('basis-point and percentage changes', () => {
  assert.equal(calc.bpChange(5.05, 4.99), 6);
  assert.equal(calc.bpChange(4.67, 4.70), -3);
  assert.equal(calc.pctChange(7743.97, 7722.60), 0.2767);
  assert.equal(calc.pctChange(1, 0), null);
  assert.equal(calc.pctChange(null, 1), null);
  assert.equal(calc.round(0.1 + 0.2, 2), 0.3);
});

test('curve shape and steepening labels', () => {
  const cur = { '3M': 4.18, '2Y': 4.67, '10Y': 5.05 }, prev = { '3M': 4.22, '2Y': 4.70, '10Y': 4.99 };
  const s = calc.curveShape(cur, prev);
  assert.equal(s.spread2s10s, 38); assert.equal(s.delta2s10s, 9); assert.equal(s.move, 'steepening'); assert.equal(s.style, 'twist steepening');
  assert.equal(s.spread3m10s, 87);
  assert.equal(calc.curveShape({ '2Y': 4.5, '10Y': 4.2, '3M': 4.6 }).shape, 'inverted');
  assert.equal(calc.curveShape({ '2Y': 4.8, '10Y': 5.0 }, { '2Y': 4.7, '10Y': 4.95 }).style, 'bear flattening');
});

test('period changes use last observation on or before the reference date', () => {
  const h = [['2026-09-28', 5.24], ['2026-09-30', 5.29], ['2026-10-21', 5.13], ['2026-10-27', 4.99], ['2026-10-28', 5.05]].map(([date, value]) => ({ date, value }));
  const p = calc.periodChanges(h, { asYield: true });
  assert.equal(p.day.change, 6); assert.equal(p.week.ref, '2026-10-21'); assert.equal(p.week.change, -8);
  assert.equal(p.mtd.ref, '2026-09-30'); assert.equal(p.mtd.change, -24);
  assert.equal(calc.isoMinusMonth('2026-03-31'), '2026-02-28');
});

test('grounding check flags numbers absent from facts but ignores index names and dates', () => {
  const facts = [7743.97, 0.28, 5.05, 6];
  assert.deepEqual(calc.ungroundedNumbers('The S&P 500 rose 0.28% to 7,743.97 on 28 October 2026.', facts), []);
  assert.deepEqual(calc.ungroundedNumbers('The 10-year rose 6 bp to 5.05% and the STOXX 600 fell 1.4%.', facts), [1.4]);
});

test('validation: staleness, lag, large moves, units', () => {
  const now = new Date('2026-10-29T03:40:00Z');
  assert.equal(validateObservation({ kind: 'yieldPct', value: 5.05, changeBp: 6, obsDate: '2026-10-28', latency: 'end-of-day' }, now).status, 'ok');
  assert.equal(validateObservation({ kind: 'fx', value: 156.87, changePct: -0.15, obsDate: '2026-10-23', latency: 'weekly' }, now).status, 'lagged');
  assert.equal(validateObservation({ kind: 'index', value: 7000, changePct: 0.1, obsDate: '2026-10-20', latency: 'end-of-day' }, now).status, 'stale');
  assert.equal(validateObservation({ kind: 'index', value: 7000, changePct: 25, obsDate: '2026-10-28', latency: 'end-of-day' }, now).status, 'check');
  assert.equal(validateObservation({ kind: 'yieldPct', value: 505, changeBp: 0, obsDate: '2026-10-28', latency: 'end-of-day' }, now).status, 'check');
  assert.equal(validateObservation({ kind: 'fx', value: null }, now).status, 'unavailable');
});

test('duplicate news keeps the primary source', () => {
  const out = dedupeNews([
    { title: 'Fed holds interest rates steady in split vote', link: 'a', publishedAt: '2026-10-28T19:00:00Z', priority: 5, publisher: 'Wire' },
    { title: 'Fed holds interest rates steady in a split vote', link: 'b', publishedAt: '2026-10-28T18:00:00Z', priority: 1, publisher: 'Federal Reserve' },
    { title: 'Oil rises after refinery attack', link: 'c', publishedAt: '2026-10-28T20:00:00Z', priority: 5 },
  ]);
  assert.equal(out.length, 2);
  assert.ok(out.some((n) => n.publisher === 'Federal Reserve'));
});

test('parsers: Treasury CSV, MoF CSV, SDMX-JSON, RSS', () => {
  const t = parseTreasuryCsv('Date,"1 Mo","3 Mo","6 Mo","1 Yr","2 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"\n10/28/2026,4.07,4.18,4.32,4.47,4.67,4.85,4.95,5.05,5.41,5.37\n10/27/2026,4.10,4.22,4.34,4.50,4.70,4.82,4.91,4.99,5.34,5.30\n');
  assert.equal(t[0].date, '2026-10-27'); assert.equal(t[1]['10Y'], 5.05); assert.equal(t[1]['3M'], 4.18);
  const m = parseMofCsv('Interest Rate\nDate,1Y,2Y,10Y\n2026/10/27,1.651,1.888,2.829\n');
  assert.equal(m[0].date, '2026-10-27'); assert.equal(m[0]['10Y'], 2.829);
  const sd = parseSdmxJson({ data: { dataSets: [{ series: { '0:0': { observations: { 0: [2.61], 1: [2.65] } } } }], structure: { dimensions: { observation: [{ values: [{ id: '2026-10-27' }, { id: '2026-10-28' }] }] } } } });
  assert.deepEqual(sd.map((x) => x.value), [2.61, 2.65]);
  const f = parseFeed('<rss><channel><item><title>Federal Reserve issues FOMC statement</title><link>https://x/y</link><pubDate>Wed, 28 Oct 2026 18:00:00 GMT</pubDate><description><![CDATA[Statement]]></description></item></channel></rss>');
  assert.equal(f[0].publishedAt, '2026-10-28T18:00:00.000Z');
  assert.ok(classify(f[0], {}).regions.includes('US'));
  assert.equal(num('.'), null); assert.equal(num('N/A'), null); assert.equal(num('4.07'), 4.07);
});

test('time zone conversion to UTC', () => {
  assert.equal(zonedToUtc('2026-10-29', '14:15', 'Europe/Berlin').toISOString(), '2026-10-29T13:15:00.000Z'); // CET after DST ends 25 Oct
  assert.equal(zonedToUtc('2026-12-09', '14:00', 'America/New_York').toISOString(), '2026-12-09T19:00:00.000Z');
  assert.equal(weekdaysBetween('2026-10-23', '2026-10-28'), 3);
});

test('AI draft validator rejects ungrounded numbers, unknown citations and advice', () => {
  const facts = [{ id: 'F1', numbers: [5.05, 6] }];
  const ok = briefing.validateAiDraft({ items: [{ headline: 'Yields', what: 'The 10-year yield rose 6 bp to 5.05%.', why: 'x', factIds: ['F1'] }] }, facts, []);
  assert.deepEqual(ok, []);
  const bad = briefing.validateAiDraft({ items: [{ headline: 'Yields', what: 'The 10-year yield rose 9 bp to 5.15%. Investors should buy bonds.', why: 'x', factIds: ['F9'] }] }, facts, []);
  assert.ok(bad.some((p) => /unknown fact/.test(p)));
  assert.ok(bad.some((p) => /5.15/.test(p)));
  assert.ok(bad.some((p) => /recommendation/.test(p)));
});

test('approval workflow: drafts are not public until approved by a named reviewer', async () => {
  const snap = { generatedAt: new Date().toISOString(), series: { ust10y: { id: 'ust10y', label: 'US 10-year Treasury', kind: 'yieldPct', value: 5.05, changeBp: 6, status: 'ok', obsDate: '2026-10-28', source: 'UST', sourceUrl: 'u' } }, groups: { indices: [], fx: [], commodities: [], credit: [] }, policyRates: [], calendar: { events: [] } };
  const b = require('../server/services/briefing');
  const rec = await b.generate(snap, { useAi: false });
  assert.equal(rec.status, 'draft');
  assert.equal(b.currentPublished('daily'), null);
  assert.throws(() => b.update(rec.id, { status: 'approved' }), /Reviewer/);
  b.update(rec.id, { status: 'approved' }, 'Jane Tan');
  const pub = b.currentPublished('daily');
  assert.equal(pub.approvedBy, 'Jane Tan');
  assert.equal(pub.facts, undefined);
  assert.throws(() => b.update(rec.id, { items: [] }, 'x'), /locked/);
});
