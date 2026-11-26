'use strict';
(function () {
  // The preview of a redesign (…/preview/) keeps its own copy of the book, so an older app at the main address never sees its pictures.
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
  let kept = null;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((k) => { kept = !!k; }).catch(() => { kept = false; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------- the shell: one header, a button in each corner at most ----------
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
  // bottom sheet
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

  // ---------- sync: a small dot next to the title ----------
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

  // ---------- home ----------
  let screen = 'home';
  const APPS = window.PHONE_APPS || [];
  function render() {
    if (page !== 'home') return;
    corner('tl', null);
    if (screen === 'signin') { corner('tr', null); drawSignIn(); } else drawHome();
  }
  async function drawSignIn() {
    const repo = (await E.status()).repo || '';
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
    const sent = last.split(/(?<=[.!?…])\s+/).filter(Boolean);
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
  async function drawHome() {
    const s = await E.status();
    if (!s.signedIn) { screen = 'signin'; return drawSignIn(); }
    const seq = ++homeSeq;
    corner('tr', { icon: 'settings', label: 'This phone: sync and key', fn: settings });
    const [ch, pick, n] = await Promise.all([lastChapter(), worldPick(), counts()]);
    if (seq !== homeSeq) return;
    const url = pick ? await picURL(pick.pic) : null;
    if (seq !== homeSeq) { if (url) URL.revokeObjectURL(url); return; }
    if (picUrl) URL.revokeObjectURL(picUrl); picUrl = url;
    const now = new Date();
    const frag = document.createDocumentFragment();
    const head = el('section', 'hello');
    head.appendChild(el('div', 'h-date', esc(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))));
    head.appendChild(el('h1', 'h-greet', esc(greeting(now))));
    frag.appendChild(head);
    if (ch) {
      const a = el('a', 'hero');
      a.href = 'writer.html';
      a.innerHTML = '<span class="k">Continue writing</span>' +
        '<span class="where">' + esc((ch.n ? 'Chapter ' + ROMAN(ch.n) : '') + (ch.book ? ' · Book ' + ROMAN(ch.book) : '')) + '</span>' +
        '<span class="ct">' + esc(ch.title) + '</span>' +
        (ch.last ? '<span class="last">' + esc(ch.last) + '</span>' : '') +
        '<span class="meta"><span>' + esc(ch.words.toLocaleString('en-GB') + ' words' + (ch.touched ? ' · ' + ago(ch.touched) : '')) + '</span><span class="go">' + IC('chevron-right', 20) + '</span></span>';
      a.addEventListener('click', () => { try { if (ch.n != null) sessionStorage.setItem('writer-reopen', JSON.stringify({ n: ch.n, at: Date.now() })); } catch (e) { } });
      frag.appendChild(a);
    }
    if (pick) {
      const a = el('a', 'world' + (url ? '' : ' nopic'));
      a.href = 'wiki.html';
      a.innerHTML = (url ? '<span class="w-img"><img alt="" src="' + url + '"></span>' : '') +
        '<span class="w-txt"><span class="k">From your world · ' + esc(pick.folder) + '</span><span class="w-t">' + esc(pick.title) + '</span>' +
        (pick.line ? '<span class="w-l">' + esc(pick.line) + '</span>' : '') + '</span>';
      a.addEventListener('click', () => { try { localStorage.setItem('memphis.wiki.view', JSON.stringify({ kind: 'page', id: pick.id })); } catch (e) { } });
      frag.appendChild(a);
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
    frag.appendChild(tiles);
    view.innerHTML = ''; view.appendChild(frag);
  }

  // ---------- inner pages ----------
  let backFn = null;
  if (page !== 'home') {
    corner('tl', { icon: 'chevron-left', label: 'Memphis', fn: () => { if (backFn && backFn() === true) return; location.href = 'index.html'; } });
    borrowed.then(() => E.signedIn()).then((s) => { if (!s) location.href = 'index.html'; });
  }
  window.Phone = { engine: E, toast, el, esc, btn, syncNow, page,
    ui: { corner, title, sheet, closeSheet, icon: IC, onBack: (f) => { backFn = f; } } };
  borrowed.then(refresh).then(() => { render(); syncNow(false); });
})();
