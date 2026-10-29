'use strict';
// Pull-request check: every number in the edited draft must appear in the facts the draft was built from,
// and no recommendation / certainty language is allowed. Exit code 1 turns the check red.
const fs = require('fs');
const path = require('path');
const { fromMarkdown } = require('./briefing-md');
const { ungroundedNumbers } = require('../server/lib/calc');
const { UNSAFE } = require('../server/services/briefing');

const ROOT = path.join(__dirname, '..');
let problems = [];
for (const mode of ['daily', 'weekly']) {
  const md = path.join(ROOT, `briefings/drafts/${mode}.md`), fj = path.join(ROOT, `briefings/drafts/${mode}.facts.json`);
  if (!fs.existsSync(md) || !fs.existsSync(fj)) continue;
  const items = fromMarkdown(fs.readFileSync(md, 'utf8'));
  const facts = JSON.parse(fs.readFileSync(fj, 'utf8')).facts || [];
  const nums = facts.flatMap((f) => f.numbers || []);
  if (!items.length) problems.push(`${mode}: no items could be read. Keep the "### " headings and the "What:" labels.`);
  if (items.length > 5) problems.push(`${mode}: ${items.length} items; keep it to 5 or fewer.`);
  items.forEach((it, i) => {
    const text = `${it.headline} ${it.what} ${it.why}`;
    const bad = ungroundedNumbers(text, nums);
    if (bad.length) problems.push(`${mode} item ${i + 1} ("${it.headline}"): numbers not found in the data: ${bad.join(', ')}. Check them against a cited source.`);
    if (UNSAFE.test(text)) problems.push(`${mode} item ${i + 1}: contains recommendation or certainty language ("${text.match(UNSAFE)[0]}").`);
    if (!it.sources.length) problems.push(`${mode} item ${i + 1}: no source link.`);
  });
}
const summary = problems.length ? `### Briefing check: needs attention\n${problems.map((p) => `- ${p}`).join('\n')}` : '### Briefing check passed\nAll numbers match the data and no recommendation language was found.';
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
console.log(summary);
process.exit(problems.length ? 1 : 0);
