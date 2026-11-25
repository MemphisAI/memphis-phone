'use strict';
(function () {
  const SM = window.SyncModel, E = window.PhoneEngine.create({ store: window.PhoneStore.idb(), SyncModel: SM, PhoneGitHub: window.PhoneGitHub, fetch: window.fetch.bind(window) });
  const $ = (s) => document.querySelector(s);
  const view = $('#view'), badge = $('#t-badge'), toastEl = $('#toast'), back = $('#t-back'), titleEl = $('#t-title');
  const page = document.body.dataset.page || 'home';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(cls, label, fn, opts) { const b = el('button', 'bl-btn ' + cls, esc(label)); b.type = 'button'; if (opts && opts.disabled) b.disabled = true; b.addEventListener('click', fn); return b; }
  let toastT = null;
  function toast(text, ms) { toastEl.textContent = text; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 3500); }
  let kept = null;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((k) => { kept = !!k; }).catch(() => { kept = false; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  let st = { pending: 0, running: false, lastError: null, signedIn: false };
  function drawBadge() {
    badge.className = 'badge' + (st.pending ? ' wait' : '') + (st.lastError && st.pending ? ' bad' : '');
    badge.textContent = !st.signedIn ? '' : st.running ? 'Syncing...' : st.pending ? st.pending + ' not synced' : st.lastError ? 'Not synced' : 'All synced';
    badge.title = st.lastError || '';
  }
  async function refresh() { st = Object.assign(st, await E.status()); drawBadge(); if (page === 'home' && screen === 'home') drawHome(); }
  E.on((ev) => {
    if (ev.running != null) st.running = ev.running;
    if (ev.pending != null) st.pending = ev.pending;
    if (ev.running === false) { st.lastError = ev.ok ? null : ev.error; if (ev.ok && ev.pulled) document.dispatchEvent(new CustomEvent('phone-synced', { detail: ev })); }
    if (ev.progress) badge.textContent = 'Syncing ' + ev.progress + ' of ' + ev.of + '...';
    else drawBadge();
    if (ev.running === false) refresh();
    if (ev.pending != null && ev.running == null) soon();
  });
  badge.addEventListener('click', () => { if (st.signedIn) syncNow(true); });
  let soonT = null;
  function soon() { clearTimeout(soonT); soonT = setTimeout(() => syncNow(false), 4000); }
  async function syncNow(loud) {
    if (!(await E.signedIn())) return null;
    const r = await E.sync();
    if (loud || (!r.ok && r.kind === 'key')) {
      if (r.ok) toast(r.copies && r.copies.length ? 'Synced. ' + r.copies.length + ' changed on both sides: yours is kept beside it.' : 'Synced with GitHub.');
      else toast(r.error, 6000);
    }
    if (!r.ok && r.kind === 'key' && page === 'home') { screen = 'signin'; render(); }
    return r;
  }
  window.addEventListener('online', () => syncNow(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(false); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(false); }, 5 * 60 * 1000);
  async function exportUnsynced() {
    const text = await E.exportText();
    if (!text) { toast('Everything is synced: nothing to export.'); return; }
    try { if (navigator.share) { await navigator.share({ title: 'Memphis: not synced yet', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into Notes to keep it safe.'); } catch (e) { toast('Could not share or copy here.'); }
  }
  let screen = 'home';
  const APPS = window.PHONE_APPS || [];
  function render() {
    if (page !== 'home') return;
    back.hidden = true; titleEl.textContent = 'Memphis';
    if (screen === 'signin') drawSignIn(); else drawHome();
  }
  async function drawSignIn() {
    const repo = (await E.status()).repo || '';
    view.innerHTML = '';
    const box = el('section', 'card signin');
    box.appendChild(el('h1', '', 'Memphis on this phone'));
    box.appendChild(el('p', 'sub', 'Sign in once with your book repository and its GitHub key. Both stay on this phone; the key is never sent anywhere but GitHub.'));
    const f1 = el('label', 'field', '<span>Repository</span>'), i1 = el('input');
    Object.assign(i1, { type: 'text', value: repo, placeholder: 'owner/name', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
    f1.appendChild(i1);
    const f2 = el('label', 'field', '<span>GitHub key</span>'), i2 = el('input');
    Object.assign(i2, { type: 'password', placeholder: 'Paste the key here', autocapitalize: 'off', autocomplete: 'off', spellcheck: false });
    f2.appendChild(i2);
    const msg = el('p', 'msg');
    const go = btn('gold lg wide', 'Sign in', async () => {
      go.disabled = true; msg.textContent = 'Checking with GitHub...';
      try {
        await E.signIn(i1.value, i2.value);
        i2.value = '';
        msg.textContent = 'Signed in. Taking the book in for the first time...';
        screen = 'home'; await refresh();
        const r = await syncNow(true);
        render();
        if (r && r.ok) toast('The book is on this phone. It works offline from now on.', 5000);
      } catch (e) { msg.textContent = e.message || String(e); go.disabled = false; }
    });
    box.appendChild(f1); box.appendChild(f2); box.appendChild(go); box.appendChild(msg);
    view.appendChild(box);
  }
  async function drawHome() {
    const s = await E.status();
    if (!s.signedIn) { screen = 'signin'; return drawSignIn(); }
    view.innerHTML = '';
    const menu = el('section', 'apps');
    if (!APPS.length) menu.appendChild(el('p', 'sub', 'The apps arrive here one by one. Canon comes first.'));
    for (const a of APPS) {
      const t = el('a', 'app', '<span class="nm">' + esc(a.label) + '</span><span class="ds">' + esc(a.sub || '') + '</span>');
      t.href = a.href;
      menu.appendChild(t);
    }
    view.appendChild(menu);
    const sy = el('section', 'card sync');
    const line = s.running ? 'Syncing with GitHub...' : s.pending ? s.pending + (s.pending === 1 ? ' change is' : ' changes are') + ' not synced yet.' : s.lastOk ? 'All synced, ' + SM.statusLine({ enabled: true, lastOk: s.lastOk }).replace(/^Synced with GitHub /, '').replace(/\.$/, '') + '.' : 'Not synced yet.';
    sy.appendChild(el('p', 'line', esc(line)));
    if (s.lastError) sy.appendChild(el('p', 'msg', esc(s.lastError)));
    if (s.lastTook && s.lastTook.ms != null) sy.appendChild(el('p', 'fine', esc('The last sync took ' + Math.max(1, Math.round(s.lastTook.ms / 1000)) + ' s (taking in ' + Math.round((s.lastTook.pullMs || 0) / 1000) + ' s): ' + (s.lastTook.pulled || 0) + ' in, ' + (s.lastTook.pushed || 0) + ' out.')));
    const row = el('div', 'row');
    row.appendChild(btn('gold', 'Sync now', () => syncNow(true), { disabled: s.running }));
    if (s.pending) row.appendChild(btn('coal', 'Export unsynced', exportUnsynced));
    sy.appendChild(row);
    sy.appendChild(el('p', 'fine', esc(s.files + ' files on this phone from ' + s.repo + '.') + (kept === false ? ' This phone may clear them if it runs short of space: sync often.' : '')));
    const r2 = el('div', 'row');
    r2.appendChild(btn('ghost', 'Change key', () => { screen = 'signin'; render(); }));
    sy.appendChild(r2);
    view.appendChild(sy);
  }
  if (page !== 'home') {
    back.hidden = false;
    back.addEventListener('click', () => { location.href = 'index.html'; });
    E.signedIn().then((s) => { if (!s) location.href = 'index.html'; });
  }
  window.Phone = { engine: E, toast, el, esc, btn, syncNow, page };
  refresh().then(() => { render(); syncNow(false); });
})();
