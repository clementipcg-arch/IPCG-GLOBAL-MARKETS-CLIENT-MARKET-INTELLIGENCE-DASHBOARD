'use strict';
// Runs when a briefing pull request is MERGED: records the approval (who, when, which PR) and
// writes briefings/published/<mode>.json, which the static build shows to clients.
const fs = require('fs');
const path = require('path');
const { fromMarkdown } = require('./briefing-md');

const ROOT = path.join(__dirname, '..');
const ref = process.env.HEAD_REF || '';
const mode = /weekly/.test(ref) ? 'weekly' : 'daily';
const approvedBy = process.env.MERGED_BY;
const approvedAt = process.env.MERGED_AT || new Date().toISOString();
if (!approvedBy) { console.error('MERGED_BY missing; refusing to publish without a named approver'); process.exit(1); }

const md = fs.readFileSync(path.join(ROOT, `briefings/drafts/${mode}.md`), 'utf8');
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, `briefings/drafts/${mode}.facts.json`), 'utf8'));
const items = fromMarkdown(md);
if (!items.length) { console.error('No briefing items found in the draft'); process.exit(1); }

const rec = {
  mode, status: 'approved', approvedBy: (() => { try { return JSON.parse(process.env.APPROVER_NAMES || '{}')[approvedBy] || approvedBy; } catch { return approvedBy; } })(), approvedAt, prUrl: process.env.PR_URL || null,
  createdAt: meta.createdAt, snapshotAt: meta.snapshotAt, generator: meta.generator, items, whatToWatch: meta.whatToWatch,
};
fs.mkdirSync(path.join(ROOT, 'briefings/published'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `briefings/published/${mode}.json`), JSON.stringify(rec, null, 2));
fs.appendFileSync(path.join(ROOT, 'briefings/published/history.jsonl'), JSON.stringify({ mode, approvedBy: rec.approvedBy, approvedAt, prUrl: rec.prUrl, items: items.map((i) => i.headline) }) + '\n');
console.log(`published ${mode} briefing approved by ${rec.approvedBy} at ${approvedAt}`);
