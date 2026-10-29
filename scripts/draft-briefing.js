'use strict';
/**
 * Scheduled job (GitHub Actions): prepare a briefing DRAFT for human review.
 * Writes briefings/drafts/<mode>.md (editable) and briefings/drafts/<mode>.facts.json (audit trail),
 * plus dist/pr-body.md used as the pull-request description. Never publishes anything.
 * Usage: node scripts/draft-briefing.js daily|weekly
 */
const fs = require('fs');
const path = require('path');
const { buildSnapshot } = require('../server/services/snapshot');
const briefing = require('../server/services/briefing');
const { toMarkdown } = require('./briefing-md');
const { sgtLabel } = require('../server/lib/time');

(async () => {
  const mode = process.argv[2] === 'weekly' ? 'weekly' : 'daily';
  const ROOT = path.join(__dirname, '..');
  const snap = await buildSnapshot({ audience: 'client' });
  const facts = briefing.detectFacts(snap);
  const base = briefing.deterministicDraft(snap, facts, mode);
  let draft = base, generator = 'deterministic', aiProblems = null;
  const ai = await briefing.aiPolish(snap, facts, mode);
  if (ai && !ai.rejected) { draft = { ...base, items: ai.items }; generator = ai.generator; }
  else if (ai && ai.rejected) aiProblems = ai.problems;

  fs.mkdirSync(path.join(ROOT, 'briefings/drafts'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `briefings/drafts/${mode}.md`), toMarkdown({ ...draft, mode }));
  const meta = { mode, createdAt: new Date().toISOString(), createdAtLabel: sgtLabel(), snapshotAt: snap.generatedAt, generator, aiProblems, whatToWatch: base.whatToWatch, facts, health: snap.health };
  fs.writeFileSync(path.join(ROOT, `briefings/drafts/${mode}.facts.json`), JSON.stringify(meta, null, 2));

  const failing = (snap.health || []).filter((h) => h.status === 'error');
  const body = [
    `**${mode === 'weekly' ? 'Weekly Review' : 'Daily Briefing'} draft — prepared ${sgtLabel()}**`,
    '',
    'Nothing is published until this pull request is merged. To review:',
    '1. Open **Files changed**, click the `…` on `briefings/drafts/' + mode + '.md` and choose **Edit file** to change the wording. Commit to this branch.',
    '2. Wait for the **Briefing check** to turn green (it flags numbers not found in the data, and recommendation or certainty language).',
    '3. Click **Merge pull request**. Your GitHub name and the time are recorded as the approval, and the dashboard republishes within a few minutes.',
    '4. To discard, click **Close pull request**.',
    '',
    `Generator: \`${generator}\`${aiProblems ? ` (AI draft discarded by grounding checks: ${aiProblems.join('; ')})` : ''}. Data snapshot: ${snap.generatedAt}.`,
    failing.length ? `\n> ⚠️ Data sources with errors: ${failing.map((h) => h.provider).join(', ')}` : '',
    '',
    '### Facts available to cite',
    ...facts.map((f) => `- **${f.id}** ${f.text} _(${f.sources.map((s) => s.label).join(', ')})_`),
    '',
    '### What to watch (from official schedules)',
    ...(base.whatToWatch.length ? base.whatToWatch.map((w) => `- ${w.date} — ${w.event}`) : ['- none in the next 7 days']),
  ].join('\n');
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist/pr-body.md'), body);
  console.log(`draft written: ${mode}, ${draft.items.length} items, ${facts.length} facts, generator ${generator}`);
})().catch((e) => { console.error(e); process.exit(1); });
