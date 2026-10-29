/* IPCG Global Markets – internal publication review console. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = '';
  try { token = sessionStorage.getItem('ipcg.admin') || ''; } catch { /* no storage */ }

  async function api(path, opts = {}) {
    const r = await fetch('/api/admin/' + path, { ...opts, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }

  async function start() {
    try {
      const snap = await api('snapshot');
      $('login').hidden = true; $('main-ui').hidden = false;
      try { sessionStorage.setItem('ipcg.admin', token); } catch { /* ignore */ }
      $('health').innerHTML = (snap.health || []).map((h) => `<div><span>${esc(h.provider)}<br><small style="color:var(--muted)">${esc(h.message || '')}</small></span><span class="pill ${h.status === 'ok' ? 'ok' : h.status === 'not-configured' ? 'neutral' : 'bad'}">${esc(h.status)}</span></div>`).join('');
      const counts = {};
      const flagged = [];
      for (const o of Object.values(snap.series || {})) { counts[o.status] = (counts[o.status] || 0) + 1; if (['stale', 'check'].includes(o.status)) flagged.push(`${o.label}: ${o.status} ${(o.flags || []).join(', ')} (obs ${o.obsDate || '?'})`); }
      $('quality').innerHTML = `<p class="lede">Series status: ${Object.entries(counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>${flagged.length ? `<p class="warn">Needs attention:<br>${flagged.map(esc).join('<br>')}</p>` : ''}`;
      await list();
    } catch (e) {
      $('login').hidden = false; $('main-ui').hidden = true;
      if (token) { $('login-err').hidden = false; $('login-err').textContent = e.message; }
    }
  }

  async function list() {
    const items = await api('briefings');
    $('list').innerHTML = items.map(card).join('') || '<div class="card"><p class="lede">No drafts yet.</p></div>';
  }

  function card(b) {
    const editable = b.status === 'draft';
    const pill = { draft: 'warn', approved: 'ok', superseded: 'neutral', rejected: 'bad', withdrawn: 'neutral' }[b.status] || 'neutral';
    return `<div class="card" data-id="${esc(b.id)}">
      <div class="row2" style="justify-content:space-between"><h3>${b.mode === 'weekly' ? 'Weekly review' : 'Daily briefing'} · ${esc(b.createdAtLabel || b.createdAt)}</h3><span class="pill ${pill}">${esc(b.status)}${b.approvedBy ? ' by ' + esc(b.approvedBy) : ''}</span></div>
      <p class="lede">Generator: ${esc(b.generator)} · Data snapshot ${esc(b.snapshotAt)}${b.aiRejected ? ` · AI draft rejected by grounding checks (${esc(b.aiRejected.join('; '))}); showing the fact-only draft` : ''}</p>
      ${(b.warnings || []).map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
      ${b.items.map((it, i) => `<div class="card" style="padding:12px">
        <label for="h-${b.id}-${i}">Headline</label><input id="h-${b.id}-${i}" data-f="headline" data-i="${i}" value="${esc(it.headline)}" ${editable ? '' : 'disabled'}>
        <label for="w-${b.id}-${i}">What happened</label><textarea id="w-${b.id}-${i}" data-f="what" data-i="${i}" ${editable ? '' : 'disabled'}>${esc(it.what)}</textarea>
        <label for="y-${b.id}-${i}">Why it matters</label><textarea id="y-${b.id}-${i}" data-f="why" data-i="${i}" ${editable ? '' : 'disabled'}>${esc(it.why)}</textarea>
        <p class="hist">Sources: ${(it.sources || []).map((s) => `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ') || '—'} · Facts: ${esc((it.factIds || []).join(', '))}</p>
      </div>`).join('')}
      <details class="facts"><summary>Facts this draft was built from (${b.facts ? b.facts.length : 0})</summary>${(b.facts || []).map((f) => `<div>${esc(f.id)} · ${esc(f.text)}</div>`).join('')}</details>
      ${editable ? `<div class="row2"><button class="btn secondary" data-do="save">Save edits</button></div>
      <div class="row2"><label for="rv-${b.id}" style="flex-basis:100%">Reviewer name (required to approve)</label><input id="rv-${b.id}" data-rv style="max-width:320px" placeholder="e.g. Clement Tang"><button class="btn" data-do="approve">Approve and publish</button><button class="btn secondary" data-do="reject">Reject</button></div>` : ''}
      ${b.status === 'approved' ? `<div class="row2"><button class="btn secondary" data-do="share">Copy WhatsApp text</button><button class="btn secondary" data-do="withdraw">Withdraw</button></div>` : ''}
      <p class="hist">${(b.history || []).map((h) => `${esc(h.at)} ${esc(h.action)}${h.by ? ' by ' + esc(h.by) : ''}`).join(' · ')}</p>
    </div>`;
  }

  function collect(cardEl, b) {
    const items = JSON.parse(JSON.stringify(b.items));
    cardEl.querySelectorAll('[data-f]').forEach((el) => { items[+el.dataset.i][el.dataset.f] = el.value.trim(); });
    return items;
  }

  document.addEventListener('click', async (e) => {
    const gen = e.target.closest('[data-gen]');
    if (gen) {
      $('gen-msg').textContent = 'Preparing draft…';
      try { const b = await api('briefings/generate', { method: 'POST', body: JSON.stringify({ mode: gen.dataset.gen, useAi: $('useAi').checked }) }); $('gen-msg').textContent = `Draft prepared (${b.generator}).`; await list(); } catch (err) { $('gen-msg').textContent = err.message; }
      return;
    }
    const act = e.target.closest('[data-do]');
    if (!act) return;
    const cardEl = act.closest('[data-id]'); const id = cardEl.dataset.id;
    const all = await api('briefings'); const b = all.find((x) => x.id === id);
    const reviewer = (cardEl.querySelector('[data-rv]') || {}).value || '';
    try {
      if (act.dataset.do === 'save') await api('briefings/' + id, { method: 'PATCH', body: JSON.stringify({ items: collect(cardEl, b), reviewer: reviewer || 'editor' }) });
      if (act.dataset.do === 'approve') {
        if (!reviewer.trim()) return alertMsg(cardEl, 'Enter your name to approve.');
        await api('briefings/' + id, { method: 'PATCH', body: JSON.stringify({ items: collect(cardEl, b), reviewer }) });
        await api('briefings/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'approved', reviewer }) });
      }
      if (act.dataset.do === 'reject') await api('briefings/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'rejected', reviewer: reviewer || 'reviewer' }) });
      if (act.dataset.do === 'withdraw') await api('briefings/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn', reviewer: reviewer || 'reviewer' }) });
      if (act.dataset.do === 'share') { const s = await api('briefings/' + id + '/share'); await navigator.clipboard.writeText(s.text).catch(() => {}); return alertMsg(cardEl, 'WhatsApp text copied.'); }
      await list();
    } catch (err) { alertMsg(cardEl, err.message); }
  });
  function alertMsg(el, msg) { let p = el.querySelector('.msg'); if (!p) { p = document.createElement('p'); p.className = 'warn msg'; el.appendChild(p); } p.textContent = msg; }

  $('go').addEventListener('click', () => { token = $('token').value.trim(); start(); });
  $('token').addEventListener('keydown', (e) => { if (e.key === 'Enter') { token = $('token').value.trim(); start(); } });
  $('reload').addEventListener('click', start);
  if (token) start();
})();
