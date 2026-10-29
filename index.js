'use strict';
// IPCG Global Markets – HTTP server (Node 18+, zero runtime dependencies).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildSnapshot } = require('./services/snapshot');
const briefing = require('./services/briefing');
const { log, healthReport, cached, clearCache } = require('./lib/infra');
const { isoDateIn, fmt } = require('./lib/time');

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SNAPSHOT_TTL = Number(process.env.SNAPSHOT_TTL_SECONDS || 120) * 1000;
const PUB = path.join(__dirname, '..', 'public');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  ...(PUBLIC_URL.startsWith('https') ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
};

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SECURITY_HEADERS, ...(isObj ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

/* ---- tiny per-IP rate limiter for the API ---- */
const hits = new Map();
function limited(ip, max = 120) {
  const now = Date.now(), w = hits.get(ip) || { n: 0, t: now };
  if (now - w.t > 60000) { w.n = 0; w.t = now; }
  w.n++; hits.set(ip, w);
  return w.n > max;
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return false;
  const h = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(h), b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 1e6) throw new Error('Body too large'); }
  return s ? JSON.parse(s) : {};
}

const clientSnapshot = () => cached('snapshot:client', SNAPSHOT_TTL, () => buildSnapshot({ audience: 'client' }));
const internalSnapshot = () => cached('snapshot:internal', SNAPSHOT_TTL, () => buildSnapshot({ audience: 'internal' }));

/** index.html with Open Graph tags for WhatsApp link previews. */
function indexHtml() {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const og = [
    ['og:type', 'website'], ['og:site_name', 'IPCG Global Markets'],
    ['og:title', 'IPCG Global Markets | Daily Market Intelligence'],
    ['og:description', 'A curated daily view of global markets, interest rates, fixed income, commodities and key financial developments from IPCG.'],
    ['og:url', PUBLIC_URL + '/'], ['og:image', PUBLIC_URL + '/og-image.png'], ['og:image:width', '1200'], ['og:image:height', '630'],
  ].map(([p, c]) => `<meta property="${p}" content="${c}">`).join('\n') + `\n<meta name="twitter:card" content="summary_large_image">\n<link rel="canonical" href="${PUBLIC_URL}/">`;
  return html.replace('<!--OG-->', og);
}

async function route(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  const p = url.pathname;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (p.startsWith('/api/') && limited(ip)) return send(res, 429, { error: 'Too many requests. Please wait a minute.' });

  // ---------- public API ----------
  if (p === '/api/snapshot' && req.method === 'GET') {
    if (url.searchParams.get('demo') === '1') {
      if (process.env.DEMO_MODE !== 'true') return send(res, 403, { error: 'Demonstration data is disabled in this environment.' });
      return send(res, 200, require('../scripts/demo-data').demoSnapshot(), { 'cache-control': 'no-store' });
    }
    const snap = await clientSnapshot();
    return send(res, 200, { ...snap, briefing: { daily: briefing.currentPublished('daily'), weekly: briefing.currentPublished('weekly') }, whatToWatch: briefing.whatToWatch(snap), publicUrl: PUBLIC_URL, demoAvailable: process.env.DEMO_MODE === 'true' }, { 'cache-control': 'public, max-age=60' });
  }
  if (p === '/api/share' && req.method === 'GET') {
    const mode = url.searchParams.get('mode') === 'weekly' ? 'weekly' : 'daily';
    const b = briefing.currentPublished(mode);
    if (!b) return send(res, 404, { error: 'No approved briefing yet.' });
    return send(res, 200, { text: briefing.shareText(b, PUBLIC_URL + '/', null) });
  }
  if (p === '/api/health') {
    const providers = healthReport();
    const failing = providers.filter((x) => x.status === 'error');
    return send(res, failing.length ? 207 : 200, { ok: !failing.length, time: new Date().toISOString(), providers });
  }

  // ---------- admin API (bearer token) ----------
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Admin token required.' });
    if (p === '/api/admin/snapshot') return send(res, 200, await internalSnapshot());
    if (p === '/api/admin/briefings' && req.method === 'GET') return send(res, 200, briefing.all().slice(-30).reverse());
    if (p === '/api/admin/briefings/generate' && req.method === 'POST') {
      const b = await body(req);
      clearCache();
      const rec = await briefing.generate(await clientSnapshot(), { mode: b.mode === 'weekly' ? 'weekly' : 'daily', useAi: b.useAi !== false });
      return send(res, 201, rec);
    }
    const m = p.match(/^\/api\/admin\/briefings\/([\w-]+)(\/share)?$/);
    if (m && req.method === 'PATCH') { const b = await body(req); return send(res, 200, briefing.update(m[1], b, b.reviewer)); }
    if (m && m[2] && req.method === 'GET') {
      const rec = briefing.all().find((x) => x.id === m[1]);
      return rec ? send(res, 200, { text: briefing.shareText(rec, PUBLIC_URL + '/') }) : send(res, 404, { error: 'Not found' });
    }
    return send(res, 404, { error: 'Unknown admin route' });
  }

  // ---------- pages & static ----------
  if (p === '/' || p === '/index.html') return send(res, 200, indexHtml(), { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
  if (p === '/admin') return send(res, 200, fs.readFileSync(path.join(PUB, 'admin.html')), { 'content-type': TYPES['.html'], 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  if (p === '/robots.txt') return send(res, 200, 'User-agent: *\nDisallow: /admin\nDisallow: /api/\n', { 'content-type': 'text/plain' });
  const file = path.normalize(path.join(PUB, p));
  if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
  }
  return send(res, 404, { error: 'Not found' });
}

/* ---------- scheduler: warm cache, prepare drafts (never auto-publish) ---------- */
let lastDraftKey = '';
function scheduler() {
  setInterval(() => clientSnapshot().catch((e) => log('error', 'snapshot refresh failed', { error: String(e) })), Number(process.env.SNAPSHOT_REFRESH_SECONDS || 300) * 1000);
  setInterval(async () => {
    const now = new Date();
    const hm = fmt(now, { hour: '2-digit', minute: '2-digit', hour12: false });
    const wd = fmt(now, { weekday: 'short' });
    const day = isoDateIn(now);
    const dailyAt = process.env.DAILY_DRAFT_TIME_SGT || '07:00', weeklyAt = process.env.WEEKLY_DRAFT_TIME_SGT || '08:00';
    try {
      if (hm === dailyAt && !['Sat', 'Sun'].includes(wd) && lastDraftKey !== 'd' + day) { lastDraftKey = 'd' + day; clearCache(); await briefing.generate(await clientSnapshot(), { mode: 'daily' }); log('info', 'daily draft prepared for review'); }
      if (hm === weeklyAt && wd === 'Sat' && lastDraftKey !== 'w' + day) { lastDraftKey = 'w' + day; await briefing.generate(await clientSnapshot(), { mode: 'weekly' }); log('info', 'weekly draft prepared for review'); }
    } catch (e) { log('error', 'scheduled draft failed', { error: String(e) }); }
  }, 30 * 1000);
}

if (require.main === module) {
  http.createServer((req, res) => route(req, res).catch((e) => { log('error', 'request failed', { url: req.url, error: String(e.stack || e) }); send(res, 500, { error: 'Something went wrong. Please try again shortly.' }); }))
    .listen(PORT, () => { log('info', 'IPCG Global Markets listening', { port: PORT, publicUrl: PUBLIC_URL, adminEnabled: Boolean(ADMIN_TOKEN) }); scheduler(); clientSnapshot().catch(() => {}); });
}

module.exports = { route };
