'use strict';
// Converts briefing drafts to and from a reviewer-friendly Markdown file that can be edited in GitHub's web editor.

const HEADER = `<!--
  IPCG Global Markets - briefing draft for review.
  Edit the wording freely. Keep each item's "### " heading and the "What:", "Why it matters:",
  "Affected:" and "Sources:" labels. Every number must come from the facts listed in the pull request;
  the automatic check flags any number it cannot find. Merging the pull request publishes this briefing.
-->`;

function toMarkdown(draft) {
  const lines = [HEADER, '', `# ${draft.mode === 'weekly' ? 'Weekly Review' : 'Daily Briefing'}`, ''];
  for (const it of draft.items) {
    lines.push(`### ${it.headline}`, `What: ${it.what}`, `Why it matters: ${it.why || ''}`, `Affected: ${(it.affected || []).join(', ')}`,
      `Sources: ${(it.sources || []).map((s) => `${s.label} | ${s.url}`).join(' ;; ')}`, '');
  }
  return lines.join('\n');
}

function fromMarkdown(md) {
  const body = md.replace(/<!--[\s\S]*?-->/g, '');
  const blocks = body.split(/^### /m).slice(1);
  return blocks.map((b) => {
    const [headline, ...rest] = b.split('\n');
    const text = rest.join('\n');
    const field = (label) => {
      const m = text.match(new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=^\\w[\\w ]*:|$(?![\\s\\S]))`, 'm'));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };
    const sources = field('Sources').split(';;').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [label, url] = s.split('|').map((x) => x.trim());
      return { label, url };
    }).filter((s) => s.url && /^https?:\/\//.test(s.url));
    return { headline: headline.trim(), what: field('What'), why: field('Why it matters'), affected: field('Affected').split(',').map((s) => s.trim()).filter(Boolean), sources };
  }).filter((it) => it.headline && it.what);
}

module.exports = { toMarkdown, fromMarkdown };
