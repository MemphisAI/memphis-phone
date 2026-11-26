'use strict';
(function () {
  const PREVIEW = /\/preview\//.test(location.pathname);
  const STORE = window.PhoneStore.idb(PREVIEW ? 'memphis-phone-preview' : undefined);
  const SM = window.SyncModel, E = window.PhoneEngine.create({ store: STORE, SyncModel: SM, PhoneGitHub: window.PhoneGitHub, fetch: window.fetch.bind(window) });
  const borrowed = !PREVIEW ? Promise.resolve() : (async () => {
    if (await STORE.get('meta', 'token')) return;
    const main = window.PhoneStore.idb();
    const repo = await main.get('meta', 'repo').catch(() => null), token = await main.get('meta', 'token').catch(() => null);
    if (repo && token) { await STORE.put('meta', 'repo', repo); await STORE.put('meta', 'token', token); }
  })().catch(() => {});
  const $ = (s) => document.querySelector(s);
  const IC = (n, s) => (window.BladesIcon ? window.BladesIcon(n, s || 22) : '');
  const view = $('#view'), badge = $('#t-badge'), toastEl = $('#toast'), back = $('#t-back'), titleEl = $('#t-title'), top = $('#top');
  const page = document.body.dataset.page || 'home';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(cls, label, fn, opts) { const b = el('button', 'bl-btn ' + cls, esc(label)); b.type = 'button'; if (opts && opts.disabled) b.disabled = true; b.addEventListener('click', fn); return b; }
  let toastT = null;
  function toast(text, ms) { toastEl.textContent = text; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 3500); }
  const PRESS = 'button, a[href], [role="button"], .chip, .tile, .hero, .world, .app, .sbtn, summary, select';
  let pressed = null, px0 = 0, py0 = 0;
  function letGo() {
    if (!pressed) return;
    const p = pressed; pressed = null;
    p.classList.remove('is-pressed'); p.classList.add('is-released');
    setTimeout(() => p.classList.remove('is-released'), 480);
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !e.target.closest) return;
    const t = e.target.closest(PRESS);
    if (!t || t.disabled || t.closest('[contenteditable="true"]')) return;
    letGo(); pressed = t; px0 = e.clientX; py0 = e.clientY;
    t.classList.remove('is-released'); t.classList.add('is-pressed');
  }, { passive: true, capture: true });
  document.addEventListener('pointermove', (e) => { if (pressed && Math.hypot(e.clientX - px0, e.clientY - py0) > 10) letGo(); }, { passive: true, capture: true });
  for (const ev of ['pointerup', 'pointercancel', 'dragstart']) document.addEventListener(ev, letGo, { passive: true, capture: true });
  window.addEventListener('scroll', letGo, { passive: true, capture: true });
  let hxLabel = null;
  function haptic() {
    try {
      if (navigator.vibrate) { navigator.vibrate(8); return; }
      if (!/iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) return;
      if (!hxLabel) {
        const id = 'hx-switch', inp = el('input');
        inp.type = 'checkbox'; inp.id = id; inp.setAttribute('switch', ''); inp.tabIndex = -1;
        hxLabel = el('label', 'hx'); hxLabel.htmlFor = id; hxLabel.setAttribute('aria-hidden', 'true');
        hxLabel.appendChild(inp); document.body.appendChild(hxLabel);
      }
      hxLabel.click();
    } catch (e) { }
  }
  let kept = null;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((k) => { kept = !!k; }).catch(() => { kept = false; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  document.body.classList.add('ui');
  const ttl = el('span', 'tt'); ttl.textContent = titleEl.textContent; titleEl.textContent = '';
  const sub = el('span', 'ts');
  const tline = el('span', 'tline'); tline.append(ttl, badge);
  titleEl.append(tline, sub);
  badge.textContent = '';
  const right = el('button', 'corner', ''); right.type = 'button'; right.id = 't-right'; right.hidden = true;
  top.appendChild(right);
  back.className = 'corner'; back.innerHTML = IC('chevron-left', 22); back.setAttribute('aria-label', 'Back');
  const corners = { tl: back, tr: right };
  for (const k of ['bl', 'br']) { const b = el('button', 'fab-c ' + k, ''); b.type = 'button'; b.hidden = true; document.body.appendChild(b); corners[k] = b; }
  const fns = {};
  for (const k of Object.keys(corners)) corners[k].addEventListener('click', (e) => { if (fns[k]) fns[k](e); });
  function corner(k, o) {
    const b = corners[k];
    if (!o) { b.hidden = true; fns[k] = null; return b; }
    b.hidden = false; fns[k] = o.fn;
    b.innerHTML = IC(o.icon, k === 'tl' || k === 'tr' ? 22 : 24);
    b.setAttribute('aria-label', o.label || ''); b.title = o.label || '';
    b.classList.toggle('gold', !!o.gold);
    document.body.classList.toggle('has-' + k, true);
    return b;
  }
  function title(t, s) { ttl.textContent = t || ''; sub.textContent = s || ''; sub.hidden = !s; }
  sub.hidden = true;
  let sheetEl = null;
  function closeSheet() { if (!sheetEl) return; const s = sheetEl; sheetEl = null; s.classList.remove('on'); setTimeout(() => s.remove(), 220); }
  function sheet(o) {
    closeSheet();
    const wrap = el('div', 'sheetwrap'), scrim = el('div', 'sh-scrim'), card = el('div', 'sh-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', o.title || 'Menu');
    card.appendChild(el('div', 'sh-grab'));
    if (o.title) card.appendChild(el('div', 'sh-title', esc(o.title)));
    if (o.body) card.appendChild(o.body);
    for (const it of o.items || []) {
      if (!it) continue;
      if (it.sep) { card.appendChild(el('div', 'sh-sep')); continue; }
      const b = el('button', 'sh-item' + (it.gold ? ' gold' : ''), (it.icon ? '<span class="ic">' + IC(it.icon, 20) + '</span>' : '<span class="ic"></span>') +
        '<span class="tx"><span class="lb">' + esc(it.label) + '</span>' + (it.sub ? '<span class="sb">' + esc(it.sub) + '</span>' : '') + '</span>');
      b.type = 'button'; if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => { if (!it.keep) closeSheet(); it.fn && it.fn(); });
      card.appendChild(b);
    }
    scrim.addEventListener('click', closeSheet);
    wrap.append(scrim, card); document.body.appendChild(wrap);
    sheetEl = wrap; requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('on')));
    return { close: closeSheet, card };
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  let st = { pending: 0, running: false, lastError: null, signedIn: false };
  function drawBadge() {
    badge.className = 'sdot' + (st.running ? ' run' : st.lastError ? ' bad' : st.pending ? ' wait' : '');
    badge.textContent = !st.running && st.pending ? String(st.pending) : '';
    badge.hidden = !st.signedIn;
    const line = st.running ? 'Syncing' : st.lastError ? 'Not synced: ' + st.lastError : st.pending ? st.pending + ' not synced yet' : 'All synced';
    badge.setAttribute('aria-label', line + '. Tap to sync.'); badge.title = line;
  }
  async function refresh() { st = Object.assign(st, await E.status()); drawBadge(); if (page === 'home' && screen === 'home') drawHome(); }
  E.on((ev) => {
    if (ev.running != null) st.running = ev.running;
    if (ev.pending != null) st.pending = ev.pending;
    if (ev.running === false) { st.lastError = ev.ok ? null : ev.error; if (ev.ok && ev.pulled) document.dispatchEvent(new CustomEvent('phone-synced', { detail: ev })); }
    drawBadge();
    if (ev.running === false) refresh();
    if (ev.pending != null && ev.running == null) soon();
  });
  badge.addEventListener('click', () => { if (st.signedIn) syncNow(true); });
  let soonT = null;
  function soon() { clearTimeout(soonT); soonT = setTimeout(() => syncNow(false), 4000); }
  async function syncNow(loud) {
    if (!(await E.signedIn())) return null;
    if (loud) toast('Syncing with GitHub…', 1500);
    const r = await E.sync();
    if (loud || (!r.ok && r.kind === 'key')) {
      if (r.ok) toast(r.copies && r.copies.length ? 'Synced. ' + r.copies.length + ' changed on both sides: yours is kept beside it.' : 'All synced.');
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
    corner('tl', null);
    if (screen === 'signin') { corner('tr', null); drawSignIn(); } else drawHome();
  }
  async function drawSignIn() {
    const repo = (await E.status()).repo || '';
    document.body.classList.remove('hearth'); tline.appendChild(badge); homeSig = '';
    view.innerHTML = '';
    const box = el('section', 'signin');
    box.appendChild(el('div', 'si-mark', IC('book', 34)));
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
        const r = await syncNow(false);
        render();
        if (r && r.ok) toast('The book is on this phone. It works offline from now on.', 5000);
      } catch (e) { msg.textContent = e.message || String(e); go.disabled = false; }
    });
    box.appendChild(f1); box.appendChild(f2); box.appendChild(go); box.appendChild(msg);
    view.appendChild(box);
  }
  function greeting(d) {
    const h = d.getHours();
    return h < 5 ? 'Still up, Sir?' : h < 12 ? 'Good morning, Sir.' : h < 17 ? 'Good afternoon, Sir.' : h < 23 ? 'Good evening, Sir.' : 'Late night, Sir.';
  }
  function ago(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' minutes ago';
    if (s < 86400 * 1.5) return Math.round(s / 3600) + (Math.round(s / 3600) === 1 ? ' hour ago' : ' hours ago');
    if (s < 86400 * 14) return Math.round(s / 86400) + ' days ago';
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  }
  const ROMAN = (n) => { let r = '', x = Number(n) || 0; for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (x >= v) { r += s; x -= v; } return r || String(n); };
  function frontmatter(t) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(t || ''); const o = {};
    if (!m) return { fm: o, body: t || '' };
    for (const line of m[1].split(/\r?\n/)) { const k = /^([A-Za-z_]+):\s*(.*)$/.exec(line); if (k) o[k[1]] = k[2].replace(/^"(.*)"$/, '$1'); }
    return { fm: o, body: t.slice(m[0].length) };
  }
  const prose = (body) => String(body || '').replace(/<!--[\s\S]*?-->/g, '\n').replace(/\[\[\s*note:[\s\S]*?\]\]/gi, '\n').replace(/\r/g, '');
  async function lastChapter() {
    let best = null;
    for (const p of await E.list('Manuscript')) {
      if (!/^Manuscript\/Ch-[^/]+\.md$/i.test(p) || SM.isCopy(p)) continue;
      const { fm, body } = frontmatter(await E.read(p));
      const t = Number(fm.touched) || 0;
      if (!best || t > best.t) best = { t, fm, body };
    }
    if (!best) return null;
    const text = prose(best.body);
    const paras = text.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 20);
    let last = paras.length ? paras[paras.length - 1] : '';
    const sent = last.replace(/([.!?…])\s+/g, '$1\u0001').split('\u0001').filter(Boolean);
    last = sent.length ? sent[sent.length - 1] : last;
    if (last.length > 150) last = '…' + last.slice(-150).replace(/^\S*\s/, '');
    return { n: Number(best.fm.chapter) || null, book: Number(best.fm.book) || null, title: best.fm.title || 'Untitled chapter', touched: best.t,
      words: (String(best.body).replace(/<!--[\s\S]*?-->/g, ' ').match(/\S+/g) || []).length, last };
  }
  const PIC = /!\[\[([^\]|]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]/i;
  async function worldPick() {
    const have = new Set((await E.list('Evrynthing/Media')).filter((p) => E.isBin(p)).map((p) => p.split('/').pop()));
    if (!have.size) return null;
    const cands = [];
    for (const p of await E.list('Evrynthing')) {
      const x = p.split('/');
      if (x.length !== 3 || !/^\d\d /.test(x[1]) || !/\.md$/i.test(p)) continue;
      const t = await E.read(p); const m = PIC.exec(t || '');
      if (!m || !have.has(m[1].trim())) continue;
      const { body } = frontmatter(t);
      const h = /^#\s+(.+)$/m.exec(body);
      const line = (body.replace(/^#.*$/m, '').split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !/^[>#!-]/.test(s)) || '').replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');
      cands.push({ id: x[2].replace(/\.md$/i, ''), title: h ? h[1].trim() : x[2].replace(/^eV - |\.md$/g, ''), line, pic: m[1].trim(), folder: x[1].replace(/^\d\d /, '') });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.id.localeCompare(b.id));
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return cands[day % cands.length];
  }
  async function picURL(name) {
    const b64 = await E.readBin('Evrynthing/Media/' + name); if (!b64) return null;
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ext = name.split('.').pop().toLowerCase();
    return URL.createObjectURL(new Blob([u], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg' }));
  }
  async function counts() {
    const out = {};
    const all = await E.list();
    out.wiki = all.filter((p) => { const x = p.split('/'); return x[0] === 'Evrynthing' && x.length === 3 && /^\d\d /.test(x[1]) && /\.md$/i.test(p) && !SM.isCopy(p); }).length;
    let waiting = 0; const ids = new Set(), verdicts = new Set();
    for (const p of all.filter((x) => x.indexOf(SM.CANON_DIR + '/changesets/') === 0 && /\.json$/i.test(x) && !SM.isCopy(x))) {
      let o = null; try { o = JSON.parse(await E.read(p)); } catch (e) { continue; }
      if (!o || !o.id) continue;
      if (/\.verdict\.json$/i.test(p)) verdicts.add(o.id); else if (o.state !== 'applied') ids.add(o.id);
    }
    for (const id of ids) if (!verdicts.has(id)) waiting++;
    out.changes = waiting;
    if (window.CanonModel) {
      try {
        const files = [];
        for (const p of all) { const r = p.slice(SM.WORKBENCH.length + 1).split('/'); if (p.indexOf(SM.WORKBENCH + '/') === 0 && r.length === 2 && !r[0].startsWith('.') && /\.md$/i.test(r[1])) files.push({ rel: r.join('/'), text: await E.read(p) }); }
        let state = null; try { state = JSON.parse(await E.read(SM.DECISIONS) || 'null'); } catch (e) { state = null; }
        const pr = window.CanonModel.progress(window.CanonModel.build(files), state || window.CanonModel.emptyState());
        out.canon = pr.left; out.canonTotal = pr.total;
      } catch (e) { console.error(e); }
    }
    return out;
  }
  let homeSeq = 0, picUrl = null;
  function settings() {
    E.status().then((s) => {
      const body = el('div', 'sh-body');
      const line = s.running ? 'Syncing with GitHub…' : s.lastError ? 'Not synced: ' + s.lastError : s.pending ? s.pending + (s.pending === 1 ? ' change is' : ' changes are') + ' not synced yet.' : s.lastOk ? 'All synced, ' + SM.statusLine({ enabled: true, lastOk: s.lastOk }).replace(/^Synced with GitHub /, '').replace(/\.$/, '') + '.' : 'Not synced yet.';
      body.appendChild(el('p', 'sh-line', esc(line)));
      body.appendChild(el('p', 'sh-fine', esc(s.files + ' files on this phone from ' + s.repo + '.') + (s.lastTook && s.lastTook.ms != null ? ' ' + esc('The last sync took ' + Math.max(1, Math.round(s.lastTook.ms / 1000)) + ' s: ' + (s.lastTook.pulled || 0) + ' in, ' + (s.lastTook.pushed || 0) + ' out.') : '') +
        (kept === false ? ' This phone may clear them if it runs short of space: sync often.' : '')));
      sheet({ title: 'This phone', body, items: [
        { icon: 'review', label: 'Sync now', fn: () => syncNow(true), gold: true },
        s.pending ? { icon: 'export', label: 'Export unsynced', sub: 'Share or copy what is not on GitHub yet', fn: exportUnsynced } : null,
        { icon: 'settings', label: 'Change key', sub: 'Sign in again with a new GitHub key', fn: () => { screen = 'signin'; render(); } },
      ] });
    });
  }
  const ROOMS = [{ id: 'hearth', name: 'The Hearth' }, { id: 'book', name: 'The Book' }];
  let flockFrame = null, roomsEl = null, dotsEl = null, roomNow = 0, homeSig = '';
  function flockStart() {
    if (flockFrame || page !== 'home') return;
    const f = el('iframe', 'flockbg'); f.src = 'flock/flock.html'; f.title = 'Memphis'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.addEventListener('load', () => {
      try {
        const d = f.contentDocument, w = f.contentWindow;
        const st = d.createElement('style');
        st.textContent = 'body>*:not(#gl){display:none!important}#gl{touch-action:none}body{background:#060605!important;cursor:default}';
        d.head.appendChild(st);
        if (w.__flockSuits) w.__flockSuits(true);
        const cam = w.__flockCam;
        if (cam) {
          let to = 30.5; try { const z = +(w.FLOCK_TUNING && w.FLOCK_TUNING.view && w.FLOCK_TUNING.view.startZoom); if (z >= 10 && z <= 100) to = z; } catch (e) { }
          const tall = () => f.clientWidth < f.clientHeight;
          flockZ.wake = () => { const a = f.clientWidth / Math.max(1, f.clientHeight); return tall() ? Math.min(110, Math.max(to * 0.5, to * 0.3 / a)) : to; };
          flockZ.cam = cam; flockZ.w = w;
          cam.position.z = flockZ.wake() * 1.45; flockZoom(flockZ.wake(), 0.008);
          w.addEventListener('resize', () => { cam.position.z = flockZ.wake(); });
        }
        flockState('listening');
        w.__flockPaused = roomNow !== 0 || document.visibilityState !== 'visible';
        f.classList.add('on');
      } catch (e) { console.error(e); }
    });
    document.body.insertBefore(f, document.body.firstChild);
    flockFrame = f;
    document.addEventListener('visibilitychange', flockPause);
  }
  const flockZ = {}; let zoomRun = 0;
  function flockZoom(goal, step) {
    const cam = flockZ.cam, w = flockZ.w; if (!cam) return;
    const run = ++zoomRun, from = cam.position.z; let t = 0;
    (function z() { if (run !== zoomRun) return; t = Math.min(1, t + (step || 0.01)); const e = t * t * (3 - 2 * t); cam.position.z = from + (goal - from) * e; if (t < 1) w.requestAnimationFrame(z); })();
  }
  function flockState(name) { try { const b = flockFrame.contentDocument.querySelector('.sbtn[data-s="' + name + '"]'); if (b) b.click(); } catch (e) { } }
  function flockPause() { try { if (flockFrame && flockFrame.contentWindow) flockFrame.contentWindow.__flockPaused = roomNow !== 0 || document.visibilityState !== 'visible'; } catch (e) { } }
  function onRooms() {
    if (!roomsEl) return;
    const w = roomsEl.clientWidth || 1, x = roomsEl.scrollLeft / w;
    if (flockFrame) flockFrame.style.opacity = String(Math.max(0, 1 - x * 1.15));
    const i = Math.round(x);
    if (i !== roomNow) { const was = roomNow; roomNow = i; try { sessionStorage.setItem('home-room', String(i)); } catch (e) { } if (was >= 0) haptic(); flockPause(); }
    if (dotsEl) [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === i));
    document.body.classList.toggle('in-book', i === 1);
  }
  function appsMenu(n) {
    const body = el('div', 'appgrid');
    const subs = { canon: n.canon != null ? n.canon.toLocaleString('en-GB') + ' decisions left' : '', wiki: n.wiki + ' pages', changes: n.changes ? n.changes + ' waiting' : 'Nothing waiting', writer: 'The book' };
    for (const a of APPS) {
      const t = el('a', 'app'); t.href = a.href;
      t.innerHTML = (window.BladesCoin ? window.BladesCoin(a.id === 'changes' ? 'review' : a.id, 52) : '') + '<span class="nm">' + esc(a.label) + '</span><span class="sb">' + esc(subs[a.id] || '') + '</span>';
      body.appendChild(t);
    }
    sheet({ title: 'Menu', body });
  }
  async function drawHome() {
    const s = await E.status();
    if (!s.signedIn) { screen = 'signin'; return drawSignIn(); }
    const seq = ++homeSeq;
    document.body.classList.add('hearth');
    corner('tr', null);
    const [ch, pick, n] = await Promise.all([lastChapter(), worldPick(), counts()]);
    if (seq !== homeSeq) return;
    const sig = JSON.stringify([ch, pick && pick.id, pick && pick.pic, n, st.pending, greeting(new Date()), new Date().toDateString()]);
    if (sig === homeSig && roomsEl && roomsEl.isConnected) return;
    const url = pick ? await picURL(pick.pic) : null;
    if (seq !== homeSeq) { if (url) URL.revokeObjectURL(url); return; }
    if (picUrl) URL.revokeObjectURL(picUrl); picUrl = url;
    homeSig = sig;
    const now = new Date();
    const frag = document.createDocumentFragment();
    const bar = el('header', 'hbar');
    const brand = el('div', 'hb-brand', '<img class="logo" src="branding/blades-logo-dark.svg" alt=""><span class="wm">Memphis</span>');
    const date = el('div', 'hb-date', '<span>' + esc(now.toLocaleDateString('en-GB', { weekday: 'short' })) + '</span>');
    const dl = el('div', 'hb-dl', esc(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))); dl.appendChild(badge); date.appendChild(dl);
    const left = el('div', 'hb-left'); left.append(brand, date);
    const menu = el('button', 'hb-menu', IC('menu', 16) + '<span>Menu</span>'); menu.type = 'button'; menu.addEventListener('click', () => appsMenu(n));
    const hub = el('button', 'hb-hub', IC('settings', 20)); hub.type = 'button'; hub.setAttribute('aria-label', 'This phone: sync and key'); hub.addEventListener('click', settings);
    bar.append(left, menu, hub);
    frag.appendChild(bar);
    roomsEl = el('div', 'rooms');
    const hearth = el('section', 'room r-hearth'); hearth.setAttribute('aria-label', 'The Hearth');
    const low = el('div', 'h-low');
    low.appendChild(el('h1', 'h-greet', esc(greeting(now))));
    const wait = [];
    if (n.changes) wait.push({ href: 'changes.html', b: n.changes, t: n.changes === 1 ? 'change set waiting' : 'change sets waiting', hot: true });
    if (n.canon) wait.push({ href: 'canon.html', b: n.canon.toLocaleString('en-GB'), t: 'canon decisions left' });
    if (st.pending) wait.push({ fn: () => syncNow(true), b: st.pending, t: 'not synced yet', hot: true });
    const wl = el('div', 'h-wait');
    if (!wait.length) wl.appendChild(el('span', 'calm', 'Nothing is waiting for you.'));
    for (const w of wait) {
      const a = el(w.href ? 'a' : 'button', 'chip' + (w.hot ? ' hot' : ''), '<b>' + esc(w.b) + '</b> ' + esc(w.t));
      if (w.href) a.href = w.href; else { a.type = 'button'; a.addEventListener('click', w.fn); }
      wl.appendChild(a);
    }
    low.appendChild(wl);
    const hint = el('button', 'h-next', '<span>The Book</span>' + IC('chevron-right', 16)); hint.type = 'button';
    hint.addEventListener('click', () => roomsEl.scrollTo({ left: roomsEl.clientWidth, behavior: 'smooth' }));
    low.appendChild(hint);
    hearth.appendChild(low);
    roomsEl.appendChild(hearth);
    const book = el('section', 'room r-book'); book.setAttribute('aria-label', 'The Book');
    const bh = el('div', 'r-head', '<span class="k">The Book</span><h2>Evrynthing</h2>');
    book.appendChild(bh);
    if (ch) {
      const a = el('a', 'hero');
      a.href = 'writer.html';
      a.innerHTML = '<span class="k">Continue writing</span>' +
        '<span class="where">' + esc((ch.n ? 'Chapter ' + ROMAN(ch.n) : '') + (ch.book ? ' · Book ' + ROMAN(ch.book) : '')) + '</span>' +
        '<span class="ct">' + esc(ch.title) + '</span>' +
        (ch.last ? '<span class="last">' + esc(ch.last) + '</span>' : '') +
        '<span class="meta"><span>' + esc(ch.words.toLocaleString('en-GB') + ' words' + (ch.touched ? ' · ' + ago(ch.touched) : '')) + '</span><span class="go">' + IC('chevron-right', 20) + '</span></span>';
      a.addEventListener('click', () => { try { if (ch.n != null) sessionStorage.setItem('writer-reopen', JSON.stringify({ n: ch.n, at: Date.now() })); } catch (e) { } });
      book.appendChild(a);
    }
    if (pick) {
      const a = el('a', 'world' + (url ? '' : ' nopic'));
      a.href = 'wiki.html';
      a.innerHTML = (url ? '<span class="w-img"><img alt="" src="' + url + '"></span>' : '') +
        '<span class="w-txt"><span class="k">From your world · ' + esc(pick.folder) + '</span><span class="w-t">' + esc(pick.title) + '</span>' +
        (pick.line ? '<span class="w-l">' + esc(pick.line) + '</span>' : '') + '</span>';
      a.addEventListener('click', () => { try { sessionStorage.setItem('wiki-open', JSON.stringify({ kind: 'page', id: pick.id })); } catch (e) { } });
      book.appendChild(a);
    }
    const tiles = el('nav', 'tiles');
    const info = {
      wiki: { icon: 'tool-wiki', n: n.wiki, unit: n.wiki === 1 ? 'page' : 'pages' },
      canon: { icon: 'tool-canon', n: n.canon, unit: 'decisions left' },
      changes: n.changes > 0 ? { icon: 'review', n: n.changes, unit: 'waiting for you', hot: true } : { icon: 'review', n: null, unit: 'Nothing waiting' },
      writer: { icon: 'pen', n: null, unit: 'Chapters and plates' },
    };
    for (const a of APPS) {
      if (a.id === 'writer' && ch) continue;
      const x = info[a.id] || { icon: 'apps' };
      const t = el('a', 'tile' + (x.hot ? ' hot' : ''));
      t.href = a.href;
      t.innerHTML = '<span class="t-ic">' + IC(x.icon, 22) + '</span><span class="t-nm">' + esc(a.label) + '</span>' +
        '<span class="t-n">' + (x.n != null ? '<b>' + esc(x.n.toLocaleString('en-GB')) + '</b> ' : '') + esc(x.unit || a.sub || '') + '</span>';
      tiles.appendChild(t);
    }
    book.appendChild(tiles);
    roomsEl.appendChild(book);
    frag.appendChild(roomsEl);
    dotsEl = el('div', 'room-dots');
    ROOMS.forEach((r, k) => { const d = el('button', '', ''); d.type = 'button'; d.setAttribute('aria-label', r.name); d.addEventListener('click', () => roomsEl.scrollTo({ left: k * roomsEl.clientWidth, behavior: 'smooth' })); dotsEl.appendChild(d); });
    frag.appendChild(dotsEl);
    const keep = roomsEl;
    view.innerHTML = ''; view.appendChild(frag);
    roomsEl.addEventListener('scroll', onRooms, { passive: true });
    window.addEventListener('resize', () => { if (keep === roomsEl) roomsEl.scrollLeft = roomNow * roomsEl.clientWidth; });
    let back = Math.max(0, roomNow); try { const v = sessionStorage.getItem('home-room'); if (v != null) back = +v || 0; } catch (e) { }
    roomsEl.scrollLeft = back * roomsEl.clientWidth; roomNow = -1; onRooms();
    setTimeout(flockStart, 250);
  }
  let backFn = null;
  if (page !== 'home') {
    corner('tl', { icon: 'chevron-left', label: 'Memphis', fn: () => { if (backFn && backFn() === true) return; location.href = 'index.html'; } });
    borrowed.then(() => E.signedIn()).then((s) => { if (!s) location.href = 'index.html'; });
  }
  window.Phone = { engine: E, toast, el, esc, btn, syncNow, page,
    ui: { corner, title, sheet, closeSheet, icon: IC, haptic, onBack: (f) => { backFn = f; } } };
  borrowed.then(refresh).then(() => { render(); syncNow(false); });
})();
