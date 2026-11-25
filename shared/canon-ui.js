'use strict';
(function () {
  const M = window.CanonModel, API = window.canonAPI;
  const PHONE = !!API.phone;
  const $ = (id) => document.getElementById(id);
  const view = $('view'), crumb = $('crumb'), home = $('b-home'), toastEl = $('toast');
  let model = { domains: [], byKey: {} }, state = M.emptyState(), where = '', error = '';
  let screen = { name: 'home' };
  let pick = new Set(), editor = null;
  let editorText = '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(s) {
    let h = esc(s);
    h = h.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, n, l) => '<a href="#" class="src" data-note="' + n.trim() + '">' + (l || n).trim() + '</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    return h;
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(cls, label, fn, opts) {
    const b = el('button', 'bl-btn ' + cls); b.type = 'button'; b.textContent = label;
    if (opts && opts.disabled) b.disabled = true;
    if (opts && opts.key) b.title = label + ' (' + opts.key + ')';
    b.addEventListener('click', fn); return b;
  }
  let toastT = null;
  function toast(text, actions, ms) {
    toastEl.innerHTML = '';
    toastEl.appendChild(el('span', 'tx', esc(text)));
    const list = typeof actions === 'function' ? [{ label: 'Undo', fn: actions }] : (actions || []);
    for (const a of list) toastEl.appendChild(btn('ghost sm', a.label, () => { toastEl.classList.remove('on'); a.fn(); }));
    toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms || (list.length ? 9000 : 3500));
  }
  let chain = Promise.resolve();
  function commit(fn, done) {
    const run = chain.then(async () => {
      let next;
      try { next = fn(state); } catch (e) { toast(String(e.message || e)); return false; }
      const r = await API.save(next).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
      if (!r || !r.ok) { toast('Could not save: ' + ((r && r.error) || 'unknown')); return false; }
      state = r.state ? M.normState(r.state) : next;
      if (r.merged) toast('Answers from the phone were merged in');
      if (done) done(state); return true;
    });
    chain = run.catch(() => false);
    return run;
  }
  const save = (next, done) => commit(() => next, done);
  let ws = null, live = false, nextId = 0;
  const waiting = new Map();
  const placing = new Set();
  function b64(str) {
    const bytes = new TextEncoder().encode(str); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function connect() {
    try { ws = new WebSocket('ws://127.0.0.1:8777'); } catch (e) { setTimeout(connect, 2500); return; }
    ws.onopen = () => { live = true; soft(); };
    ws.addEventListener('open', () => placeFromPhone());
    ws.onmessage = (m) => {
      const raw = String(m.data || '');
      if (raw.indexOf('canon:') !== 0) return;
      let o; try { o = JSON.parse(unb64(raw.slice(6))); } catch (e) { return; }
      const w = waiting.get(o.id);
      if (w) { waiting.delete(o.id); clearTimeout(w.t); w.resolve(o); }
    };
    ws.onclose = () => { const was = live; live = false; ws = null; if (was) soft(); for (const [id, w] of waiting) { clearTimeout(w.t); w.reject(new Error('Memphis stopped answering.')); waiting.delete(id); } setTimeout(connect, 2500); };
    ws.onerror = () => { try { ws.close(); } catch (e) {   } };
  }
  function ask(action, payload, ms) {
    return new Promise((resolve, reject) => {
      if (!live || !ws || ws.readyState !== 1) { reject(new Error('Memphis is not running')); return; }
      const id = 'c' + Date.now().toString(36) + (++nextId);
      const t = setTimeout(() => { waiting.delete(id); reject(new Error('Memphis did not answer (he may be busy talking)')); }, ms || 25000);
      waiting.set(id, { resolve, reject, t });
      ws.send('savenote:' + b64(JSON.stringify(Object.assign({ action, id }, payload || {}))));
    }).then((r) => { if (!r || !r.ok) throw new Error((r && r.error) || 'Memphis could not do it'); return r; });
  }
  function short(t, n) { t = String(t || ''); return t.length > (n || 70) ? t.slice(0, (n || 70) - 3) + '...' : t; }
  function copyText(t) {
    const done = () => toast('Copied. Paste it into the note by hand.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
    else fallback();
    function fallback() { const ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); } ta.remove(); }
  }
  function placedToast(key, p) {
    const acts = [{ label: 'Undo', fn: () => takeBack(key, true) }];
    if (p.kind === 'copy') acts.unshift({ label: 'Copy line', fn: () => copyText(p.line) });
    toast(M.placeLabel(p) + (p.kind === 'copy' ? ': ' + short(p.line, 60) : ''), acts, p.kind === 'copy' ? 14000 : 9000);
  }
  async function place(key, quiet) {
    const dec = state.decisions[key]; if (!dec || placing.has(key)) return;
    placing.add(key); soft();
    try {
      const r = await ask('canon_place', { key, decision: M.placeRequest(model.byKey[key], dec), proposed: M.proposedTitles(state, key) }, 90000);
      const now = state.decisions[key];
      if (!now || now.at !== dec.at) {
        if (r.placed.kind === 'page') await ask('canon_unplace', { key, rel: r.placed.rel, mark: r.placed.mark }).catch(() => toast('A line Memphis placed on ' + r.placed.page + "'s page after you undid it could not be taken off: remove it there."));
        else if (r.placed.kind === 'proposed') toast('The card for ' + r.placed.title + ' reached the Sandbox after you undid it: discard it there.');
        return;
      }
      await commit((s) => M.setPlaced(s, key, r.placed, Date.now()));
      if (r.placed.kind === 'ask') toast('Memphis is not sure where "' + short(dec.subject, 40) + '" goes: choose on the card');
      else if (!quiet || r.placed.kind === 'copy') placedToast(key, r.placed);
    } catch (e) {
      toast('Kept in Canon, not yet in the wiki: ' + String(e.message || e) + '. Place it later from the Decision log.');
    } finally { placing.delete(key); soft(); }
  }
  let phoneRun = false;
  async function placeFromPhone() {
    if (PHONE || !live || phoneRun) return;
    const keys = Object.keys(state.decisions).filter((k) => state.decisions[k].from === 'phone' && !state.decisions[k].placed && model.byKey[k]);
    if (!keys.length) return;
    phoneRun = true;
    try {
      const ok = await commit((s) => { const n = M.normState(s); for (const k of keys) if (n.decisions[k]) n.decisions[k] = Object.assign({}, n.decisions[k], { from: 'phone, placed here' }); return n; });
      if (!ok) return;
      toast(keys.length + (keys.length === 1 ? ' answer' : ' answers') + ' from the phone: Memphis is placing ' + (keys.length === 1 ? 'it' : 'them') + ' in the wiki...');
      for (const k of keys) { if (!live) break; await place(k, true); }
    } finally { phoneRun = false; }
  }
  async function settle(key, option) {
    const dec = state.decisions[key]; if (!dec || placing.has(key)) return;
    placing.add(key); soft();
    try {
      const r = await ask('canon_apply', { key, option, decision: M.placeRequest(model.byKey[key], dec), proposed: M.proposedTitles(state, key) });
      await commit((s) => M.setPlaced(s, key, r.placed, Date.now()));
      placedToast(key, r.placed);
    } catch (e) { toast('Not placed: ' + String(e.message || e)); }
    finally { placing.delete(key); soft(); }
  }
  function leaveOut(key) { commit((s) => M.setPlaced(s, key, null), () => { soft(); toast('Kept in Canon only'); }); }
  function soft() { if (!editor) render(); }
  async function takeBack(key, stay) {
    const dec = state.decisions[key]; if (!dec) return;
    const p = dec.placed;
    if (p && p.kind === 'page' && PHONE) { toast('This one is on ' + p.page + "'s page: reopen it on Alaric, where Memphis can take the line off."); return; }
    if (p && p.kind === 'page') {
      try { await ask('canon_unplace', { key, rel: p.rel, mark: p.mark }); }
      catch (e) { toast('Could not take it off ' + p.page + "'s page: " + String(e.message || e) + '. The decision stays.'); return; }
    }
    await reopenKey(key, stay);
    if (p && p.kind === 'proposed') toast('Reopened. The card for ' + p.title + ' is still in the Sandbox: discard it there.');
    else if (p && p.kind === 'copy') toast('Reopened. If you pasted the line into ' + p.label + ', take it out there.');
    else if (p && p.kind === 'page') toast('Reopened, and taken off ' + p.page + "'s page.");
  }
  const checking = new Set();
  let checkAllRun = null;
  async function check(domainId, quiet) {
    if (checking.has(domainId) || !live) return 0;
    const req = M.settledRequest(model, state, domainId);
    checking.add(domainId); soft();
    try {
      const r = req.questions.length ? await ask('canon_settled', req, 180000) : { found: [] };
      await commit((st) => M.setSuggestions(st, domainId, r.found || [], Date.now()));
      const n = (r.found || []).length;
      if (!quiet) toast(n ? n + (n === 1 ? ' decision looks' : ' decisions look') + ' already settled: confirm or reject them first' : 'Nothing in ' + M.domainName(domainId) + ' looks settled yet');
      return n;
    } catch (e) { if (!quiet) toast('Could not check what is settled: ' + String(e.message || e)); return 0; }
    finally { checking.delete(domainId); soft(); }
  }
  async function checkAll() {
    const todo = model.domains.filter((d) => M.needsCheck(state, d.id)).map((d) => d.id);
    if (!todo.length || checkAllRun) return;
    let found = 0;
    checkAllRun = { at: 0, of: todo.length }; soft();
    for (const id of todo) { checkAllRun.at++; soft(); found += await check(id, true); if (!live) break; }
    checkAllRun = null; soft();
    toast(found ? found + (found === 1 ? ' decision looks' : ' decisions look') + ' already settled' : 'Nothing looks settled yet');
  }
  function confirmKeys(keys) {
    const now = Date.now();
    commit((st) => {
      let s2 = st;
      for (const k of keys) { const q = model.byKey[k], sug = s2.suggest[k]; if (q && sug && !sug.dismissed && !s2.decisions[k]) s2 = M.confirm(s2, q, sug, now); }
      return s2;
    }, () => { soft(); toast(keys.length === 1 ? 'Confirmed: it leaves the pile' : keys.length + ' confirmed: they leave the pile'); });
  }
  function reject(key) { commit((st) => M.dismiss(st, key, Date.now()), () => { soft(); toast('Not settled: it stays in the pile'); }); }
  function settledBox(domainId) {
    const list = M.suggestions(model, state, domainId);
    const busy = domainId ? checking.has(domainId) : !!checkAllRun;
    if (!list.length && !busy) return null;
    const box = el('section', 'settled');
    const head = el('div', 'hd');
    head.appendChild(el('h3', '', list.length ? esc(list.length === 1 ? 'Already settled?' : list.length + ' look already settled') : 'Looking for what is already settled...'));
    if (list.length > 1) head.appendChild(btn('gold sm', 'Confirm all ' + list.length, () => confirmKeys(list.map((x) => x.key))));
    box.appendChild(head);
    if (list.length) box.appendChild(el('p', 'sub', 'Memphis read the wiki and your decisions. Under each answer is the line that settles it. Confirm what is right; Not settled puts it back in the pile.'));
    if (busy) box.appendChild(el('p', 'busy', esc(checkAllRun ? 'Reading domain ' + checkAllRun.at + ' of ' + checkAllRun.of + '...' : 'Reading ' + M.domainName(domainId) + '...')));
    for (const it of list.slice(0, 40)) {
      const row = el('div', 'sug');
      row.innerHTML = '<div class="what">' + (domainId ? '' : '<span class="dm">' + esc(M.domainName(it.q.domain)) + '</span> ') + '<span class="sj">' + inline(it.q.subject) + '</span></div>' +
        '<div class="qq">' + inline(it.q.text) + '</div>' +
        '<div class="ans">' + (it.letter ? '<span class="lt">' + esc(it.letter) + '</span> ' : '') + inline(it.text) + '</div>' +
        (it.quote ? '<blockquote class="qt">' + inline(it.quote) + '</blockquote>' : '') +
        ((it.page || it.why) ? '<div class="why">' + esc(it.page === 'decision' ? 'Your decision' : it.page ? it.page + ' page' : '') + (it.page && it.why ? ': ' : '') + esc(it.why || '') + '</div>' : '');
      const acts = el('div', 'acts');
      acts.appendChild(btn('bone sm', 'Confirm', () => confirmKeys([it.key])));
      acts.appendChild(btn('ghost sm', 'Not settled', () => reject(it.key)));
      row.appendChild(acts);
      box.appendChild(row);
    }
    if (list.length > 40) box.appendChild(el('p', 'busy', esc((list.length - 40) + ' more after these')));
    return box;
  }
  let sync = null, syncPv = null, syncBusy = false;
  const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  function syncBox() {
    if (!sync) return null;
    if (sync.enabled) {
      const r = el('div', 'row syncrow');
      r.appendChild(el('span', 'help', esc(sync.line) + (sync.copies ? ' ' + esc(sync.copies + (sync.copies === 1 ? ' note was' : ' notes were') + ' changed on both sides: see the Hearth notice.') : '')));
      r.appendChild(btn('ghost sm', 'Sync now', syncNow, { disabled: sync.running || syncBusy }));
      return r;
    }
    if (!syncPv) return null;
    const box = el('section', 'syncbox');
    box.appendChild(el('h3', '', 'Book sync for the phone'));
    box.appendChild(el('p', 'sub', 'Start syncing sends these to your private repo ' + esc(syncPv.repo) + ', then keeps Alaric and GitHub in step: before the Writer opens, after it closes, after your answers, and every ten minutes. Nothing else in Memphis Brain goes up.'));
    const ul = el('ul', 'synclist');
    for (const p of syncPv.parts) {
      const li = el('li', '', '<b>' + esc(p.label) + '</b> <span class="n">' + esc(p.files + (p.files === 1 ? ' file' : ' files') + ', ' + size(p.bytes)) + '</span>' +
        (p.note ? '<span class="nt">' + esc(p.note) + '</span>' : '') + (p.big.length ? '<span class="bad">Too big for GitHub: ' + esc(p.big.slice(0, 2).join(', ')) + '</span>' : ''));
      ul.appendChild(li);
    }
    box.appendChild(ul);
    const r = el('div', 'row');
    r.appendChild(btn('gold sm', syncBusy ? 'Starting...' : 'Start syncing', syncStart, { disabled: syncBusy }));
    box.appendChild(r);
    return box;
  }
  async function syncStart() {
    syncBusy = true; soft();
    const r = await API.syncStart().catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    syncBusy = false;
    if (!r || !r.ok) toast('Sync did not start: ' + ((r && r.error) || 'unknown'));
    else { sync = r.status; toast(r.sync && r.sync.ok ? 'Book sync is on, and GitHub is up to date' : 'Book sync is on; the first sync did not finish yet (' + ((r.sync && r.sync.error) || 'unknown') + ')'); await load(true); return; }
    soft();
  }
  async function syncNow() {
    syncBusy = true; soft();
    const r = await API.syncNow().catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    syncBusy = false;
    toast(r && r.ok ? (r.pulled ? 'Synced: changes from GitHub taken in' : 'Synced with GitHub') : 'Sync did not finish: ' + ((r && r.error) || 'unknown'));
    soft();
  }
  function askBox() {
    const list = M.asking(state);
    if (!list.length) return null;
    const box = el('section', 'asks');
    box.appendChild(el('h3', '', esc(list.length === 1 ? 'Where does this go?' : list.length + ' decisions ask where they go')));
    for (const it of list.slice(0, 3)) {
      const row = el('div', 'ask');
      row.appendChild(el('div', 'what', '<span class="sj">' + inline(it.subject) + '</span> ' + inline(short(it.text, 140))));
      if (it.placed.why) row.appendChild(el('div', 'why', esc(it.placed.why)));
      const opts = el('div', 'opts');
      for (const o of it.placed.options || []) {
        const b = btn('bone sm', M.optionLabel(o), () => settle(it.key, o), { disabled: placing.has(it.key) });
        b.title = o.line; opts.appendChild(b);
      }
      opts.appendChild(btn('ghost sm', 'Leave it out of the wiki', () => leaveOut(it.key), { disabled: placing.has(it.key) }));
      row.appendChild(opts);
      box.appendChild(row);
    }
    return box;
  }
  async function load(keepScreen) {
    const r = await API.read().catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (!r || !r.ok) { error = (r && r.error) || 'The workbench could not be read.'; render(); return; }
    error = ''; where = r.where || '';
    model = M.build(r.files || []);
    const imp = M.importTicks(model, M.normState(r.state), Date.now());
    state = imp.state;
    if (imp.added) { await save(state); toast(imp.added + (imp.added === 1 ? ' tick' : ' ticks') + ' from Obsidian counted as decisions'); }
    if (!keepScreen) screen = { name: 'home' };
    if (screen.name === 'card' && !model.domains.some((d) => d.id === screen.domain)) screen = { name: 'home' };
    render();
    placeFromPhone();
  }
  function render() {
    view.innerHTML = '';
    home.hidden = screen.name === 'home';
    if (error) { crumb.textContent = 'Canon'; view.appendChild(el('div', 'empty', '<h1>Canon</h1><p>' + esc(error) + '</p>')); return; }
    if (screen.name === 'log') return renderLog();
    if (screen.name === 'card') return renderCard();
    renderHome();
  }
  function renderHome() {
    const p = M.progress(model, state);
    crumb.textContent = 'Canon';
    const head = el('div', 'head');
    head.appendChild(el('h1', '', 'Canon'));
    const made = p.total - p.left;
    head.appendChild(el('p', 'sub', esc(p.left + ' of ' + p.total + ' decisions left') + (made ? ' &middot; ' + made + ' made' : '') + '. Choose a domain.'));
    view.appendChild(head);
    const sy = syncBox(); if (sy) view.appendChild(sy);
    const ab = askBox(); if (ab) view.appendChild(ab);
    const sb = settledBox(null); if (sb) view.appendChild(sb);
    const unchecked = model.domains.filter((d) => M.needsCheck(state, d.id)).length;
    if (unchecked && !checkAllRun && !PHONE) {
      const r = el('div', 'row findrow');
      r.appendChild(btn('coal sm', 'Find what is already settled', checkAll, { disabled: !live }));
      r.appendChild(el('span', 'help', esc(live ? 'One Memphis read for each of the ' + unchecked + ' domains not yet read.' : 'Memphis is not running.')));
      view.appendChild(r);
    }
    const grid = el('div', 'domains');
    for (const d of p.domains) {
      const t = el('button', 'domain' + (d.left ? '' : ' done')); t.type = 'button';
      const pct = d.total ? Math.round(100 * (d.total - d.left) / d.total) : 100;
      t.innerHTML = '<span class="nm">' + esc(d.name) + '</span>' +
        '<span class="left">' + (d.left ? esc(d.left + ' of ' + d.total + ' left') : 'All decided') + '</span>' +
        '<span class="bar"><span style="width:' + pct + '%"></span></span>';
      t.addEventListener('click', () => openDomain(d.id));
      grid.appendChild(t);
    }
    view.appendChild(grid);
    if (where) view.appendChild(el('p', 'where', 'Reading the workbench in ' + esc(where) + '. The notes are never changed here.'));
  }
  function openDomain(id) {
    screen = { name: 'card', domain: id }; pick = new Set(); editor = null; editorText = ''; render(); view.focus();
    if (live && M.needsCheck(state, id)) check(id);
  }
  function current() { return M.queue(model, state, screen.domain)[0] || null; }
  function renderCard() {
    const d = model.domains.find((x) => x.id === screen.domain);
    const p = M.progress(model, state).domains.find((x) => x.id === screen.domain) || { left: 0, total: 0 };
    crumb.innerHTML = '<span class="dm">' + esc(d ? d.name : '') + '</span><span class="cnt">' + esc(p.left + ' of ' + p.total + ' left') + '</span>';
    const q = current();
    const ab = askBox(); if (ab) view.appendChild(ab);
    const sb = settledBox(screen.domain); if (sb) view.appendChild(sb);
    if (!q) {
      if (sb) return;
      view.appendChild(el('div', 'empty', '<h1>' + esc(d ? d.name : '') + '</h1><p>Every decision in this domain is made.</p>'));
      view.appendChild(btn('gold', 'Back to the domains', goHome));
      return;
    }
    const card = el('article', 'card');
    card.appendChild(el('div', 'subject', inline(q.subject) + (state.skipped[q.key] != null ? '<span class="tag">skipped before</span>' : '')));
    card.appendChild(el('h2', 'q', inline(q.text)));
    if (q.summary) {
      const s = el('details', 'summary'); s.appendChild(el('summary', '', 'About ' + esc(q.subject))); s.appendChild(el('p', '', inline(q.summary))); card.appendChild(s);
    }
    if (q.options.length) {
      const list = el('div', 'options');
      for (const o of q.options) {
        const on = pick.has(o.letter);
        const b = el('button', 'option' + (on ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.innerHTML = '<span class="lt">' + esc(o.letter) + '</span><span class="body"><span class="tx">' + inline(o.text) + '</span>' +
          (o.meta ? '<span class="meta">' + inline(o.meta) + '</span>' : '') + '</span>';
        b.addEventListener('click', (e) => { if (e.target.closest('a.src')) return; toggle(o.letter); });
        list.appendChild(b);
      }
      card.appendChild(list);
    }
    if (q.items && q.items.length) {
      const ul = el('ul', 'items');
      for (const it of q.items) ul.appendChild(el('li', '', inline(it.text) + (it.meta ? ' <span class="meta">' + inline(it.meta) + '</span>' : '')));
      card.appendChild(el('p', 'note', 'Nothing to choose between here: write the canon in your own words.'));
      card.appendChild(ul);
    }
    if (q.hint) card.appendChild(el('p', 'hint', inline(q.hint)));
    if (editor) {
      const box = el('div', 'editor');
      box.appendChild(el('label', 'lb', editor === 'merge' ? 'Merge ' + esc([...pick].sort().join(' and ')) + ' into one version' : 'Your version'));
      const ta = el('textarea'); ta.rows = 5; ta.value = editorText; ta.spellcheck = true;
      ta.addEventListener('input', () => { editorText = ta.value; });
      box.appendChild(ta);
      const row = el('div', 'row');
      row.appendChild(btn('gold', 'Make this canon', () => answer(editor === 'merge' ? { kind: 'merge', letters: [...pick].sort(), text: editorText } : { kind: 'own', text: editorText })));
      row.appendChild(btn('ghost', 'Cancel', () => { editor = null; render(); }));
      box.appendChild(row);
      card.appendChild(box);
      view.appendChild(card);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
      return;
    }
    const row = el('div', 'row actions');
    row.appendChild(btn('gold', 'Make canon', () => answer({ kind: 'pick', letters: [...pick] }), { disabled: pick.size !== 1, key: 'Enter' }));
    if (q.options.length >= 2) row.appendChild(btn('coal', 'Merge', startMerge, { disabled: pick.size < 2, key: 'M' }));
    row.appendChild(btn('bone', 'Write my own', startOwn, { key: 'W' }));
    row.appendChild(el('span', 'spacer'));
    row.appendChild(btn('ghost', 'Skip', doSkip, { key: 'S' }));
    card.appendChild(row);
    card.appendChild(el('p', 'help', q.options.length
      ? 'Choose the version that is canon. Choose two or more to merge them.'
      : 'Write the canon, or skip and come back to it.'));
    view.appendChild(card);
  }
  function toggle(letter) { if (pick.has(letter)) pick.delete(letter); else pick.add(letter); render(); }
  function startMerge() { const q = current(); if (!q || pick.size < 2) return; editor = 'merge'; editorText = M.mergeDraft(q, [...pick]); render(); }
  function startOwn() { editor = 'own'; editorText = ''; render(); }
  function doSkip() {
    const q = current(); if (!q) return;
    commit((st) => M.skip(st, q.key, Date.now()), () => { pick = new Set(); editor = null; render(); toast('Skipped: it comes back later in this domain'); });
  }
  function answer(a) {
    const q = current(); if (!q) return;
    commit((st) => { const n = M.decide(st, q, a, Date.now()); if (PHONE) n.decisions[q.key].from = 'phone'; return n; }, (next) => {
      pick = new Set(); editor = null; editorText = '';
      render();
      const text = next.decisions[q.key].text;
      if (PHONE) toast('Canon: ' + short(text) + '. Alaric puts it in the wiki when Canon next opens there.', () => takeBack(q.key, true));
      else if (live) { toast('Canon: ' + short(text) + '. Memphis is placing it in the wiki...', () => takeBack(q.key, true)); place(q.key); }
      else toast('Canon: ' + short(text) + '. Memphis is not running, so it waits in the Decision log for the wiki.', () => takeBack(q.key, true));
    });
  }
  function reopenKey(key, stay) {
    return commit((st) => M.reopen(st, key), () => {
      if (!stay) { const q = model.byKey[key]; if (q) { screen = { name: 'card', domain: q.domain }; } }
      pick = new Set(); editor = null;
      render();
    });
  }
  function renderLog() {
    crumb.textContent = 'Decision log';
    const items = M.log(model, state);
    const head = el('div', 'head');
    head.appendChild(el('h1', '', 'Decision log'));
    head.appendChild(el('p', 'sub', items.length ? esc(items.length + (items.length === 1 ? ' decision' : ' decisions') + ', newest first. Reopen puts a card back in its domain.') : 'Nothing decided yet.'));
    view.appendChild(head);
    const KIND = { pick: 'Chose', merge: 'Merged', own: 'Own words' };
    let day = '';
    for (const it of items) {
      const dd = String(it.at || '').slice(0, 10);
      if (dd !== day) { day = dd; view.appendChild(el('div', 'day', esc(dd))); }
      const row = el('div', 'entry');
      const lt = it.letters && it.letters.length ? ' ' + it.letters.join(' + ') : '';
      row.innerHTML = '<div class="what"><span class="dm">' + esc(M.domainName(it.domain)) + '</span> <span class="sj">' + inline(it.subject) + '</span></div>' +
        '<div class="qq">' + inline(it.question) + '</div>' +
        '<div class="ans"><span class="kind">' + esc((KIND[it.kind] || it.kind) + lt) + (it.from === 'obsidian' ? ' (ticked in Obsidian)' : it.from === 'settled' ? ' (confirmed as already settled)' : '') + '</span> ' + inline(it.text) + '</div>' +
        '<div class="wp' + (it.placed ? ' ' + it.placed.kind : ' none') + '">' + esc(placing.has(it.key) ? 'Placing in the wiki...' : it.placed ? M.placeLabel(it.placed) : 'Not in the wiki yet') +
        (it.placed && it.placed.kind === 'copy' ? ': <span class="ln">' + inline(it.placed.line) + '</span>' : '') + '</div>';
      const acts = el('div', 'acts');
      if (it.placed && it.placed.kind === 'copy') acts.appendChild(btn('ghost sm', 'Copy line', () => copyText(it.placed.line)));
      if (!PHONE && !it.placed && !placing.has(it.key)) acts.appendChild(btn('bone sm', 'Place in the wiki', () => place(it.key), { disabled: !live }));
      if (!PHONE && it.placed && (it.placed.kind === 'proposed' || it.placed.kind === 'waiting') && !placing.has(it.key)) acts.appendChild(btn('bone sm', 'Place again', () => place(it.key), { disabled: !live }));
      if (it.live) acts.appendChild(btn('ghost sm', 'Reopen', () => takeBack(it.key, false), { disabled: placing.has(it.key) }));
      else acts.appendChild(el('span', 'gone', 'no longer in the workbench'));
      row.appendChild(acts);
      view.appendChild(row);
    }
  }
  function goHome() { screen = { name: 'home' }; pick = new Set(); editor = null; render(); }
  home.addEventListener('click', goHome);
  $('b-log').addEventListener('click', () => { screen = { name: 'log' }; editor = null; render(); });
  view.addEventListener('click', (e) => {
    const a = e.target.closest('a.src'); if (!a) return;
    e.preventDefault(); e.stopPropagation();
    API.openNote(a.dataset.note).then((r) => { if (!r || !r.ok) toast('Could not open ' + a.dataset.note); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) { if (e.key === 'Escape') { editor = null; render(); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { if (screen.name !== 'home') goHome(); return; }
    if (screen.name !== 'card' || editor) return;
    const q = current(); if (!q) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k === 'Enter') { if (pick.size === 1) answer({ kind: 'pick', letters: [...pick] }); e.preventDefault(); return; }
    if (/^[A-Z]$/.test(k) && q.options.some((o) => o.letter === k)) { toggle(k); return; }
    if (k === 'S') { doSkip(); return; }
    if (k === 'M') { startMerge(); return; }
    if (k === 'W') { startOwn(); e.preventDefault(); return; }
  });
  if (API.onChanged) API.onChanged(() => load(true));
  if (API.syncStatus) API.syncStatus().then((r) => { if (r && r.ok) { sync = r.status; syncPv = r.preview; if (screen.name === 'home') soft(); } }).catch(() => {});
  if (API.onSync) API.onSync((st) => { const was = sync && sync.line; sync = st; if (screen.name === 'home' && st.line !== was) soft(); });
  if (!PHONE) connect();
  load(false);
})();
