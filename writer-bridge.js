'use strict';
(function () {
  const Ph = window.Phone, E = Ph.engine, SM = window.SyncModel;
  const DIR = 'Manuscript';
  const NAME = /^[A-Za-z0-9 _.\-]+\.(md|json)$/;
  const MAX = 2 * 1024 * 1024;
  const NOTE_DIRS = ['Evrynthing', SM.WORKBENCH];
  const TIMELINE = 'Evrynthing/Evrynthing - Timeline.md';
  const seen = new Map();
  const beside = new Map();
  const copiesMade = [];
  let saveNow = null, saveDoneR = null;
  const top = async () => (await E.list(DIR)).map((p) => p.slice(DIR.length + 1)).filter((f) => f && f.indexOf('/') < 0 && /\.(md|json)$/.test(f));
  const okName = (rel) => typeof rel === 'string' && NAME.test(rel) && rel.indexOf('/') < 0 && rel.indexOf('\\') < 0 && !SM.isCopy(rel);
  async function msList() { return { ok: true, files: await top() }; }
  async function msRead(rel) {
    if (!okName(rel)) return { ok: false, reason: 'bad path' };
    const text = await E.read(DIR + '/' + rel);
    seen.set(rel, text);
    return { ok: true, content: text };
  }
  async function msReadAll() {
    if (!(await E.signedIn())) { location.href = 'index.html'; return { ok: false, reason: 'not signed in' }; }
    const names = (await top()).filter((f) => !SM.isCopy(f));
    if (names.indexOf('book.json') < 0) return { ok: false, reason: 'the book is not on this phone yet. On Alaric, press Start syncing in Canon; then tap the badge here to sync' };
    const files = {};
    for (const f of names) { const t = await E.read(DIR + '/' + f); if (t != null) { files[f] = t; seen.set(f, t); } }
    return { ok: true, files };
  }
  async function msWrite(rel, content) {
    if (!okName(rel)) return { ok: false, reason: 'bad path' };
    const text = content != null ? String(content) : '';
    if (text.length > MAX) return { ok: false, reason: 'file too large' };
    const p = DIR + '/' + rel;
    try {
      if (beside.has(rel)) { await E.write(beside.get(rel), text); return { ok: true, path: beside.get(rel) }; }
      const cur = await E.read(p);
      if (text === cur) { seen.set(rel, text); return { ok: true, path: p }; }
      if (SM.stampOnly(text, cur)) { seen.set(rel, cur); return { ok: true, path: p }; }
      const was = seen.has(rel) ? seen.get(rel) : null;
      if (cur != null && cur !== was && !(was != null && SM.stampOnly(cur, was))) {
        if (text === was) return { ok: true, path: p };
        if (rel === 'book.json' && was != null) {
          const m = mergeBook(was, cur, text);
          if (m != null) { await E.write(p, m); seen.set(rel, m); return { ok: true, path: p, merged: true }; }
        }
        const taken = new Set(await E.list(DIR));
        const to = SM.copyName(p, (x) => taken.has(x));
        await E.write(to, text);
        beside.set(rel, to); copiesMade.push({ rel, copy: to });
        document.dispatchEvent(new CustomEvent('writer-copy', { detail: { rel, copy: to } }));
        return { ok: true, path: to };
      }
      await E.write(p, text);
      seen.set(rel, text);
      return { ok: true, path: p };
    } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function merge3(b, a, f) {
    if (same(f, b)) return { v: a };
    if (same(a, b) || same(a, f)) return { v: f };
    const obj = (x) => x && typeof x === 'object';
    if (Array.isArray(a) && Array.isArray(f) && Array.isArray(b) && a.length === f.length && b.length === a.length) {
      const out = [];
      for (let k = 0; k < a.length; k++) { const r = merge3(b[k], a[k], f[k]); if (!r) return null; out.push(r.v); }
      return { v: out };
    }
    if (obj(a) && obj(f) && obj(b) && !Array.isArray(a) && !Array.isArray(f) && !Array.isArray(b)) {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(f)])) {
        const r = merge3(b[k], a[k], f[k]); if (!r) return null;
        if (r.v !== undefined) out[k] = r.v;
      }
      return { v: out };
    }
    return null;
  }
  function mergeBook(baseText, alaricText, phoneText) {
    try {
      const r = merge3(JSON.parse(baseText), JSON.parse(alaricText), JSON.parse(phoneText));
      return r && r.v && r.v.structure ? JSON.stringify(r.v, null, 1) : null;
    } catch (e) { return null; }
  }
  async function stale() {
    const out = [];
    for (const [rel, text] of seen) { if (beside.has(rel)) continue; const cur = await E.read(DIR + '/' + rel); if (cur !== text && !SM.stampOnly(cur, text)) out.push(rel); }
    for (const f of await top()) if (!seen.has(f) && !SM.isCopy(f)) out.push(f);
    return out;
  }
  function saveAll(ms) {
    if (!saveNow) return Promise.resolve(false);
    return new Promise((res) => {
      const t = setTimeout(() => { saveDoneR = null; res(false); }, ms || 5000);
      saveDoneR = () => { clearTimeout(t); saveDoneR = null; res(true); };
      try { saveNow(); } catch (e) { clearTimeout(t); saveDoneR = null; res(false); }
    });
  }
  async function noteFiles() {
    const out = [];
    for (const d of NOTE_DIRS) for (const p of await E.list(d)) {
      const parts = p.split('/');
      if (!/\.md$/i.test(p) || parts.length > 4 || parts.some((x) => x.startsWith('.') || x === '_trash') || SM.isCopy(p)) continue;
      out.push({ title: parts[parts.length - 1].slice(0, -3), path: p });
    }
    return out;
  }
  async function noteTitles() { try { return { ok: true, titles: (await noteFiles()).map((n) => n.title).sort() }; } catch (e) { return { ok: false, titles: [] }; } }
  async function noteRead(title) {
    const t = String(title || '');
    if (!t || /[\\/]/.test(t)) return { ok: false, reason: 'bad title' };
    const hit = (await noteFiles()).find((n) => n.title === t);
    return { ok: true, content: hit ? await E.read(hit.path) : null };
  }
  window.writerAPI = {
    phone: true,
    msList, msRead, msWrite, msReadAll,
    onSaveNow: (cb) => { saveNow = cb; },
    saveDone: () => { if (saveDoneR) saveDoneR(); },
    noteRead, noteTitles,
    tlRead: async () => { const c = await E.read(TIMELINE); return { ok: true, content: c || '', mtimeMs: 0 }; },
    tlWrite: async () => ({ ok: false, reason: 'The Timeline is edited on Alaric.' }),
    libraryRead: async () => ({ ok: false, reason: 'The Library stays on Alaric.' }),
    libraryWrite: async () => ({ ok: false, reason: 'The Library stays on Alaric.' }),
  };
  window.WriterPhone = { stale, saveAll, copiesMade, seen, beside, DIR, mergeBook };
})();
