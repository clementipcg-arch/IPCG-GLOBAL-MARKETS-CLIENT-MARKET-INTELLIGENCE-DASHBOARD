'use strict';
/**
 * Briefing generation and the publication workflow.
 *
 *   snapshot ──► detectFacts() ──► deterministic draft ──(optional)──► AI polish (grounded) ──► DRAFT
 *                                                                                              │
 *                                         IPCG reviewer edits / approves in /admin  ◄──────────┘
 *                                                              │
 *                                                       APPROVED ──► shown to clients
 *
 * Nothing reaches clients until a named reviewer approves it. Every draft stores the facts,
 * the source links and the snapshot timestamp it was generated from.
 */
const crypto = require('crypto');
const { readJson, writeJson, log, http } = require('../lib/infra');
const { round, ungroundedNumbers } = require('../lib/calc');
const { sgtLabel } = require('../lib/time');

const THRESHOLDS = { indexPct: 1.0, fxPct: 0.5, commodityPct: 2.0, yieldBp: 5, spreadBp: 10, curveBp: 5 };

const fmtNum = (v, d = 2) => (v === null || v === undefined ? 'n/a' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v, d = 2, suffix = '') => (v === null || v === undefined ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtNum(Math.abs(v), d)}${suffix}`);
const dateLabel = (iso) => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

// Generic, non-causal "why it matters" lines. They explain relevance, not reasons for the move.
const WHY = {
  yield: 'Treasury yields are the reference rate for bond pricing and borrowing costs worldwide; moves affect the value of existing bond holdings.',
  curve: 'The shape of the yield curve reflects the balance between short-term policy-rate expectations and longer-term rates.',
  index: 'Large index moves affect the value of equity portfolios and can signal shifts in investor risk appetite.',
  fx: 'Currency moves change the value of foreign-currency assets when measured in a client’s home currency.',
  commodity: 'Commodity prices feed into inflation and the earnings of producers and consumers of raw materials.',
  credit: 'Credit spreads measure the extra yield investors demand over Treasuries to hold corporate bonds.',
  policy: 'Central-bank decisions set short-term interest rates and influence bond yields, currencies and equity valuations.',
};

/** Turn a snapshot into a list of citable facts. */
function detectFacts(snap) {
  const facts = [];
  const add = (f) => facts.push({ id: `F${facts.length + 1}`, ...f });
  const S = snap.series || {};
  const usable = (o) => o && o.value !== null && ['ok', 'lagged'].includes(o.status);

  for (const id of ['ust2y', 'ust10y', 'ust30y']) {
    const o = S[id];
    if (!usable(o) || o.changeBp === null) continue;
    add({ kind: 'yield', assetClass: 'Rates', region: 'US', score: Math.abs(o.changeBp) / THRESHOLDS.yieldBp + (id === 'ust10y' ? 0.5 : 0),
      text: `${o.label} yield ${o.changeBp > 0 ? 'rose' : o.changeBp < 0 ? 'fell' : 'was unchanged'}${o.changeBp ? ' ' + Math.abs(o.changeBp) + ' bp' : ''} to ${fmtNum(o.value)}% (${dateLabel(o.obsDate)} close).`,
      numbers: [o.value, o.changeBp, Math.abs(o.changeBp)], sources: [{ label: o.source, url: o.sourceUrl }], obsDate: o.obsDate });
  }
  const c = snap.curve;
  if (c && c.status === 'ok' && c.shape && c.shape.delta2s10s !== null) {
    const sh = c.shape;
    add({ kind: 'curve', assetClass: 'Rates', region: 'US', score: Math.abs(sh.delta2s10s) / THRESHOLDS.curveBp,
      text: `The 2-year/10-year Treasury spread ${sh.delta2s10s > 0 ? 'widened' : sh.delta2s10s < 0 ? 'narrowed' : 'held'} to ${signed(sh.spread2s10s, 0)} bp (${sh.move}${sh.style ? ', ' + sh.style : ''}).`,
      numbers: [sh.spread2s10s, sh.delta2s10s, Math.abs(sh.delta2s10s)], sources: [{ label: c.source, url: c.sourceUrl }], obsDate: c.asOf });
  }
  for (const id of snap.groups?.indices || []) {
    const o = S[id];
    if (!usable(o) || o.changePct === null) continue;
    add({ kind: 'index', assetClass: 'Equities', region: o.region, score: Math.abs(o.changePct) / THRESHOLDS.indexPct,
      text: `${o.label} ${o.changePct >= 0 ? 'gained' : 'lost'} ${fmtNum(Math.abs(o.changePct))}% to ${fmtNum(o.value)}.`,
      numbers: [o.value, o.changePct, Math.abs(o.changePct), o.change], sources: [{ label: o.source, url: o.sourceUrl }], obsDate: o.obsDate });
  }
  for (const [grp, kind, thr] of [['fx', 'fx', THRESHOLDS.fxPct], ['commodities', 'commodity', THRESHOLDS.commodityPct]]) {
    for (const id of snap.groups?.[grp] || []) {
      const o = S[id];
      if (!usable(o) || o.changePct === null) continue;
      add({ kind, assetClass: kind === 'fx' ? 'FX' : 'Commodities', region: 'Global', score: Math.abs(o.changePct) / thr,
        text: `${o.label} ${o.changePct >= 0 ? 'rose' : 'fell'} ${fmtNum(Math.abs(o.changePct))}% to ${fmtNum(o.value, o.decimals)}${o.unit ? ' ' + o.unit : ''}.`,
        numbers: [o.value, o.changePct, Math.abs(o.changePct)], sources: [{ label: o.source, url: o.sourceUrl }], obsDate: o.obsDate });
    }
  }
  for (const id of snap.groups?.credit || []) {
    const o = S[id];
    if (!usable(o) || o.changeBp === null || o.internalOnly) continue; // licence-restricted data never enters client text
    add({ kind: 'credit', assetClass: 'Credit', region: 'US', score: Math.abs(o.changeBp) / THRESHOLDS.spreadBp,
      text: `${o.label} ${o.changeBp > 0 ? 'widened' : 'tightened'} ${Math.abs(o.changeBp)} bp to ${Math.round(o.value * 100)} bp.`,
      numbers: [Math.round(o.value * 100), o.changeBp, Math.abs(o.changeBp)], sources: [{ label: o.source, url: o.sourceUrl }], obsDate: o.obsDate });
  }
  for (const r of snap.policyRates || []) {
    const ageDays = (Date.now() - new Date(String(r.lastDecision).length === 7 ? r.lastDecision + '-20' : r.lastDecision)) / 864e5;
    if (ageDays > 3) continue;
    add({ kind: 'policy', assetClass: 'Central banks', region: r.region, score: 3,
      text: `${r.bank}: ${r.decision.toLowerCase()} — ${r.instrument.toLowerCase()} at ${r.rate}.${r.detail ? ' ' + r.detail : ''}`,
      numbers: (r.rate.match(/\d+(\.\d+)?/g) || []).map(Number), sources: [{ label: r.source, url: r.sourceUrl }], obsDate: r.lastDecision });
  }
  return facts.sort((a, b) => b.score - a.score);
}

const sigFor = (f) => f.score >= 1;

/** Deterministic, fact-only draft. Always available, needs no AI. */
function deterministicDraft(snap, facts, mode = 'daily') {
  const groups = new Map();
  for (const f of facts.filter(sigFor)) {
    const k = f.kind === 'curve' ? 'yield' : f.kind;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const titles = { policy: 'Central banks', yield: 'US Treasuries', index: 'Equity markets', fx: 'Currencies', commodity: 'Commodities', credit: 'Credit markets' };
  const order = ['policy', 'yield', 'index', 'credit', 'commodity', 'fx'];
  const items = order.filter((k) => groups.has(k)).slice(0, 5).map((k) => {
    const fs = groups.get(k).slice(0, 3);
    return {
      headline: titles[k], what: fs.map((f) => f.text).join(' '), why: WHY[k],
      affected: [...new Set(fs.map((f) => f.assetClass).concat(fs.map((f) => f.region)))].filter((x) => x && x !== 'Global'),
      factIds: fs.map((f) => f.id), sources: dedupeSources(fs.flatMap((f) => f.sources)), origin: 'data',
    };
  });
  return { mode, items, whatToWatch: whatToWatch(snap), generator: 'deterministic' };
}

function dedupeSources(list) {
  const seen = new Set();
  return list.filter((s) => s && s.url && !seen.has(s.url) && seen.add(s.url));
}

function whatToWatch(snap, days = 7) {
  const now = Date.now();
  return (snap.calendar?.events || []).filter((e) => e.importance === 'high').filter((e) => {
    const t = new Date(e.dateUtc || e.date + 'T12:00:00Z').getTime();
    return t >= now - 6 * 3600e3 && t <= now + days * 864e5;
  }).slice(0, 5).map((e) => ({ date: e.date, dateUtc: e.dateUtc, event: e.event, region: e.region, sourceUrl: e.sourceUrl }));
}

/* ---------------- optional AI polish ---------------- */
const UNSAFE = /\b(buy|sell|accumulate|should (buy|sell|invest)|we recommend|guarantee[ds]?|will (rise|fall|rally|crash|surge|plunge)|certain to|risk-free|sure to)\b/i;

function validateAiDraft(draft, facts, news) {
  const problems = [];
  const factIds = new Set(facts.map((f) => f.id));
  const newsIds = new Set(news.map((n) => n.id));
  const numbers = facts.flatMap((f) => f.numbers).concat(news.flatMap((n) => n.numbers || []));
  if (!Array.isArray(draft.items) || !draft.items.length || draft.items.length > 5) problems.push('items must be 1–5');
  for (const [i, it] of (draft.items || []).entries()) {
    const cites = [...(it.factIds || []), ...(it.newsIds || [])];
    if (!cites.length) problems.push(`item ${i + 1}: no citations`);
    for (const id of it.factIds || []) if (!factIds.has(id)) problems.push(`item ${i + 1}: unknown fact ${id}`);
    for (const id of it.newsIds || []) if (!newsIds.has(id)) problems.push(`item ${i + 1}: unknown news ${id}`);
    const text = `${it.headline} ${it.what} ${it.why}`;
    const bad = ungroundedNumbers(text, numbers);
    if (bad.length) problems.push(`item ${i + 1}: numbers not in source data: ${bad.join(', ')}`);
    if (UNSAFE.test(text)) problems.push(`item ${i + 1}: contains recommendation or certainty language`);
  }
  return problems;
}

async function aiPolish(snap, facts, mode) {
  const key = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) return null;
  const newsIn = (snap.news || []).slice(0, 15).map((n, i) => ({ id: `N${i + 1}`, title: n.title, summary: n.summary, publisher: n.publisher, publishedAt: n.publishedAt, link: n.link }));
  const sys = [
    'You draft a concise market briefing for clients of a Singapore private wealth manager. Tone: measured, institutional, plain English.',
    'Use ONLY the facts and news provided. Do not add numbers, events, quotes, forecasts or causes that are not stated in them.',
    'If a news item reports a cause, attribute it ("according to Reuters"). Otherwise describe moves without explaining why. Use "may" for possible contributors.',
    'Never recommend buying or selling. Never imply certainty about future prices.',
    `Return JSON only: {"items":[{"headline":str,"what":str,"why":str,"affected":[str],"factIds":[str],"newsIds":[str]}]} with 3–5 items for a ${mode} briefing.`,
  ].join('\n');
  const user = JSON.stringify({ snapshotTime: snap.generatedAt, facts: facts.slice(0, 25).map(({ id, text, assetClass, region, obsDate }) => ({ id, text, assetClass, region, obsDate })), news: newsIn });
  try {
    const res = await http('https://api.anthropic.com/v1/messages', {
      method: 'POST', timeoutMs: 60000, retries: 1,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1800, system: sys, messages: [{ role: 'user', content: user }] }),
    });
    const j = await res.json();
    const text = (j.content || []).map((c) => c.text || '').join('');
    const draft = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const problems = validateAiDraft(draft, facts, newsIn);
    if (problems.length) { log('warn', 'AI draft rejected by grounding checks', { problems }); return { rejected: true, problems }; }
    for (const it of draft.items) {
      it.sources = dedupeSources([...(it.factIds || []).flatMap((id) => facts.find((f) => f.id === id)?.sources || []), ...(it.newsIds || []).map((id) => { const n = newsIn.find((x) => x.id === id); return n && { label: n.publisher, url: n.link }; })]);
      it.origin = 'ai-drafted';
    }
    return { items: draft.items, generator: `ai:${model}` };
  } catch (e) { log('warn', 'AI drafting failed', { error: String(e.message || e) }); return null; }
}

/* ---------------- workflow ---------------- */
const FILE = 'briefings.json';
const all = () => readJson(FILE, []);
const save = (list) => writeJson(FILE, list.slice(-200));

async function generate(snap, { mode = 'daily', useAi = true } = {}) {
  const facts = detectFacts(snap);
  const base = deterministicDraft(snap, facts, mode);
  let ai = useAi ? await aiPolish(snap, facts, mode) : null;
  const rec = {
    id: crypto.randomUUID(), mode, status: 'draft', createdAt: new Date().toISOString(), createdAtLabel: sgtLabel(),
    snapshotAt: snap.generatedAt, items: ai && !ai.rejected ? ai.items : base.items, whatToWatch: base.whatToWatch,
    generator: ai && !ai.rejected ? ai.generator : 'deterministic', aiRejected: ai?.rejected ? ai.problems : undefined,
    facts, history: [{ at: new Date().toISOString(), action: 'generated' }],
  };
  const list = all(); list.push(rec); save(list);
  return rec;
}

function update(id, patch, reviewer) {
  const list = all();
  const rec = list.find((b) => b.id === id);
  if (!rec) throw new Error('Briefing not found');
  if (rec.status === 'approved' && patch.items) throw new Error('Approved briefings are locked. Generate a new draft to make changes.');
  if (patch.items) {
    rec.items = patch.items;
    const nums = rec.facts.flatMap((f) => f.numbers);
    rec.warnings = patch.items.flatMap((it, i) => { const b = ungroundedNumbers(`${it.what} ${it.why}`, nums); return b.length ? [`Item ${i + 1}: check numbers not found in data (${b.join(', ')})`] : []; });
    rec.history.push({ at: new Date().toISOString(), action: 'edited', by: reviewer });
  }
  if (patch.status === 'approved') {
    if (!reviewer) throw new Error('Reviewer name is required to approve');
    for (const b of list) if (b.mode === rec.mode && b.status === 'approved' && b.id !== id) b.status = 'superseded';
    Object.assign(rec, { status: 'approved', approvedBy: reviewer, approvedAt: new Date().toISOString() });
    rec.history.push({ at: rec.approvedAt, action: 'approved', by: reviewer });
  } else if (patch.status === 'rejected' || patch.status === 'withdrawn') {
    rec.status = patch.status;
    rec.history.push({ at: new Date().toISOString(), action: patch.status, by: reviewer });
  }
  save(list);
  return rec;
}

/** Latest approved briefing of a mode, stripped of internal fields. */
function currentPublished(mode = 'daily') {
  const b = all().filter((x) => x.mode === mode && x.status === 'approved').sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))[0];
  if (!b) return null;
  const { facts, history, aiRejected, warnings, ...pub } = b;
  return pub;
}

/** Plain-text summary for WhatsApp (the RM pastes or forwards it). */
function shareText(b, url, snap) {
  const lines = [`*IPCG Global Markets — ${b.mode === 'weekly' ? 'Weekly Review' : 'Daily Briefing'}*`, `${sgtLabel(new Date(b.approvedAt || b.createdAt))}`, ''];
  for (const it of b.items.slice(0, 4)) lines.push(`• *${it.headline}*: ${it.what}`);
  if (b.whatToWatch?.length) { lines.push('', '*What to watch*'); for (const w of b.whatToWatch.slice(0, 3)) lines.push(`• ${dateLabel(w.date)} — ${w.event}`); }
  lines.push('', `Full dashboard: ${url}`, '', '_General market information only; not a recommendation. Data may be delayed._');
  return lines.join('\n');
}

module.exports = { detectFacts, deterministicDraft, validateAiDraft, aiPolish, dedupeSources, generate, update, currentPublished, shareText, whatToWatch, all, THRESHOLDS, UNSAFE };
