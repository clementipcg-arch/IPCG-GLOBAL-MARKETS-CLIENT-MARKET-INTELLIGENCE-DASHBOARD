/* IPCG Global Markets — client application (vanilla JS, no dependencies).
   Data comes from /api/snapshot (production) or from an embedded snapshot (window.__IPCG_PREVIEW__)
   in the static review copy. The UI never fabricates values: anything missing renders as
   "Data temporarily unavailable" or a licence/connection notice. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ i18n */
  const T = {
    en: {
      sub: 'Global Market Intelligence', overview: 'Overview', equities: 'Equities', rates: 'Rates', markets: 'FX & Cmdty', news: 'News', calendar: 'Calendar',
      overviewLong: 'Market Overview', equitiesLong: 'Global Equities', ratesLong: 'Rates & Fixed Income', marketsLong: 'Commodities & FX', newsLong: 'Latest Market News', calendarLong: 'Economic Calendar',
      daily: 'Daily Briefing', weekly: 'Weekly Review', refresh: 'Refresh', updated: 'Page updated', refreshed: 'Data refreshed', dataAsOf: 'Market data', sgtNow: 'Singapore',
      brief: "Today's briefing", watch: 'What to watch', why: 'Why it matters', affects: 'Affects', sources: 'Sources',
      snapshot: 'Global market snapshot', key: 'Key indicators', day: '1D', week: '1W', mtd: 'MTD',
      copyLink: 'Copy link', shareBrief: "Share today's briefing", copied: 'Copied', close: 'Close',
      unavailable: 'Data temporarily unavailable', notConnected: 'Licensed data feed not connected', restricted: 'Licence required for client display',
      prevClose: 'Previous close', observed: 'Observation', source: 'Source', series: 'Series', retrieved: 'Retrieved', latency: 'Data type', method: 'Method',
      curve: 'US Treasury yield curve', compareWith: 'Compare with', prevDay: 'Previous day', oneWeek: '1 week earlier', oneMonth: '1 month earlier',
      spreads: 'Key spreads', sovereigns: 'Global sovereign yields', policy: 'Policy rates', credit: 'Credit markets', fiNews: 'Fixed-income developments', explainers: 'Bond terms explained',
      movers: 'Top movers', gainers: 'Gainers', losers: 'Losers', sectors: 'Sector performance', context: 'Regional developments', allSectors: 'All sectors',
      commodities: 'Commodities', fx: 'Foreign exchange', region: 'Region', topic: 'Topic', period: 'Period', all: 'All', h24: '24 hours', d7: '7 days', d30: '30 days',
      readMore: 'Read summary', openSource: 'Open original source', primary: 'Primary source', noNews: 'No stories match these filters.',
      prev: 'Previous', cons: 'Consensus', actual: 'Actual', na: 'Not available', importance: 'Importance', high: 'High', medium: 'Medium',
      about: 'About this data', disclaimer: 'Market information is provided for general informational purposes only. It may be delayed, incomplete or subject to revision, and is not, by itself, a personalised recommendation or an offer to buy or sell any financial instrument. Past performance is not indicative of future results.',
      brandNote: 'Provisional styling pending official IPCG brand assets.', textSize: 'Text size', lang: '中文',
      pending: 'Today’s briefing is being prepared and reviewed by the IPCG investment team.', aiNote: 'Drafted with AI assistance from the cited data and sources, then reviewed by IPCG.', dataNote: 'Compiled automatically from the cited data.',
    },
    zh: {
      sub: '全球市場情報', overview: '總覽', equities: '股市', rates: '利率', markets: '匯率商品', news: '新聞', calendar: '行事曆',
      overviewLong: '市場總覽', equitiesLong: '全球股市', ratesLong: '利率與固定收益', marketsLong: '商品與外匯', newsLong: '最新市場新聞', calendarLong: '經濟行事曆',
      daily: '每日簡報', weekly: '每週回顧', refresh: '重新整理', updated: '頁面更新', refreshed: '數據更新', dataAsOf: '市場數據', sgtNow: '新加坡',
      brief: '今日簡報', watch: '關注焦點', why: '重要性', affects: '影響', sources: '資料來源',
      snapshot: '全球市場概況', key: '關鍵指標', day: '1日', week: '1週', mtd: '月初至今',
      copyLink: '複製連結', shareBrief: '分享今日簡報', copied: '已複製', close: '關閉',
      unavailable: '數據暫時無法取得', notConnected: '尚未連接授權數據源', restricted: '需取得授權方可向客戶顯示',
      prevClose: '前收盤', observed: '觀測時間', source: '來源', series: '數列', retrieved: '擷取時間', latency: '數據類型', method: '方法',
      curve: '美國公債殖利率曲線', compareWith: '比較', prevDay: '前一交易日', oneWeek: '一週前', oneMonth: '一個月前',
      spreads: '主要利差', sovereigns: '全球主權債殖利率', policy: '政策利率', credit: '信用市場', fiNews: '固定收益動態', explainers: '債券名詞解釋',
      movers: '漲跌幅排行', gainers: '漲幅', losers: '跌幅', sectors: '產業表現', context: '區域動態', allSectors: '全部產業',
      commodities: '商品', fx: '外匯', region: '地區', topic: '主題', period: '期間', all: '全部', h24: '24小時', d7: '7天', d30: '30天',
      readMore: '閱讀摘要', openSource: '開啟原始來源', primary: '一手來源', noNews: '沒有符合篩選條件的新聞。',
      prev: '前值', cons: '市場預期', actual: '實際值', na: '無資料', importance: '重要性', high: '高', medium: '中',
      about: '數據說明', disclaimer: '本頁市場資訊僅供一般參考，可能有延遲、不完整或日後修正，其本身並不構成個人化投資建議，亦非買賣任何金融工具之要約。過往表現不代表未來結果。',
      brandNote: '暫用品牌樣式，待IPCG正式品牌素材提供後更新。', textSize: '字體大小', lang: 'EN',
      pending: 'IPCG投資團隊正在準備並審閱今日簡報。', aiNote: '依據所列數據與來源由AI協助撰寫，並經IPCG審閱。', dataNote: '依據所列數據自動彙整。',
    },
  };

  /* ------------------------------------------------------------------ state */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ipcg.' + k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ipcg.' + k, v); } catch { /* storage unavailable */ } },
  };
  const VIEWS = ['overview', 'equities', 'rates', 'markets', 'news', 'calendar'];
  const S = {
    snap: null, loadedAt: null, error: null, lang: store.get('lang', 'en'), large: store.get('large', '0') === '1',
    mode: 'daily', idxRegion: 'US', period: 'day', compare: 'prevDay', eqRegion: 'US', sector: 'all',
    newsRegion: 'all', newsTopic: 'all', newsPeriod: 'd30', open: new Set(), demo: false, tip: null,
  };
  const PREVIEW = window.__IPCG_PREVIEW__ || null;
  const STATIC_DATA = (document.querySelector('meta[name="ipcg-data"]') || {}).content || null;
  const t = (k) => (T[S.lang] && T[S.lang][k]) || T.en[k] || k;
  const view = () => (VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');

  /* ------------------------------------------------------------------ format */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtN = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const signed = (v, d = 2, suf = '') => (v === null || v === undefined || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + fmtN(Math.abs(v), d) + suf);
  const dir = (v) => (v === null || v === undefined || !isFinite(v) ? 'na' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
  const word = (v) => (v > 0 ? 'Up' : v < 0 ? 'Down' : 'Unchanged');
  const locale = () => (S.lang === 'zh' ? 'zh-TW' : 'en-GB');
  const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => (iso ? new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString(locale(), { timeZone: String(iso).length === 10 ? 'UTC' : 'Asia/Singapore', ...opts }) : '—');
  const fmtSgt = (ts) => (ts ? new Date(ts).toLocaleString(locale(), { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' SGT' : '—');
  const name = (o) => (S.lang === 'zh' && o.zh ? o.zh : o.label);

  function changeOf(o, period = 'day') {
    const isY = o.kind === 'yieldPct' || o.kind === 'spreadPct';
    if (period !== 'day') {
      const p = o.periods && o.periods[period];
      if (!p || p.change === null || p.change === undefined) return { v: null, txt: '—', isY, ref: null };
      return { v: p.change, txt: isY ? signed(p.change, Number.isInteger(p.change) ? 0 : 1, ' bp') : signed(p.change, 2, '%'), isY, ref: p.ref };
    }
    if (isY) return { v: o.changeBp, txt: signed(o.changeBp, Number.isInteger(o.changeBp) ? 0 : 1, ' bp'), isY, ref: o.prevDate };
    return { v: o.changePct, txt: signed(o.changePct, o.pctDecimals ?? 2, '%'), isY, ref: o.prevDate };
  }
  function valueTxt(o) {
    if (o.kind === 'yieldPct') return fmtN(o.value, o.decimals ?? 2) + '%';
    if (o.kind === 'spreadPct') return fmtN(o.value * 100, 0) + ' bp';
    return fmtN(o.value, o.decimals ?? 2);
  }
  const LAT = { 'end-of-day': 'End of day', delayed: 'Delayed', 'real-time': 'Real time', weekly: 'Daily data, published weekly', reported: 'Reported in news' };
  function obsLine(o) {
    if (o.status === 'unavailable') return o.reason || t('unavailable');
    if (o.status === 'restricted') return t('restricted');
    const when = o.obsTime ? fmtSgt(o.obsTime) : fmtDate(o.obsDate);
    if (o.method === 'reported') return `${when} close · via ${o.reportedBy || 'news report'}`;
    if (o.latency === 'weekly') return `${when} · weekly release`;
    if (o.latency === 'end-of-day') return `${when} close`;
    return `${when} · ${LAT[o.latency] || o.latency || ''}`;
  }
  function statusPill(o) {
    if (S.demo) return '<span class="pill warn">Simulated</span>';
    if (o.status === 'unavailable') return '<span class="pill neutral">Unavailable</span>';
    if (o.status === 'restricted') return '<span class="pill neutral">Licence required</span>';
    if (o.internalOnly) return '<span class="pill gold">Internal only</span>';
    if (o.status === 'stale') return '<span class="pill bad">Stale</span>';
    if (o.status === 'check') return '<span class="pill warn">Under review</span>';
    if (o.status === 'lagged') return '<span class="pill warn">Lagged</span>';
    if (o.method === 'reported') return '<span class="pill neutral">Reported</span>';
    return '';
  }

  /* ------------------------------------------------------------------ icons */
  const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    overview: ic('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>'),
    equities: ic('<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>'),
    rates: ic('<path d="M4 18c3-8 9-11 16-12"/><path d="M4 21h16"/>'),
    markets: ic('<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>'),
    news: ic('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
    calendar: ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    refresh: ic('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
    link: ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    share: ic('<path d="M4 12v7h16v-7"/><path d="M12 3v12M7 8l5-5 5 5"/>'),
    text: ic('<path d="M4 18 9 6l5 12M6 14h6"/><path d="M15 18l3-7 3 7M16 16h4"/>'),
  };

  /* ------------------------------------------------------------------ data */
  async function load(force) {
    S.error = null;
    if (PREVIEW) {
      S.snap = S.demo ? PREVIEW.demo : PREVIEW.live;
      S.loadedAt = new Date().toISOString();
      if (force) toast(S.demo ? 'Simulated layout data reloaded.' : 'This review copy holds a fixed snapshot. Live refresh runs on the deployed server.');
      return render();
    }
    try {
      // Static hosting (GitHub Actions + Cloudflare Pages) publishes snapshot.json; the Node server serves /api/snapshot.
      const url = STATIC_DATA ? STATIC_DATA + '?t=' + Date.now() : '/api/snapshot' + (S.demo ? '?demo=1' : '');
      const r = await fetch(url, { cache: force || STATIC_DATA ? 'no-store' : 'default' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
      S.snap = await r.json();
      S.loadedAt = STATIC_DATA ? S.snap.generatedAt : new Date().toISOString();
      if (force) toast(STATIC_DATA ? `Showing the latest update, prepared ${fmtSgt(S.snap.generatedAt)}. ${S.snap.staticBuild && S.snap.staticBuild.schedule ? 'Updates are published at ' + S.snap.staticBuild.schedule + '.' : ''}` : 'Updated ' + fmtSgt(S.loadedAt));
    } catch (e) {
      S.error = 'We could not reach the market data service. ' + (S.snap ? 'Showing the last successful update.' : 'Please try again shortly.');
    }
    render();
  }
  const ser = (id) => (S.snap && S.snap.series && S.snap.series[id]) || null;

  /* ------------------------------------------------------------------ shell */
  function freshness() {
    const s = S.snap;
    if (!s) return '';
    if (S.demo || s.environment === 'demo') return '<span class="fresh"><span class="dot demo"></span>Simulated data — not market information</span>';
    const failing = (s.health || []).filter((h) => h.status === 'error').length;
    const curve = s.curve && s.curve.asOf ? `US Treasuries ${fmtDate(s.curve.asOf)} close` : '';
    const cls = failing ? 'warn' : '';
    return `<span class="fresh"><span class="dot ${cls}"></span>${t('dataAsOf')}: ${esc(curve || 'see each figure')}</span>${failing ? `<span>${failing} source${failing > 1 ? 's' : ''} delayed</span>` : ''}`;
  }

  function shell(inner) {
    const v = view();
    const navItems = VIEWS.map((k) => `<li><a href="#${k}" ${k === v ? 'aria-current="page"' : ''}>${ICON[k]}<span>${esc(t(k))}</span></a></li>`).join('');
    const tabItems = VIEWS.map((k) => `<li><a href="#${k}" ${k === v ? 'aria-current="page"' : ''}>${esc(k === 'rates' || k === 'markets' ? t(k + 'Long') : t(k === 'markets' ? 'markets' : k))}</a></li>`).join('');
    const now = new Date();
    const banner = S.demo || (S.snap && S.snap.environment === 'demo')
      ? `<div class="banner demo"><div class="wrap">SIMULATED DATA — layout demonstration only. These figures are generated and are not market information. <button class="linkish" data-act="demo-off" style="all:unset;cursor:pointer;text-decoration:underline">Return to verified data</button></div></div>`
      : PREVIEW ? `<div class="banner preview"><div class="wrap"><b>Review copy.</b> Figures are a fixed snapshot of verified sources retrieved ${esc(fmtSgt(PREVIEW.live.generatedAt))}. Sections that need a licensed feed are marked. Not for client distribution.</div></div>` : '';
    return `
      <header class="mast">
        <div class="wrap">
          <div class="mast-top">
            <a class="brand" href="#overview" aria-label="IPCG Global Markets home">
              <span class="mono" aria-hidden="true">IPCG</span>
              <span class="brand-text"><span class="brand-title">IPCG Global Markets</span><br><span class="brand-sub">${esc(t('sub'))}</span></span>
            </a>
            <div class="mast-tools">
              <button class="tool" data-act="lang" aria-label="Change language">${esc(t('lang'))}</button>
              <button class="tool" data-act="size" aria-pressed="${S.large}" aria-label="${esc(t('textSize'))}">${ICON.text}</button>
              <button class="tool" data-act="refresh" aria-label="${esc(t('refresh'))}">${ICON.refresh}</button>
            </div>
          </div>
          <div class="mast-meta">
            <span>${esc(t('sgtNow'))} <span class="num" id="clock">${esc(now.toLocaleString(locale(), { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }))}</span> SGT</span>
            ${freshness()}
            <span>${esc(STATIC_DATA ? t('refreshed') : t('updated'))} <span class="num">${esc(S.loadedAt ? fmtSgt(S.loadedAt).replace(' SGT', '') : '—')}</span></span>
          </div>
        </div>
        <nav class="tabs" aria-label="Sections"><ul>${tabItems}</ul></nav>
      </header>
      ${banner}
      ${S.error ? `<div class="banner preview"><div class="wrap">${esc(S.error)}</div></div>` : ''}
      <main id="main"><div class="wrap">${inner}${footer()}</div></main>
      <nav class="bottom-nav" aria-label="Sections"><ul>${navItems}</ul></nav>`;
  }

  function footer() {
    return `<footer class="disclaimer">
      <p>${esc(t('disclaimer'))}</p>
      <p>Prices and yields carry their own observation times; markets close at different hours, and figures marked “close” are from the latest completed session. Commentary marked as compiled or AI-assisted is generated from the cited sources and reviewed by IPCG before publication.</p>
      <p><button class="linkish" data-act="about">${esc(t('about'))}</button> · Invest Partners Capital Group · ${esc(t('brandNote'))}</p>
      ${(PREVIEW || (S.snap && S.snap.demoAvailable)) && !S.demo ? '<p>Reviewer tools: <button class="linkish" data-act="demo-on">view the full layout with simulated data</button> (clearly marked; for design review only).</p>' : ''}
    </footer>`;
  }

  /* ------------------------------------------------------------------ components */
  function row(o, { period = 'day', showRegion = false } = {}) {
    if (!o) return '';
    const key = 'r:' + o.id;
    const open = S.open.has(key);
    const ok = o.value !== null && o.value !== undefined && o.status !== 'unavailable' && o.status !== 'restricted';
    const c = ok ? changeOf(o, period) : { v: null, txt: '—' };
    const sub = [showRegion && o.region, o.contract, o.unit && !o.contract ? o.unit : null].filter(Boolean).join(' · ');
    const detail = open ? `<div class="row-detail" id="d-${esc(o.id)}">${detailKv(o)}</div>` : '';
    return `<div class="row ${ok ? '' : o.status}">
      <button data-act="toggle" data-key="${esc(key)}" aria-expanded="${open}" aria-controls="d-${esc(o.id)}">
        <span class="row-name"><b>${esc(name(o))} ${statusPill(o)}</b><small>${esc(sub ? sub + ' · ' : '')}${esc(obsLine(o))}</small></span>
        <span class="row-val">${ok ? esc(valueTxt(o)) : '—'}</span>
        ${ok ? `<span class="chg ${dir(c.v)}" aria-label="${esc(word(c.v) + ' ' + c.txt)}">${esc(c.txt)}</span>` : '<span></span>'}
      </button>${detail}</div>`;
  }

  function detailKv(o) {
    const items = [];
    const isY = o.kind === 'yieldPct' || o.kind === 'spreadPct';
    if (o.value !== null && o.value !== undefined && o.status !== 'restricted') {
      if (o.prev !== null && o.prev !== undefined) items.push([isY ? 'Previous' : t('prevClose'), `${isY && o.kind === 'spreadPct' ? fmtN(o.prev * 100, 0) + ' bp' : fmtN(o.prev, o.decimals ?? 2) + (isY ? '%' : '')}${o.prevDate ? ' (' + fmtDate(o.prevDate) + ')' : ''}`]);
      if (!isY && o.change !== null && o.change !== undefined) items.push(['Change', signed(o.change, o.decimals ?? 2) + (o.changePct !== null && o.changePct !== undefined ? ` (${signed(o.changePct, o.pctDecimals ?? 2, '%')})` : '')]);
      if (o.periods) {
        const p = (k, l) => o.periods[k] && o.periods[k].change !== null ? `${l} ${isY ? signed(o.periods[k].change, 0, ' bp') : signed(o.periods[k].change, 2, '%')} (vs ${fmtDate(o.periods[k].ref)})` : null;
        const ps = [p('week', '1W'), p('mtd', 'MTD')].filter(Boolean);
        if (ps.length) items.push(['Performance', ps.join(' · ')]);
      }
      items.push([t('observed'), o.obsTime ? fmtSgt(o.obsTime) : fmtDate(o.obsDate, { day: 'numeric', month: 'short', year: 'numeric' })]);
    }
    if (o.unit) items.push(['Unit', o.unit]);
    if (o.contract) items.push(['Benchmark', o.contract]);
    items.push([t('source'), o.sourceUrl ? `<a class="src" href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">${esc(o.source || 'Source')}</a>` : esc(o.source || '—')]);
    if (o.seriesId) items.push([t('series'), esc(o.seriesId)]);
    if (o.latency) items.push([t('latency'), esc(LAT[o.latency] || o.latency)]);
    items.push([t('method'), esc(o.method === 'reported' ? 'Figure as reported in the cited article' : o.method === 'calculated' ? 'Calculated from source data' : o.method === 'simulated' ? 'Simulated (demo)' : 'Observed')]);
    if (o.retrievedAt) items.push([t('retrieved'), fmtSgt(o.retrievedAt)]);
    const notes = [o.note, o.reason && o.status !== 'ok' ? o.reason : null, o.internalOnly ? 'Shown here for internal review. ICE BofA index data may not be published to clients without a licence from ICE Data Indices.' : null, o.status === 'lagged' ? 'This series is published with a delay; it is the latest official observation available.' : null, o.status === 'stale' ? 'This observation is older than expected for this data type.' : null].filter(Boolean);
    return `<dl class="kv">${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${typeof v === 'string' && v.startsWith('<a') ? v : esc(v)}</dd>`).join('')}</dl>${notes.map((n) => `<p style="margin:0">${esc(n)}</p>`).join('')}`;
  }

  function keyTile(o) {
    if (!o) return '';
    const ok = o.value !== null && o.value !== undefined && !['unavailable', 'restricted'].includes(o.status);
    const c = ok ? changeOf(o, S.period) : { v: null, txt: '' };
    return `<button class="k" data-act="goto-detail" data-id="${esc(o.id)}" aria-label="${esc(name(o))}">
      <span class="k-name">${esc(name(o))}</span>
      <span class="k-val">${ok ? esc(valueTxt(o)) : '—'}</span>
      <span class="k-chg ${dir(c.v)}">${ok ? esc(c.txt) : esc(o.reason === 'Licensed market-data feed not connected' ? t('notConnected') : t('unavailable'))}</span>
      <span class="k-time">${esc(ok ? obsLine(o) : '')}</span>
    </button>`;
  }

  function periodSeg() {
    return `<div class="seg" role="group" aria-label="${esc(t('period'))}">${['day', 'week', 'mtd'].map((p) => `<button data-act="period" data-v="${p}" aria-pressed="${S.period === p}">${esc(t(p))}</button>`).join('')}</div>`;
  }

  function empty(title, text) { return `<div class="empty"><b>${esc(title)}</b><span>${esc(text)}</span></div>`; }

  /* ------------------------------------------------------------------ overview */
  function briefingBlock() {
    const b = S.snap.briefing && S.snap.briefing[S.mode];
    const head = `<div class="block-head"><h2>${esc(S.mode === 'daily' ? t('brief') : t('weekly'))}</h2><div class="seg" role="group" aria-label="Publication">${['daily', 'weekly'].map((m) => `<button data-act="mode" data-v="${m}" aria-pressed="${S.mode === m}">${esc(t(m))}</button>`).join('')}</div></div>`;
    if (!b) {
      return `<section class="block">${head}${S.mode === 'weekly' ? weeklyTable() : ''}${empty(S.mode === 'daily' ? t('brief') : t('weekly'), t('pending'))}${S.mode === 'daily' ? watchList(S.snap.whatToWatch) : ''}</section>`;
    }
    const status = b.status === 'approved'
      ? `<span class="pill ok">Reviewed by IPCG</span><span>Published ${esc(fmtSgt(b.approvedAt))}</span>`
      : `<span class="pill warn">Draft · pending IPCG review</span><span>Prepared ${esc(fmtSgt(b.createdAt))}</span>`;
    const isAi = b.generator && b.generator.startsWith('ai');
    const gen = b.status === 'approved' ? (isAi ? t('aiNote') : t('dataNote') + ' Reviewed by IPCG.') : (isAi ? 'Drafted with AI assistance from the cited data and sources. Awaiting IPCG review.' : t('dataNote') + ' Awaiting IPCG review.');
    const items = (b.items || []).map((it) => `<article class="b-item">
        <h3>${esc(it.headline)}</h3>
        <p>${esc(it.what)}</p>
        ${it.why ? `<p class="b-why"><strong>${esc(t('why'))}:</strong> ${esc(it.why)}</p>` : ''}
        <div class="b-foot">${(it.affected || []).map((a) => `<span class="tag">${esc(a)}</span>`).join('')}
          ${(it.sources || []).map((s) => `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</div>
      </article>`).join('');
    return `<section class="block">${head}
      <div class="brief"><div class="brief-status">${status}</div>${S.lang === 'zh' && !b.itemsZh ? '<p class="label-gen">簡報內容目前以英文提供。</p>' : ''}${items}<p class="label-gen">${esc(gen)} Based on data as of ${esc(fmtSgt(b.snapshotAt))}.</p></div>
      ${S.mode === 'weekly' ? weeklyTable() : ''}
      ${watchList(b.whatToWatch || S.snap.whatToWatch)}
      ${shareBar()}
    </section>`;
  }

  function watchList(list) {
    if (!list || !list.length) return '';
    return `<div class="watch"><h3>${esc(t('watch'))}</h3><ul>${list.map((w) => `<li><time>${esc(w.dateUtc ? fmtSgt(w.dateUtc).replace(/:\d\d SGT/, (m) => m) : fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</time><span>${esc(w.event)}${w.note ? ` <span style="color:var(--muted)">(${esc(w.note)})</span>` : ''}</span></li>`).join('')}</ul></div>`;
  }

  function shareBar() {
    return `<div class="share"><button class="btn" data-act="share">${ICON.share}${esc(t('shareBrief'))}</button><button class="btn secondary" data-act="copy-link">${ICON.link}${esc(t('copyLink'))}</button></div>`;
  }

  function weeklyTable() {
    const ids = ['spx', 'ccmp', 'sxxp', 'nky', 'hsi', 'taiex', 'ust2y', 'ust10y', 'ust30y', 'us_hy_oas', 'eurusd', 'usdjpy', 'usdtwd', 'xau', 'brent'];
    const rows = ids.map(ser).filter((o) => o && o.periods && o.periods.week && o.periods.week.change !== null);
    if (!rows.length) return empty('Weekly performance', 'Weekly comparisons appear once at least one week of history is available from each source.');
    return `<div class="tscroll"><table><caption class="sr">Weekly performance</caption><thead><tr><th>Instrument</th><th>Latest</th><th>1 week</th><th>Period</th></tr></thead><tbody>${rows.map((o) => {
      const c = changeOf(o, 'week');
      return `<tr><td>${esc(name(o))}${o.internalOnly ? ' <span class="pill gold">Internal</span>' : ''}</td><td>${esc(valueTxt(o))}</td><td class="${dir(c.v)}">${esc(c.txt)}</td><td>${esc(fmtDate(o.periods.week.ref))} → ${esc(fmtDate(o.obsDate))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function overview() {
    const s = S.snap;
    const regions = { US: ['spx', 'ccmp', 'indu', 'rty'], Europe: ['sxxp', 'sx5e', 'dax', 'ukx', 'cac'], Asia: ['nky', 'hsi', 'shcomp', 'csi300', 'taiex', 'kospi'] };
    const idx = regions[S.idxRegion].map(ser).filter(Boolean);
    const key = s.groups.keyIndicators.map(ser).filter(Boolean).filter((o) => !(o.id === 'usdcny' && ser('usdcnh') && ser('usdcnh').status !== 'unavailable') && !(o.id === 'usdbroad' && ser('dxy') && ser('dxy').status !== 'unavailable'));
    return `<div class="page-head"><p class="eyebrow">${esc(fmtDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p><h1>${esc(t('overviewLong'))}</h1></div>
      ${briefingBlock()}
      <section class="block">
        <div class="block-head"><h2>${esc(t('snapshot'))}</h2>${periodSeg()}</div>
        <div class="chips" role="group" aria-label="${esc(t('region'))}">${Object.keys(regions).map((r) => `<button class="chip" data-act="idx-region" data-v="${r}" aria-pressed="${S.idxRegion === r}">${esc(r)}</button>`).join('')}</div>
        <div class="rows">${idx.map((o) => row(o, { period: S.period })).join('')}</div>
        <p class="lede">Tap any line for the previous close, observation time and source.</p>
      </section>
      <section class="block">
        <div class="block-head"><h2>${esc(t('key'))}</h2><span class="meta">Treasury changes in basis points (1 bp = 0.01%)</span></div>
        <div class="kgrid">${key.map(keyTile).join('')}</div>
      </section>`;
  }

  /* ------------------------------------------------------------------ equities */
  const EQ_REGIONS = { US: ['spx', 'ccmp', 'indu', 'rty'], Europe: ['sxxp', 'sx5e', 'dax', 'ukx', 'cac'], China: ['shcomp', 'csi300'], 'Hong Kong': ['hsi'], Japan: ['nky'], Taiwan: ['taiex'], 'Asia-Pacific': ['kospi', 'nky', 'hsi', 'taiex', 'csi300'] };
  const NEWS_REGION = { US: 'US', Europe: 'Europe', China: 'China', 'Hong Kong': 'Hong Kong', Japan: 'Japan', Taiwan: 'Taiwan', 'Asia-Pacific': 'Asia' };

  function moversBlock() {
    const m = S.snap.movers;
    if (!m || m.status !== 'ok') return empty(t('movers'), (m && m.reason ? m.reason + '. ' : '') + 'Top gainers and losers need a licensed equity feed with a stock screener. Once connected, this section lists the largest moves within a defined universe of liquid stocks.');
    const r = m.regions[S.eqRegion];
    if (!r || !r.gainers) return empty(t('movers'), t('unavailable'));
    const sectors = [...new Set([...r.gainers, ...r.losers].map((x) => x.sector).filter(Boolean))].sort();
    const f = (list) => list.filter((x) => S.sector === "all" || x.sector === S.sector).slice(0, 5);
    const tbl = (list, label) => `<div class="tscroll"><table><caption class="sr">${esc(label)}</caption><thead><tr><th>${esc(label)}</th><th>Price</th><th>Change</th><th>Volume</th></tr></thead><tbody>${f(list).map((x) => `<tr><td><b>${esc(x.name)}</b><br><small style="color:var(--muted)">${esc(x.ticker)} · ${esc(x.exchange)}${x.sector ? ' · ' + esc(x.sector) : ''}</small>${x.why ? `<br><small>${esc(x.why)}</small>` : ''}</td><td>${esc(fmtN(x.price))}</td><td class="${dir(x.changePct)}">${esc(signed(x.changePct, 2, '%'))}<br><small>${esc(signed(x.change, 2))}</small></td><td>${x.volume ? esc((x.volume / 1e6).toFixed(1) + 'm') : '—'}${x.avgVolume && x.volume ? `<br><small style="color:var(--muted)">${esc((x.volume / x.avgVolume).toFixed(1))}× avg</small>` : ''}</td></tr>`).join('') || `<tr><td colspan="4">No movers in this sector.</td></tr>`}</tbody></table></div>`;
    return `<div class="frow" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label for="sector" style="font-size:var(--fs-xs);color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.08em">Sector</label><select id="sector" class="select" data-act="sector"><option value="all">${esc(t('allSectors'))}</option>${sectors.map((s) => `<option ${S.sector === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      ${tbl(r.gainers, t('gainers'))}${tbl(r.losers, t('losers'))}<p class="lede">Universe: ${esc(r.universe || '')}. ${esc(m.note || '')}</p>`;
  }

  function sectorsBlock() {
    const sc = S.snap.sectors;
    if (!sc || sc.status !== 'ok' || !sc.rows.length) return empty(t('sectors'), (sc && sc.reason ? sc.reason + '. ' : '') + 'US sector performance appears here once the licensed market-data feed is connected.');
    const max = Math.max(...sc.rows.map((r) => Math.abs(r.changePct)), 0.5);
    return `<div class="bars" role="list">${sc.rows.map((r) => `<div class="bar" role="listitem"><span>${esc(S.lang === 'zh' ? r.zh : r.label)}</span><span class="bar-track"><span class="bar-fill ${r.changePct >= 0 ? 'up' : 'down'}" style="width:${(Math.abs(r.changePct) / max) * 50}%"></span></span><span class="num" style="text-align:right;font-weight:700;color:var(--${r.changePct >= 0 ? 'pos' : 'neg'})">${esc(signed(r.changePct, 2, '%'))}</span></div>`).join('')}</div><p class="lede">${esc(sc.method)} Source: ${esc(sc.source)}.</p>`;
  }

  function equities() {
    const ids = EQ_REGIONS[S.eqRegion];
    const news = (S.snap.news || []).filter((n) => (n.regions || []).includes(NEWS_REGION[S.eqRegion])).slice(0, 4);
    return `<div class="page-head"><p class="eyebrow">${esc(t('equities'))}</p><h1>${esc(t('equitiesLong'))}</h1></div>
      <section class="block">
        <div class="chips" role="group" aria-label="${esc(t('region'))}">${Object.keys(EQ_REGIONS).map((r) => `<button class="chip" data-act="eq-region" data-v="${esc(r)}" aria-pressed="${S.eqRegion === r}">${esc(r)}</button>`).join('')}</div>
        <div class="block-head"><h2>Indices</h2>${periodSeg()}</div>
        <div class="rows">${ids.map(ser).filter(Boolean).map((o) => row(o, { period: S.period })).join('')}</div>
      </section>
      <section class="block"><h2>${esc(t('movers'))}</h2>${moversBlock()}</section>
      ${S.eqRegion === 'US' ? `<section class="block"><h2>${esc(t('sectors'))}</h2>${sectorsBlock()}</section>` : ''}
      <section class="block"><h2>${esc(t('context'))} · ${esc(S.eqRegion)}</h2>${news.length ? `<div class="news">${news.map(newsCard).join('')}</div>` : empty(t('context'), 'No recent stories tagged to this region from the connected sources.')}</section>`;
  }

  /* ------------------------------------------------------------------ rates */
  function curveChart(c) {
    const cur = c.current.values, cmp = c.compare[S.compare];
    const tenors = c.tenors;
    const W = chartW(), H = W < 500 ? 260 : 300, L = 46, R = 16, Tp = 40, B = 34;
    const vals = tenors.map((k) => cur[k]).concat(cmp ? tenors.map((k) => cmp.values[k]) : []).filter((v) => v !== null && v !== undefined);
    let lo = Math.floor((Math.min(...vals) - 0.05) * 4) / 4, hi = Math.ceil((Math.max(...vals) + 0.05) * 4) / 4;
    const x = (i) => L + (i * (W - L - R)) / (tenors.length - 1);
    const y = (v) => Tp + ((hi - v) * (H - Tp - B)) / (hi - lo);
    const ticks = []; for (let v = lo; v <= hi + 1e-9; v += 0.25) ticks.push(v);
    const step = ticks.length > 7 ? 2 : 1;
    const path = (vs) => tenors.map((k, i) => (vs[k] === null || vs[k] === undefined ? '' : `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(vs[k]).toFixed(1)}`)).join('');
    const tipI = S.tip;
    let tip = '';
    if (tipI !== null && tipI !== undefined && cur[tenors[tipI]] !== null) {
      const k = tenors[tipI];
      const lines = [`${k}: ${fmtN(cur[k])}%`].concat(cmp && cmp.values[k] !== null ? [`${fmtDate(cmp.date)}: ${fmtN(cmp.values[k])}% (${signed((cur[k] - cmp.values[k]) * 100, 0, ' bp')})`] : []);
      const tw = Math.max(...lines.map((l) => l.length)) * 7.2 + 16;
      const tx = Math.min(Math.max(x(tipI) - tw / 2, 4), W - tw - 4);
      tip = `<line x1="${x(tipI)}" x2="${x(tipI)}" y1="${Tp - 4}" y2="${H - B}" stroke="var(--line)" stroke-width="1"/><g class="tip"><rect x="${tx}" y="2" width="${tw}" height="${lines.length * 16 + 10}" rx="6"/>${lines.map((l, i) => `<text x="${tx + 8}" y="${18 + i * 16}">${esc(l)}</text>`).join('')}</g>`;
    }
    return `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="US Treasury par yield curve on ${esc(fmtDate(c.asOf))}${cmp ? ' compared with ' + esc(fmtDate(cmp.date)) : ''}">
        ${ticks.map((v, i) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>${i % step === 0 ? `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(2)}%</text>` : ''}`).join('')}
        ${tenors.map((k, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${k}</text>`).join('')}
        ${cmp ? `<path d="${path(cmp.values)}" fill="none" stroke="var(--chart-b)" stroke-width="2" stroke-dasharray="6 5"/>` : ''}
        <path d="${path(cur)}" fill="none" stroke="var(--chart-a)" stroke-width="2.5"/>
        ${tenors.map((k, i) => (cur[k] === null ? '' : `<circle cx="${x(i)}" cy="${y(cur[k])}" r="${tipI === i ? 6 : 4}" fill="var(--chart-a)" stroke="var(--surface)" stroke-width="2"/>`)).join('')}
        ${tip}
        ${tenors.map((k, i) => `<rect x="${x(i) - 24}" y="${Tp - 10}" width="48" height="${H - Tp - B + 20}" fill="transparent" data-act="tip" data-i="${i}" style="cursor:pointer"><title>${k}</title></rect>`).join('')}
      </svg>
      <div class="legend"><span><i></i>${esc(fmtDate(c.asOf, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>${cmp ? `<span><i class="b"></i>${esc(fmtDate(cmp.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>` : ''}<span>Tap a maturity for exact yields</span></div>
    </div>`;
  }

  function curveTable(c) {
    const cmp = c.compare[S.compare];
    return `<div class="tscroll"><table><caption class="sr">Treasury yields by maturity</caption><thead><tr><th>Maturity</th><th>${esc(fmtDate(c.asOf))}</th><th>${cmp ? esc(fmtDate(cmp.date)) : '—'}</th><th>Change</th></tr></thead><tbody>${c.tenors.map((k) => {
      const a = c.current.values[k], b = cmp ? cmp.values[k] : null;
      const d = a !== null && b !== null && b !== undefined ? Math.round((a - b) * 100) : null;
      return `<tr><td>${k.replace('M', ' month').replace('Y', ' year')}</td><td>${esc(fmtN(a))}%</td><td>${b !== null && b !== undefined ? esc(fmtN(b)) + '%' : '—'}</td><td class="${dir(d)}">${esc(signed(d, 0, ' bp'))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function curveExplain(c) {
    const cmp = c.compare[S.compare];
    if (!cmp) return '';
    const sp = (v) => (v['10Y'] - v['2Y']) * 100, sp3 = (v) => (v['10Y'] - v['3M']) * 100;
    const nowS = sp(c.current.values), thenS = sp(cmp.values);
    const d = Math.round(nowS - thenS);
    const d2 = Math.round((c.current.values['2Y'] - cmp.values['2Y']) * 100), d10 = Math.round((c.current.values['10Y'] - cmp.values['10Y']) * 100);
    const move = d >= 2 ? 'steepened' : d <= -2 ? 'flattened' : 'was little changed in shape';
    const shape = nowS < 0 ? 'inverted (2-year yields above 10-year)' : nowS < 25 ? 'relatively flat' : 'upward-sloping';
    const parts = `the 2-year yield ${d2 > 0 ? 'rose' : d2 < 0 ? 'fell' : 'was unchanged'}${d2 ? ' ' + Math.abs(d2) + ' bp' : ''} and the 10-year ${d10 > 0 ? 'rose' : d10 < 0 ? 'fell' : 'was unchanged'}${d10 ? ' ' + Math.abs(d10) + ' bp' : ''}`;
    return `<div class="callout"><b>Since ${esc(fmtDate(cmp.date))}, the curve ${move}: ${esc(parts)}.</b><span>The curve is ${esc(shape)}; the 2s10s spread is ${esc(signed(Math.round(nowS), 0, ' bp'))} and 3m10s ${esc(signed(Math.round(sp3(c.current.values)), 0, ' bp'))}. This describes what moved, calculated from Treasury data. It does not by itself identify why yields moved; shifts in policy-rate expectations and in the term premium can both contribute.</span></div>`;
  }

  function historyChart(ids) {
    const sers = ids.map(ser).filter((o) => o && o.history && o.history.length > 5);
    if (!sers.length) return '';
    const W = chartW(), H = W < 500 ? 200 : 220, L = 46, R = 70, Tp = 14, B = 28;
    const dates = sers[0].history.map((h) => h.date);
    const all = sers.flatMap((s) => s.history.map((h) => h.value)).filter((v) => v !== null);
    const lo = Math.floor((Math.min(...all) - 0.05) * 4) / 4, hi = Math.ceil((Math.max(...all) + 0.05) * 4) / 4;
    const x = (i) => L + (i * (W - L - R)) / (dates.length - 1), y = (v) => Tp + ((hi - v) * (H - Tp - B)) / (hi - lo);
    const ticks = []; for (let v = lo; v <= hi + 1e-9; v += 0.25) ticks.push(v);
    const colors = ['var(--chart-a)', 'var(--chart-b)'];
    const lbl = [0, Math.floor(dates.length / 2), dates.length - 1];
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Recent history of ${esc(sers.map((s) => s.label).join(' and '))}">
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(2)}%</text>`).join('')}
      ${lbl.map((i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}">${esc(fmtDate(dates[i]))}</text>`).join('')}
      ${sers.map((s, j) => { const hs = s.history; const d = hs.map((h, i) => (h.value === null ? '' : `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.value).toFixed(1)}`)).join(''); const last = hs[hs.length - 1]; return `<path d="${d}" fill="none" stroke="${colors[j]}" stroke-width="2" ${j ? 'stroke-dasharray="6 5"' : ''}/><circle cx="${x(hs.length - 1)}" cy="${y(last.value)}" r="4" fill="${colors[j]}" stroke="var(--surface)" stroke-width="2"/><text x="${x(hs.length - 1) + 8}" y="${y(last.value) + 4}" style="fill:var(--ink);font-weight:600">${esc(s.id.replace('ust', '').toUpperCase())} ${fmtN(last.value)}%</text>`; }).join('')}
    </svg><div class="legend">${sers.map((s, j) => `<span><i class="${j ? 'b' : ''}"></i>${esc(s.label)}</span>`).join('')}<span>Daily closes, ${esc(fmtDate(dates[0]))} – ${esc(fmtDate(dates[dates.length - 1]))}</span></div></div>`;
  }

  // Size the SVG coordinate system to the real width so chart text stays legible (~12px) on phones.
  function chartW() { const w = Math.min(document.documentElement.clientWidth, 760) - 50; return Math.max(320, Math.min(680, Math.round(w))); }
  let lastW = 0;
  window.addEventListener('resize', () => { const w = chartW(); if (Math.abs(w - lastW) > 30 && (view() === 'rates')) { lastW = w; render(); } });

  const EXPLAIN = [
    ['Basis points (bp)', 'One basis point is one hundredth of a percentage point (0.01%). A yield moving from 4.50% to 4.75% has risen 25 bp.'],
    ['Duration', 'A measure of how sensitive a bond’s price is to interest-rate changes. A bond with a duration of 7 would lose roughly 7% of its value if yields rose by one percentage point, and gain roughly 7% if they fell by the same amount.'],
    ['Credit spreads', 'The extra yield a corporate bond pays over a government bond of similar maturity, compensating investors for credit risk. Wider spreads usually mean investors are demanding more compensation.'],
    ['Yield-to-worst', 'The lowest yield an investor could receive if the issuer uses its rights to redeem early (call) on the least favourable date, without defaulting. For callable and perpetual bonds it is often more relevant than yield-to-maturity.'],
    ['Investment grade vs high yield', 'Bonds rated BBB−/Baa3 or higher are “investment grade”; lower-rated bonds are “high yield”. High-yield bonds pay more because default risk is higher.'],
    ['AT1 and contingent convertible bonds', 'Additional Tier 1 bonds are perpetual bank capital securities. Coupons can be cancelled, and the bonds can be written down or converted to equity if a bank’s capital falls below a trigger. A call date is an option for the issuer, not a maturity date; if not called, the coupon typically resets and the bond remains outstanding (extension risk).'],
    ['Yield-curve inversion', 'The curve is inverted when short-term yields are higher than long-term yields, for example 2-year above 10-year. Inversions have often preceded slower growth, but timing is unreliable and they are not a forecast on their own.'],
    ['Coupon, current yield, YTM, YTC', 'Coupon is the fixed interest rate on face value. Current yield is the coupon divided by today’s price. Yield-to-maturity assumes the bond is held to maturity; yield-to-call assumes it is redeemed at the call date.'],
  ];

  function rates() {
    const c = S.snap.curve;
    const sov = S.snap.groups.sovereigns.map(ser).filter(Boolean);
    const credit = S.snap.groups.credit.map(ser).filter(Boolean);
    const fiNews = (S.snap.news || []).filter((n) => (n.topics || []).some((x) => /fixed income|central banks/i.test(x))).slice(0, 5);
    const curveSection = c && c.status === 'ok' ? `
      <div class="block-head"><h2>${esc(t('curve'))}</h2><span class="meta">Par yields · ${esc(fmtDate(c.asOf, { day: 'numeric', month: 'short', year: 'numeric' }))} close</span></div>
      <div class="frow" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:var(--fs-sm);color:var(--slate)">${esc(t('compareWith'))}</span><div class="seg wrapchips" role="group" aria-label="${esc(t('compareWith'))}">${[['prevDay', t('prevDay')], ['week', t('oneWeek')], ['month', t('oneMonth')]].map(([k, l]) => `<button data-act="compare" data-v="${k}" aria-pressed="${S.compare === k}">${esc(l)}</button>`).join('')}</div></div>
      ${curveChart(c)}${curveExplain(c)}
      <div class="spreads">
        <div class="spread"><span>2-year / 10-year</span><b>${esc(signed(c.shape.spread2s10s, 0, ' bp'))}</b><span>${esc(signed(c.shape.delta2s10s, 0, ' bp'))} on the day</span></div>
        <div class="spread"><span>3-month / 10-year</span><b>${esc(signed(c.shape.spread3m10s, 0, ' bp'))}</b><span>Positive = upward-sloping</span></div>
      </div>
      ${curveTable(c)}
      <p class="lede">Source: <a class="src" href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.source)}</a>. Published after the New York close; observation date ${esc(fmtDate(c.asOf, { day: 'numeric', month: 'long', year: 'numeric' }))}.</p>`
      : empty(t('curve'), c && c.reason ? c.reason : t('unavailable'));
    return `<div class="page-head"><p class="eyebrow">${esc(t('rates'))}</p><h1>${esc(t('ratesLong'))}</h1></div>
      <section class="block">${curveSection}</section>
      <section class="block"><div class="block-head"><h2>US Treasury benchmarks</h2>${periodSeg()}</div><div class="rows">${['ust2y', 'ust5y', 'ust10y', 'ust30y'].map(ser).filter(Boolean).map((o) => row(o, { period: S.period })).join('')}</div>${historyChart(['ust10y', 'ust2y'])}</section>
      <section class="block"><h2>${esc(t('sovereigns'))}</h2><div class="rows">${sov.map((o) => row(o, { period: S.period })).join('')}</div></section>
      <section class="block"><h2>${esc(t('policy'))}</h2>${policyTable()}</section>
      <section class="block"><div class="block-head"><h2>${esc(t('credit'))}</h2><span class="meta">Option-adjusted spreads over Treasuries</span></div>
        <div class="rows">${credit.map((o) => row(o)).join('')}</div>
        ${empty('Bank capital, AT1 and new issuance', 'Instrument-level yields (YTW/YTC), new-issue pricing, rating actions and AT1 call decisions need a licensed bond-data or news feed. When connected, each bond shows coupon, current yield, yield-to-call and yield-to-worst separately, and perpetual call dates are never treated as maturities.')}
      </section>
      <section class="block"><h2>${esc(t('fiNews'))}</h2>${fiNews.length ? `<div class="news">${fiNews.map(newsCard).join('')}</div>` : empty(t('fiNews'), 'No recent stories from the connected sources.')}</section>
      <section class="block"><h2>${esc(t('explainers'))}</h2><div class="explain">${EXPLAIN.map(([h, p]) => `<details><summary>${esc(h)}</summary><p>${esc(p)}</p></details>`).join('')}</div></section>`;
  }

  function policyTable() {
    const pr = S.snap.policyRates || [];
    if (!pr.length) return empty(t('policy'), t('unavailable'));
    return `<div class="tscroll"><table><caption class="sr">Central bank policy rates</caption><thead><tr><th>Central bank</th><th>Rate</th><th>Last decision</th><th>Next</th></tr></thead><tbody>${pr.map((r) => `<tr><td><a class="src" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener"><b>${esc(S.lang === 'zh' ? r.zh : r.bank)}</b></a><br><small style="color:var(--muted)">${esc(r.instrument)}</small>${r.rateCheck ? `<br><small style="color:var(--warn)">${esc(r.rateCheck)}</small>` : ''}</td><td>${esc(r.rate)}</td><td style="white-space:normal;min-width:9em">${esc(S.lang === 'zh' && r.decisionZh ? r.decisionZh : r.decision)}<br><small style="color:var(--muted)">${esc(String(r.lastDecision).length === 7 ? fmtDate(r.lastDecision + '-20', { month: 'short', year: 'numeric' }) : fmtDate(r.lastDecision, { day: 'numeric', month: 'short', year: 'numeric' }))}</small></td><td>${r.next ? esc(fmtDate(r.next, { day: 'numeric', month: 'short' })) : '—'}</td></tr>`).join('')}</tbody></table></div><p class="lede">Verified against each central bank’s published decisions on ${esc(fmtDate(pr[0].verifiedAt, { day: 'numeric', month: 'short', year: 'numeric' }))}. Tap a bank to open its source.</p>`;
  }

  /* ------------------------------------------------------------------ fx & commodities */
  const CCY = { USD: 'US dollar', EUR: 'euro', GBP: 'pound', JPY: 'yen', CNH: 'offshore yuan', CNY: 'yuan', HKD: 'Hong Kong dollar', TWD: 'Taiwan dollar' };
  function fxSentence(o) {
    if (!o.base || o.value === null || o.status === 'unavailable' || !o.changePct) return '';
    const up = o.changePct > 0;
    const strong = up ? o.base : o.quote, weak = up ? o.quote : o.base;
    return `${CCY[strong]} strengthened ${fmtN(Math.abs(o.changePct))}% against the ${CCY[weak]}`;
  }
  function markets() {
    const com = S.snap.groups.commodities.map(ser).filter(Boolean);
    const fx = S.snap.groups.fx.map(ser).filter(Boolean);
    const lines = fx.map((o) => [o, fxSentence(o)]).filter(([, s]) => s);
    const news = (S.snap.news || []).filter((n) => (n.topics || []).includes('Commodities & FX')).slice(0, 4);
    return `<div class="page-head"><p class="eyebrow">${esc(t('markets'))}</p><h1>${esc(t('marketsLong'))}</h1></div>
      <section class="block"><div class="block-head"><h2>${esc(t('commodities'))}</h2>${periodSeg()}</div>
        <div class="rows">${com.map((o) => row(o, { period: S.period })).join('')}</div>
        <p class="lede">Futures prices refer to the front-month contract named on each line; spot prices are for immediate delivery. The two can differ, especially in volatile markets.</p></section>
      <section class="block"><div class="block-head"><h2>${esc(t('fx'))}</h2><span class="meta">Quoted as units of the second currency per one unit of the first</span></div>
        <div class="rows">${fx.map((o) => row(o, { period: S.period })).join('')}</div>
        ${lines.length ? `<div class="callout"><b>Currency moves on the latest observation</b>${lines.map(([o, s]) => `<span>${esc(o.label)}: ${esc(s)} (${esc(fmtDate(o.obsDate))}).</span>`).join('')}</div>` : ''}
        <div class="explain"><details><summary>Hong Kong dollar</summary><p>The Hong Kong dollar is linked to the US dollar under the Linked Exchange Rate System, with the HKMA committed to keeping USD/HKD between 7.75 and 7.85. Moves within that band mainly reflect interest-rate differences and liquidity in Hong Kong’s banking system.</p></details><details><summary>Taiwan dollar</summary><p>The Taiwan dollar floats but is managed by the Central Bank of the Republic of China (Taiwan), which says it intervenes to limit excessive volatility. Exporter conversion of US dollars and foreign equity flows into Taiwan’s stock market are often cited as influences on USD/TWD.</p></details><details><summary>Onshore vs offshore yuan</summary><p>CNY trades onshore in mainland China within a band around the daily PBOC fixing. CNH trades freely offshore, mainly in Hong Kong. The two rates usually track closely but can diverge when capital flows or policy expectations shift.</p></details></div>
      </section>
      <section class="block"><h2>Related news</h2>${news.length ? `<div class="news">${news.map(newsCard).join('')}</div>` : empty('Related news', 'No recent stories from the connected sources.')}</section>`;
  }

  /* ------------------------------------------------------------------ news */
  function newsCard(n) {
    const pub = n.publishedAt ? (n.publishedAt.length === 10 ? fmtDate(n.publishedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : fmtSgt(n.publishedAt)) : '';
    return `<div class="n"><details><summary>
      <span class="n-meta"><b style="color:var(--ink)">${esc(n.publisher)}</b>${n.primary ? `<span class="pill ok">${esc(t('primary'))}</span>` : ''}<span>${esc(pub)}</span></span>
      <h3>${esc(n.title)}</h3><span class="more">${esc(t('readMore'))}</span></summary>
      <div class="n-body">${n.summary ? `<p>${esc(n.summary)}</p>` : ''}${n.why ? `<p><b style="color:var(--ink)">${esc(t('why'))}:</b> ${esc(n.why)}</p>` : ''}
        <div class="b-foot">${[...(n.regions || []), ...(n.topics || [])].map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
        <a class="src" href="${esc(n.link)}" target="_blank" rel="noopener">${esc(t('openSource'))} ↗</a></div></details></div>`;
  }
  function newsView() {
    const all = S.snap.news || [];
    const regions = ['US', 'Europe', 'China', 'Hong Kong', 'Japan', 'Taiwan', 'Asia'];
    const topics = ['Central banks & macro', 'Fixed income & credit', 'Equities', 'Commodities & FX', 'Geopolitics & trade'];
    const ref = S.snap.generatedAt ? new Date(S.snap.generatedAt).getTime() : Date.now();
    const maxAge = { h24: 1, d7: 7, d30: 30 }[S.newsPeriod] * 864e5 + 12 * 3600e3;
    const list = all.filter((n) => (S.newsRegion === 'all' || (n.regions || []).includes(S.newsRegion)) && (S.newsTopic === 'all' || (n.topics || []).includes(S.newsTopic)) && (!n.publishedAt || ref - new Date(n.publishedAt).getTime() <= maxAge));
    const sel = (id, act, cur, opts) => `<select id="${id}" class="select" data-act="${act}"><option value="all">${esc(t('all'))}</option>${opts.map((o) => `<option ${cur === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `<div class="page-head"><p class="eyebrow">${esc(t('news'))}</p><h1>${esc(t('newsLong'))}</h1><p class="lede">Headlines from official sources and reputable financial publishers, summarised in our own words with a link to the original.</p></div>
      <section class="block">
        <div class="filters">
          <div class="frow"><label for="nr">${esc(t('region'))}</label>${sel('nr', 'news-region', S.newsRegion, regions)}<label for="nt">${esc(t('topic'))}</label>${sel('nt', 'news-topic', S.newsTopic, topics)}</div>
          <div class="seg" role="group" aria-label="${esc(t('period'))}">${['h24', 'd7', 'd30'].map((p) => `<button data-act="news-period" data-v="${p}" aria-pressed="${S.newsPeriod === p}">${esc(t(p))}</button>`).join('')}</div>
        </div>
        ${list.length ? `<div class="news">${list.map(newsCard).join('')}</div>` : empty(t('noNews'), 'Try a wider period or another region.')}
        <p class="lede">${list.length} of ${all.length} stories. Duplicate stories are merged, keeping the original or most authoritative source.</p>
      </section>`;
  }

  /* ------------------------------------------------------------------ calendar */
  function calendar() {
    const cal = S.snap.calendar || { events: [] };
    const byDay = new Map();
    for (const e of cal.events) {
      const d = e.dateUtc ? new Date(e.dateUtc).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) : e.date;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    }
    const fig = (v) => (v === null || v === undefined || v === '' ? t('na') : esc(v));
    const days = [...byDay.entries()].map(([d, evs]) => `<div class="cal-day"><div class="cal-date">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>${evs.map((e) => `<div class="ev">
        <div class="ev-top"><span class="ev-name">${esc(S.lang === 'zh' && e.zh ? e.zh : e.event)}</span><span class="ev-time">${e.dateUtc ? esc(new Date(e.dateUtc).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' })) + ' SGT' : 'Time TBC'}</span></div>
        <div class="b-foot"><span class="tag">${esc(e.region)}</span><span class="pill ${e.importance === 'high' ? 'gold' : 'neutral'}">${esc(t(e.importance) || e.importance)}</span><span>Local: ${esc(e.localTime || '—')}</span>${e.timeNote ? `<span>${esc(e.timeNote)}</span>` : ''}</div>
        ${e.kind === 'data' || e.previous !== null || e.consensus !== null || e.actual !== null ? `<div class="ev-figs"><span>${esc(t('prev'))}<b>${fig(e.previous)}</b></span><span>${esc(t('cons'))}<b>${fig(e.consensus)}</b></span><span>${esc(t('actual'))}<b>${fig(e.actual)}</b></span></div>` : ''}
        <span class="b-foot">${esc(t('source'))}: ${e.sourceUrl ? `<a class="src" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(e.source)}</a>` : esc(e.source)}</span></div>`).join('')}</div>`).join('');
    const note = cal.providerStatus === 'ok' ? '' : empty('Economic data releases', 'US CPI, payrolls, PCE, ISM and GDP; China PMI, CPI and trade; Taiwan exports and GDP; and euro-area inflation appear here, with previous, consensus and actual figures, once the licensed calendar feed is connected. Official central-bank meeting dates are shown now.');
    return `<div class="page-head"><p class="eyebrow">${esc(t('calendar'))}</p><h1>${esc(t('calendarLong'))}</h1><p class="lede">All times in Singapore time (SGT). Consensus figures are shown only when a reliable source provides them.</p></div>
      <section class="block">${note}${days || empty(t('calendar'), 'No scheduled events in the coming weeks.')}</section>`;
  }

  /* ------------------------------------------------------------------ sheets */
  function sheet(title, html) {
    closeSheet();
    const el = document.createElement('div');
    el.className = 'sheet-bg'; el.id = 'sheet';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="btn secondary" data-act="close-sheet">${esc(t('close'))}</button></div>${html}</div>`;
    el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
    document.body.appendChild(el);
    el.querySelector('button').focus();
  }
  function closeSheet() { const s = document.getElementById('sheet'); if (s) s.remove(); }
  function toast(msg) {
    const old = document.querySelector('.toast'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 3200);
  }
  function pageUrl() { return (S.snap && S.snap.publicUrl) || location.href.split('#')[0]; }

  function briefingText() {
    const b = S.snap.briefing && S.snap.briefing[S.mode];
    if (!b) return null;
    const lines = [`*IPCG Global Markets — ${S.mode === 'weekly' ? 'Weekly Review' : 'Daily Briefing'}*`, fmtSgt(b.approvedAt || b.createdAt), ''];
    for (const it of b.items.slice(0, 4)) lines.push(`• *${it.headline}*: ${it.what}`, '');
    const w = b.whatToWatch || [];
    if (w.length) { lines.push('*What to watch*'); for (const x of w.slice(0, 3)) lines.push(`• ${x.dateUtc ? fmtSgt(x.dateUtc) : fmtDate(x.date)} — ${x.event}`); lines.push(''); }
    lines.push(`Full dashboard: ${pageUrl()}`, '', '_General market information only; not a recommendation. Data may be delayed._');
    return lines.join('\n');
  }
  function shareSheet() {
    const b = S.snap.briefing && S.snap.briefing[S.mode];
    const txt = briefingText();
    if (!txt) return toast('No reviewed briefing to share yet.');
    const draftWarn = b.status !== 'approved' ? '<div class="banner preview" style="border-radius:8px;padding:10px 12px">This briefing is a draft and has not been approved by IPCG. Do not send it to clients.</div>' : '';
    sheet(t('shareBrief'), `${draftWarn}<p class="lede" style="margin:0">Review the text, then copy it into WhatsApp or open WhatsApp with it pre-filled. Nothing is sent automatically.</p>
      <label for="share-text" class="sr">Briefing text</label><textarea id="share-text">${esc(txt)}</textarea>
      <div class="share"><button class="btn" data-act="copy-share">Copy text</button><a class="btn secondary" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Open in WhatsApp</a></div>`);
  }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || t('copied')); }
    catch {
      const ta = document.getElementById('share-text');
      if (ta) { ta.focus(); ta.select(); toast('Text selected. Use Copy from your keyboard or menu.'); }
      else sheet(t('copyLink'), `<p class="lede">Select and copy this link:</p><textarea id="share-text" style="min-height:80px">${esc(text)}</textarea>`);
    }
  }
  function aboutSheet() {
    const s = S.snap;
    const h = (s.health || []).map((x) => `<div><span>${esc(x.provider)}</span><span class="pill ${x.status === 'ok' ? 'ok' : x.status === 'not-configured' ? 'neutral' : 'bad'}">${esc(x.status === 'ok' ? 'Connected' : x.status === 'not-configured' ? 'Not connected' : 'Delayed')}</span></div>`).join('');
    sheet(t('about'), `<p class="lede" style="margin:0">Each figure shows its own observation time and source; tap a line to see them. Markets trade in different time zones, so not every market is open when you read this page.</p>
      <div class="health">${h || '<div><span>Source status</span><span>—</span></div>'}</div>
      <p class="lede" style="margin:0"><b>Kinds of data.</b> “Close” is the latest completed session. “Delayed” quotes trail the market by the provider’s stated delay. “Lagged” series are official data published on a weekly cycle. “Reported” figures are taken from the cited news article. Nothing is estimated or filled in when a source fails; the line says so instead.</p>
      <p class="lede" style="margin:0">Snapshot generated ${esc(fmtSgt(s.generatedAt))}.</p>`);
  }

  /* ------------------------------------------------------------------ render & events */
  function render() {
    document.documentElement.classList.toggle('large-text', S.large);
    document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant' : 'en';
    document.body.classList.toggle('is-demo', Boolean(S.demo || (S.snap && S.snap.environment === 'demo')));
    const app = document.getElementById('app');
    if (!S.snap) { app.innerHTML = S.error ? `<div class="wrap"><div class="empty" style="margin-top:40px"><b>IPCG Global Markets</b><span>${esc(S.error)}</span><button class="btn" data-act="refresh">${esc(t('refresh'))}</button></div></div>` : '<p class="boot">Loading IPCG Global Markets…</p>'; return; }
    const v = view();
    const body = { overview, equities, rates, markets, news: newsView, calendar }[v]();
    const y = window.scrollY;
    app.innerHTML = shell(body);
    window.scrollTo(0, y);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const a = el.dataset.act, v = el.dataset.v;
    switch (a) {
      case 'toggle': { const k = el.dataset.key; S.open.has(k) ? S.open.delete(k) : S.open.add(k); render(); break; }
      case 'period': S.period = v; render(); break;
      case 'mode': S.mode = v; render(); break;
      case 'idx-region': S.idxRegion = v; render(); break;
      case 'eq-region': S.eqRegion = v; S.sector = 'all'; render(); break;
      case 'compare': S.compare = v; S.tip = null; render(); break;
      case 'tip': S.tip = Number(el.dataset.i) === S.tip ? null : Number(el.dataset.i); render(); break;
      case 'news-period': S.newsPeriod = v; render(); break;
      case 'lang': S.lang = S.lang === 'en' ? 'zh' : 'en'; store.set('lang', S.lang); render(); break;
      case 'size': S.large = !S.large; store.set('large', S.large ? '1' : '0'); render(); break;
      case 'refresh': load(true); break;
      case 'share': shareSheet(); break;
      case 'copy-link': copy(pageUrl(), 'Link copied. Paste it into WhatsApp.'); break;
      case 'copy-share': copy(document.getElementById('share-text').value, 'Briefing copied.'); break;
      case 'close-sheet': closeSheet(); break;
      case 'about': aboutSheet(); break;
      case 'demo-on': S.demo = true; load(); break;
      case 'demo-off': S.demo = false; load(); break;
      case 'goto-detail': {
        const id = el.dataset.id; const target = id.startsWith('ust') ? 'rates' : 'markets';
        S.open.add('r:' + id); location.hash = target; window.scrollTo(0, 0); break;
      }
    }
  });
  document.addEventListener('change', (e) => {
    const a = e.target.dataset && e.target.dataset.act;
    if (a === 'sector') S.sector = e.target.value;
    else if (a === 'news-region') S.newsRegion = e.target.value;
    else if (a === 'news-topic') S.newsTopic = e.target.value;
    else return;
    render();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  window.addEventListener('hashchange', () => { S.tip = null; render(); window.scrollTo(0, 0); });
  setInterval(() => { const c = document.getElementById('clock'); if (c) c.textContent = new Date().toLocaleString(locale(), { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }); }, 30000);

  window.IPCG = { load, state: S };
  load();
})();
