'use strict';
(function () {
  const Ph = window.Phone, E = Ph.engine, SM = window.SyncModel;
  const DIR = 'Manuscript';
  const NAME = /^[A-Za-z0-9 _.\-]+\.(md|json)$/;
  const MAX = 2 * 1024 * 1024;
  const NOTE_DIRS = ['Evrynthing', SM.WORKBENCH];
  const TIMELINE = 'Evrynthing/Evrynthing - Timeline.md';
  const noCR = (t) => (t == null ? null : String(t).split(String.fromCharCode(13)).join(''));
  let saveNow = null, saveDoneR = null;
  const top = async () => (await E.list(DIR)).map((p) => p.slice(DIR.length + 1)).filter((f) => f && f.indexOf('/') < 0 && /\.(md|json)$/.test(f));
  function okName(rel) {
    if (typeof rel !== 'string' || rel.indexOf('\\') >= 0 || SM.isCopy(rel)) return false;
    const r = rel.indexOf('.merged/') === 0 ? rel.slice(8) : rel;
    return NAME.test(r) && r.indexOf('/') < 0;
  }
  async function msList() { return { ok: true, files: await top() }; }
  async function msRead(rel) {
    if (!okName(rel)) return { ok: false, reason: 'bad path' };
    return { ok: true, content: await E.read(DIR + '/' + rel) };
  }
  async function msReadAll() {
    if (!(await E.signedIn())) { location.href = 'index.html'; return { ok: false, reason: 'not signed in' }; }
    const names = (await top()).filter((f) => !SM.isCopy(f));
    if (names.indexOf('book.json') < 0) return { ok: false, reason: 'the book is not on this phone yet. On Alaric, press Start syncing in Canon; then tap the badge here to sync' };
    const files = {};
    for (const f of names) { const t = await E.read(DIR + '/' + f); if (t != null) files[f] = t; }
    return { ok: true, files };
  }
  async function msWrite(rel, content, expect) {
    if (!okName(rel)) return { ok: false, reason: 'bad path' };
    const text = content != null ? String(content) : '';
    if (text.length > MAX) return { ok: false, reason: 'file too large' };
    const p = DIR + '/' + rel;
    try {
      if (expect !== undefined) {
        const cur = await E.read(p);
        const same = noCR(cur) === noCR(expect) || (cur != null && expect != null && SM.stampOnly(cur, expect));
        if (!same) return { ok: false, changed: true, content: cur };
      }
      await E.write(p, text);
      return { ok: true, path: p };
    } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
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
    onFilesChanged: (cb) => { document.addEventListener('phone-synced', () => cb()); },
    noteRead, noteTitles,
    tlRead: async () => { const c = await E.read(TIMELINE); return { ok: true, content: c || '', mtimeMs: 0 }; },
    tlWrite: async () => ({ ok: false, reason: 'The Timeline is edited on Alaric.' }),
    libraryRead: async () => ({ ok: false, reason: 'The Library stays on Alaric.' }),
    libraryWrite: async () => ({ ok: false, reason: 'The Library stays on Alaric.' }),
  };
  window.WriterPhone = { saveAll, DIR };
})();
