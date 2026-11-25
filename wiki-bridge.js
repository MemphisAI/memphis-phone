'use strict';
(function () {
  const P = window.Phone, E = P.engine;
  const BASE = 'Evrynthing';
  const WIKI_FOLDERS = ['00 Index', '01 Law', '02 Substance', '03 Entities', '04 Ideas', '05 Objects', '06 Places', '07 Events',
    '08 Aura', 'Behind the scenes',
    '01 Entities', '02 Ideas', '03 Objects', '04 Places', '05 Events', '06 Theory',
    '07 Manifestations', '08 Lifedrive', '09 Willcraft', '10 Kinweave'];
  const SKIP_DIRS = ['Dalinari', 'Infinity Parables', 'Media', '_trash', '.obsidian', '.memphis'];
  const SHELF = 'Behind the scenes/Sections';
  const MAX_PAGE = 512 * 1024, MAX_SET = 40, STACK_MAX = 60, UNDO = 'wiki-undo';
  const norm = (t) => String(t == null ? '' : t).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const bytes = (t) => new TextEncoder().encode(t).length;
  const stem = (p) => p.split('/').pop().replace(/\.md$/i, '');
  async function read() {
    if (!(await E.signedIn())) { location.href = 'index.html'; return { ok: false, error: 'Not signed in.' }; }
    const files = [], folders = new Set();
    for (const p of await E.list(BASE)) {
      const parts = p.split('/').slice(1);
      if (parts.some((x) => !x || x.startsWith('.'))) continue;
      if (parts.length >= 2 && !SKIP_DIRS.includes(parts[0])) folders.add(parts[0]);
      const ok = parts.length === 1 || (parts.length === 2 && !SKIP_DIRS.includes(parts[0])) || (parts.length === 3 && parts[0] + '/' + parts[1] === SHELF);
      if (!ok || !/\.md$/i.test(p)) continue;
      const text = await E.read(p);
      if (text == null) continue;
      if (bytes(text) > MAX_PAGE) files.push({ rel: parts.join('/'), text: '', tooBig: true });
      else files.push({ rel: parts.join('/'), text });
    }
    if (!files.length) return { ok: false, error: 'The wiki\'s notes are not on this phone yet. On Alaric, press Start syncing in Canon; then tap the badge here to sync.' };
    const dalinari = await E.read(BASE + '/Dalinari/Dalinari.json');
    return { ok: true, files, folders: [...folders], media: [], homes: { 'Dalinari/Dalinari.json': dalinari } };
  }
  function pageRel(rel) {
    let r = String(rel || '').replace(/\\/g, '/').trim().replace(/^\/+/, '');
    if (r.indexOf(BASE + '/') !== 0) r = BASE + '/' + r;
    const parts = r.split('/');
    const shelf = parts.length === 4 && parts[1] + '/' + parts[2] === SHELF;
    if ((parts.length !== 3 && !shelf) || !WIKI_FOLDERS.includes(parts[1]) || !/\.md$/i.test(parts[parts.length - 1])
      || parts.some((x) => x === '' || x === '.' || x === '..' || x.startsWith('.')) || r.length > 300) {
      throw new Error('Refused: the wiki only writes its own pages (Evrynthing/<wiki folder>/<page>.md).');
    }
    return r;
  }
  function shaped(text, raw) {
    const eol = raw != null && raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    let t = norm(text); if (eol !== '\n') t = t.replace(/\n/g, eol);
    if (!t.endsWith(eol)) t += eol;
    return t;
  }
  function checkText(text, rel) {
    const t = norm(text);
    if (!t.trim()) throw new Error('Refused: a page cannot be saved empty' + (rel ? ': ' + rel : '.'));
    if (bytes(t) > MAX_PAGE) throw new Error('Refused: that page is too big to save from the wiki' + (rel ? ': ' + rel : '.'));
    return t;
  }
  async function stack() { const s = await E.local.get(UNDO); return Array.isArray(s) ? s : []; }
  async function push(entry) { const s = await stack(); s.push(entry); while (s.length > STACK_MAX) s.shift(); await E.local.put(UNDO, s); return s.length; }
  async function save(o) {
    if (o.picture) throw new Error('Pictures are added on Alaric for now.');
    const rel = pageRel(o.rel);
    const text = checkText(o.text);
    const raw = await E.read(rel);
    if (raw == null) throw new Error('That page is not on this phone any more: ' + rel);
    if (o.expect != null && norm(raw) !== norm(o.expect)) {
      throw new Error('The page changed since you opened it (a sync brought a newer one). Your text is kept in the editor: copy it, reload the page and save again.');
    }
    const neu = shaped(text, raw);
    if (norm(neu) === norm(raw)) return { ok: true, rel, unchanged: true, undo: (await stack()).length };
    await E.write(rel, neu);
    const undo = await push({ at: new Date().toISOString(), page: rel, label: String(o.label || '').slice(0, 120), ops: [{ op: 'rewrite', path: rel, before: raw, after: neu }] });
    return { ok: true, rel, unchanged: false, undo };
  }
  async function saveSet(o) {
    const files = o.files;
    if (!Array.isArray(files) || !files.length) throw new Error('Refused: nothing to save.');
    if (files.length > MAX_SET) throw new Error('Refused: one save can write at most ' + MAX_SET + ' pages.');
    const all = await E.list(BASE);
    const taken = new Set(all.filter((p) => { const x = p.split('/'); return (x.length === 3 && WIKI_FOLDERS.includes(x[1])) || (x.length === 4 && x[1] + '/' + x[2] === SHELF); })
      .filter((p) => /\.md$/i.test(p)).map((p) => stem(p).toLowerCase()));
    const plan = [], seen = new Set();
    for (const f of files) {
      const rel = pageRel((f || {}).rel);
      if (seen.has(rel.toLowerCase())) throw new Error('Refused: the same page twice in one save: ' + rel);
      seen.add(rel.toLowerCase());
      const text = checkText(f.text, rel);
      const raw = await E.read(rel);
      if (f.expect == null) {
        if (raw != null) throw new Error('There is already a page called ' + stem(rel) + '. Pick that one, or another name.');
        if (taken.has(stem(rel).toLowerCase())) throw new Error('There is already a page called ' + stem(rel) + ' in another folder.');
        plan.push({ op: 'create', path: rel, before: null, after: shaped(text, null) });
      } else {
        if (raw == null) throw new Error('That page is not on this phone any more: ' + rel);
        if (norm(raw) !== norm(f.expect)) throw new Error(stem(rel) + ' changed since you opened it (a sync brought a newer one). Nothing was saved: reload the page and try again.');
        const neu = shaped(text, raw);
        if (norm(neu) !== norm(raw)) plan.push({ op: 'rewrite', path: rel, before: raw, after: neu });
      }
    }
    if (!plan.length) return { ok: true, rels: [], unchanged: true, undo: (await stack()).length };
    for (const x of plan) await E.write(x.path, x.after);
    const undo = await push({ at: new Date().toISOString(), page: o.page ? pageRel(o.page) : plan[0].path, label: String(o.label || '').slice(0, 120), ops: plan });
    return { ok: true, rels: plan.map((x) => x.path), created: plan.filter((x) => x.op === 'create').length, rewritten: plan.filter((x) => x.op === 'rewrite').length, undo };
  }
  async function undo() {
    const s = await stack();
    const top = s.pop();
    if (!top) throw new Error('There is no wiki save to undo.');
    const left = [];
    let undone = 0;
    for (const x of top.ops.slice().reverse()) {
      const cur = await E.read(x.path);
      if (cur == null || norm(cur) !== norm(x.after)) { left.push(stem(x.path) + ': it changed since'); continue; }
      if (x.op === 'create') {
        if (await E.discard(x.path)) undone++;
        else left.push(stem(x.path) + ': already sent, so take it away on Alaric');
      } else { await E.write(x.path, x.before); undone++; }
    }
    await E.local.put(UNDO, s);
    return { ok: !left.length, undone, left, page: top.page, undo: s.length };
  }
  async function ask(o) {
    o = o || {};
    const id = String(o.id || ''), action = String(o.action || '');
    const reply = (r) => Object.assign({ id, action }, r);
    try {
      if (action === 'wiki_status') return reply({ ok: true, undo: (await stack()).length, tied: false, trash: 0 });
      if (action === 'wiki_save') return reply(await save(o));
      if (action === 'wiki_save_set') return reply(await saveSet(o));
      if (action === 'wiki_undo') return reply(await undo());
      if (action === 'wiki_rename') return reply({ ok: false, error: 'Rename everywhere makes a change set, and change sets are applied on Alaric. Do it there.' });
      if (action === 'wiki_trash') return reply({ ok: false, error: 'The vault trash is on Alaric.' });
      return reply({ ok: false, error: 'Unknown wiki request.' });
    } catch (e) { return reply({ ok: false, error: String(e && e.message || e) }); }
  }
  async function openInVault(rel) {
    const p = BASE + '/' + String(rel || '').replace(/\\/g, '/');
    const text = /\.md$/i.test(p) ? await E.read(p) : null;
    if (text == null) return { ok: false, error: 'That note is not on this phone.' };
    const box = P.el('div', 'noteview');
    const head = P.el('div', 'nv-head', '<b>' + P.esc(stem(p)) + '</b>');
    head.appendChild(P.btn('coal', 'Close', () => box.remove()));
    box.appendChild(head);
    box.appendChild(P.el('pre', 'nv-text', P.esc(text)));
    document.body.appendChild(box);
    return { ok: true, via: 'phone' };
  }
  async function openApp(id) {
    if (id === 'writer') { location.href = 'writer.html'; return { ok: true }; }
    P.toast((id === 'atelier' ? 'The Atelier' : 'The Writer') + ' comes to the phone in a later step. Open it on Alaric for now.', 4500);
    return { ok: true };
  }
  function onChanged(fn) {
    const f = () => { if (window.__wikiEdit && window.__wikiEdit.editing()) return; fn(); };
    document.addEventListener('phone-synced', f);
    return () => document.removeEventListener('phone-synced', f);
  }
  window.wikiAPI = {
    phone: true, read, ask, openInVault, openApp, onChanged,
    media: async () => ({ ok: false }),
    art: async () => ({ ok: false }),
    graph: () => Promise.resolve({ ok: true }),
    _pageRel: pageRel, _lists: { WIKI_FOLDERS, SKIP_DIRS, SHELF },
  };
})();
