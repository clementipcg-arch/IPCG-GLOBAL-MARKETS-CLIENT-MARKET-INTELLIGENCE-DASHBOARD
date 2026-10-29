'use strict';
// Logging, provider health, TTL cache with last-good fallback, resilient HTTP, JSON file store.
const fs = require('fs');
const path = require('path');

/* ---------------- logging ---------------- */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || 20;
function log(level, msg, extra = {}) {
  if ((LEVELS[level] || 20) < minLevel) return;
  // Structured JSON lines: easy to ship to any log drain (Render, Fly, Datadog, CloudWatch).
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }) + '\n');
}

/* ---------------- provider health ---------------- */
const health = new Map(); // provider -> {provider, status, lastSuccess, lastError, message, configured}
function markHealth(provider, ok, message = '', configured = true) {
  const h = health.get(provider) || { provider, configured, failures: 0 };
  h.configured = configured;
  if (ok) { h.status = 'ok'; h.lastSuccess = new Date().toISOString(); h.message = message; h.failures = 0; }
  else { h.status = configured ? 'error' : 'not-configured'; h.lastError = new Date().toISOString(); h.message = message; h.failures = (h.failures || 0) + (configured ? 1 : 0); }
  health.set(provider, h);
  if (!ok && configured) log('warn', 'provider failure', { provider, message });
  if (h.failures >= 3) alertFailure(h);
}
function healthReport() { return [...health.values()]; }

let lastAlert = 0;
/** Optional alert webhook (Slack/Teams/any JSON endpoint) for material data-source failures. */
async function alertFailure(h) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || Date.now() - lastAlert < 30 * 60 * 1000) return;
  lastAlert = Date.now();
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `IPCG Global Markets: provider ${h.provider} failing (${h.failures}x): ${h.message}` }) });
  } catch (e) { log('error', 'alert webhook failed', { error: String(e) }); }
}

/* ---------------- cache ---------------- */
// TTL cache that keeps the last good value so a failed refresh shows the last verified
// observation (with its own timestamp) instead of nothing - never a substituted value.
const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit && hit.pending) return hit.pending;
  const pending = (async () => {
    try {
      const value = await loader();
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      log('warn', 'cache loader failed', { key, error: String(e.message || e) });
      if (hit) { cache.set(key, { ...hit, pending: null }); return { ...hit.value, _servedFromCache: true, _cacheError: String(e.message || e) }; }
      throw e;
    }
  })();
  cache.set(key, { ...(hit || { at: 0 }), pending });
  return pending;
}
function clearCache() { cache.clear(); }

/* ---------------- HTTP ---------------- */
const hostNext = new Map(); // simple per-host spacing to respect rate limits
async function http(url, { timeoutMs = 12000, retries = 2, minIntervalMs = 250, headers = {}, method = 'GET', body } = {}) {
  const host = new URL(url).host;
  const wait = (hostNext.get(host) || 0) - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  hostNext.set(host, Date.now() + minIntervalMs);
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, body, headers: { 'user-agent': 'IPCG-Global-Markets/1.0 (+contact: ops@ipcg.example)', ...headers }, signal: ctl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${redact(url)}`);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (i < retries && (e.retry || e.name === 'AbortError' || e.cause)) await new Promise((r) => setTimeout(r, 600 * (i + 1) ** 2));
      else break;
    }
  }
  throw lastErr;
}
/** Never log API keys. */
function redact(url) { return String(url).replace(/(api_key|api_token|apikey|token|key)=[^&]+/gi, '$1=***'); }

/* ---------------- JSON store ---------------- */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); } catch { return fallback; }
}
function writeJson(name, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file); // atomic replace
}

module.exports = { log, markHealth, healthReport, cached, clearCache, http, redact, readJson, writeJson, DATA_DIR };
