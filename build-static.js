'use strict';
/**
 * Free-hosting build (GitHub Actions + Cloudflare Pages).
 * Fetches all data server-side with the same adapters the Node server uses, adds the latest APPROVED
 * briefing, and writes a static site to dist/site. API keys stay in GitHub Secrets; they never reach the site.
 * Usage: PUBLIC_URL=https://... FRED_API_KEY=... node scripts/build-static.js
 */
const fs = require('fs');
const path = require('path');
const { buildSnapshot } = require('../server/services/snapshot');
const briefing = require('../server/services/briefing');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist/site');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const SCHEDULE = process.env.UPDATE_SCHEDULE_LABEL || '06:30, 12:30 and 18:30 SGT';
const MAX_AGE_DAYS = { daily: 4, weekly: 9 }; // an old briefing is hidden rather than shown as current

function published(mode) {
  const f = path.join(ROOT, `briefings/published/${mode}.json`);
  if (!fs.existsSync(f)) return null;
  const b = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (b.status !== 'approved' || !b.approvedBy) return null;
  if ((Date.now() - new Date(b.approvedAt).getTime()) / 864e5 > MAX_AGE_DAYS[mode]) return null;
  return b;
}

(async () => {
  const snap = await buildSnapshot({ audience: 'client' });
  snap.environment = 'production';
  snap.briefing = { daily: published('daily'), weekly: published('weekly') };
  snap.whatToWatch = briefing.whatToWatch(snap);
  snap.publicUrl = PUBLIC_URL ? PUBLIC_URL + '/' : null;
  snap.staticBuild = { schedule: SCHEDULE, builtAt: new Date().toISOString() };

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of ['app.css', 'app.js', 'favicon.svg', 'og-image.png']) fs.copyFileSync(path.join(ROOT, 'public', f), path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, 'snapshot.json'), JSON.stringify(snap));

  const og = [
    ['og:type', 'website'], ['og:site_name', 'IPCG Global Markets'], ['og:title', 'IPCG Global Markets | Daily Market Intelligence'],
    ['og:description', 'A curated daily view of global markets, interest rates, fixed income, commodities and key financial developments from IPCG.'],
    ...(PUBLIC_URL ? [['og:url', PUBLIC_URL + '/'], ['og:image', PUBLIC_URL + '/og-image.png'], ['og:image:width', '1200'], ['og:image:height', '630']] : []),
  ].map(([p, c]) => `<meta property="${p}" content="${c}">`).join('\n') + '\n<meta name="twitter:card" content="summary_large_image">\n<meta name="ipcg-data" content="snapshot.json">';
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8').replace('<!--OG-->', og).replace(/href="\//g, 'href="').replace(/src="\//g, 'src="');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);

  // Cloudflare Pages headers: security + caching (snapshot must never be cached stale)
  fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  X-Robots-Tag: noindex
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'
/snapshot.json
  Cache-Control: no-cache, must-revalidate
/index.html
  Cache-Control: no-cache
`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

  const st = Object.values(snap.series).reduce((a, o) => ((a[o.status] = (a[o.status] || 0) + 1), a), {});
  const failing = (snap.health || []).filter((h) => h.status === 'error').map((h) => h.provider);
  const summary = `### Dashboard build\nSeries: ${JSON.stringify(st)}\nCurve: ${snap.curve.status} ${snap.curve.asOf || ''}\nNews items: ${snap.news.length}\nDaily briefing: ${snap.briefing.daily ? 'approved by ' + snap.briefing.daily.approvedBy : 'none published'}\n${failing.length ? 'Sources with errors: ' + failing.join(', ') : 'All configured sources OK'}`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  console.log(summary);
})().catch((e) => { console.error(e); process.exit(1); });
