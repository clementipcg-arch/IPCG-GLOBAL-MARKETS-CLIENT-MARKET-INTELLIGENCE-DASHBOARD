'use strict';
// Primary-source news: official RSS feeds from central banks and agencies, plus an optional
// licensed news API. Only headlines, short publisher descriptions and links are shown;
// full articles are never reproduced.
const { http, markHealth, cached } = require('../lib/infra');
const eodhd = require('./eodhd');
const { dedupeNews } = require('../lib/validate');

// priority: 1 = official primary source, 5 = licensed news wire.  verified = feed URL confirmed working.
const FEEDS = [
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'US', topics: ['Central banks'], priority: 1, verified: true },
  { name: 'European Central Bank', url: 'https://www.ecb.europa.eu/rss/press.html', region: 'Europe', topics: ['Central banks'], priority: 1 },
  { name: 'Bank of England', url: 'https://www.bankofengland.co.uk/rss/news', region: 'Europe', topics: ['Central banks'], priority: 1 },
  { name: 'Bank of Japan', url: 'https://www.boj.or.jp/en/rss/whatsnew.xml', region: 'Japan', topics: ['Central banks'], priority: 1 },
  { name: 'Hong Kong Monetary Authority', url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml', region: 'Hong Kong', topics: ['Central banks'], priority: 1 },
];

const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

/** Parse RSS 2.0 or Atom into {title, link, publishedAt, summary}. */
function parseFeed(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return items.map((b) => {
    let link = tag(b, 'link');
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const date = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date');
    const d = new Date(date);
    const summary = tag(b, 'description') || tag(b, 'summary');
    return { title: tag(b, 'title'), link, publishedAt: isNaN(d) ? null : d.toISOString(), summary: summary.length > 280 ? summary.slice(0, 277) + '…' : summary };
  }).filter((i) => i.title && i.link);
}

// Keyword tagging for filters. Deterministic and auditable; adjust as needed.
const RULES = [
  [/\b(fomc|federal reserve|fed\b|powell|warsh|treasury|payroll|cpi|pce|us\b|u\.s\.|wall street|s&p|nasdaq|dow)\b/i, 'region', 'US'],
  [/\b(ecb|euro|eurozone|bund|germany|france|stoxx|dax|bank of england|uk\b|gilt|ftse|britain)\b/i, 'region', 'Europe'],
  [/\b(china|chinese|pboc|yuan|renminbi|shanghai|csi|beijing)\b/i, 'region', 'China'],
  [/\b(hong kong|hkma|hang seng|hkd)\b/i, 'region', 'Hong Kong'],
  [/\b(japan|boj|bank of japan|yen|nikkei|jgb|tokyo)\b/i, 'region', 'Japan'],
  [/\b(taiwan|taiex|tsmc|twd|taipei)\b/i, 'region', 'Taiwan'],
  [/\b(korea|kospi|india|singapore|australia|asean|asia)\b/i, 'region', 'Asia'],
  [/\b(rate|monetary|central bank|inflation|gdp|employment|policy)\b/i, 'topic', 'Central banks & macro'],
  [/\b(bond|yield|credit|spread|issuance|rating|default|at1|coco|debt|capital)\b/i, 'topic', 'Fixed income & credit'],
  [/\b(stock|shares|equit|earnings|index|ipo)\b/i, 'topic', 'Equities'],
  [/\b(oil|brent|wti|gold|copper|gas|commodit|dollar|currency|fx)\b/i, 'topic', 'Commodities & FX'],
  [/\b(tariff|trade|sanction|war|attack|geopolit|election|conflict)\b/i, 'topic', 'Geopolitics & trade'],
];
function classify(item, defaults = {}) {
  const text = `${item.title} ${item.summary || ''}`;
  const regions = new Set(defaults.region ? [defaults.region] : []);
  const topics = new Set(defaults.topics || []);
  for (const [re, kind, label] of RULES) if (re.test(text)) (kind === 'region' ? regions : topics).add(label);
  if (topics.has('Central banks')) { topics.delete('Central banks'); topics.add('Central banks & macro'); }
  return { ...item, regions: [...regions], topics: [...topics] };
}

async function officialFeeds() {
  const results = await Promise.allSettled(FEEDS.map((f) => cached(`rss:${f.url}`, 10 * 60 * 1000, async () => {
    try {
      const items = parseFeed(await (await http(f.url, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } })).text()).slice(0, 15);
      markHealth(`RSS: ${f.name}`, true, `${items.length} items`);
      return items.map((i) => classify({ ...i, publisher: f.name, priority: f.priority, primary: true }, { region: f.region, topics: f.topics }));
    } catch (e) { markHealth(`RSS: ${f.name}`, false, String(e.message || e)); throw e; }
  })));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

/** All news, deduplicated, newest first. */
async function allNews() {
  const official = await officialFeeds();
  let licensed = [];
  if (eodhd.configured()) {
    for (const t of (process.env.NEWS_TAGS || 'federal reserve,treasury yields,china economy,taiwan,bank of japan,oil prices,corporate bonds').split(',')) {
      try { licensed = licensed.concat(((await eodhd.news({ tag: t.trim(), limit: 10 })) || []).map((n) => classify(n))); } catch { /* health already marked */ }
    }
  }
  return dedupeNews([...official, ...licensed]).slice(0, 80);
}

module.exports = { allNews, parseFeed, classify, FEEDS };
