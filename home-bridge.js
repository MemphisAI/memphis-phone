'use strict';
(function () {
  const P = window.Phone, E = P.engine, HM = window.HomeModel, SM = window.SyncModel;
  const MAX_SMALL = 8 * 1024 * 1024;
  async function names() { return (await E.list(HM.DIR)).map(HM.itemName).filter(Boolean); }
  async function readItem(name) {
    const text = await E.read(HM.notePath(name)); if (text == null) return null;
    const it = HM.parseNote(text);
    return { name, words: it.words, photo: it.photo, added: it.added, where: it.where, what: it.what, with: it.with, text };
  }
  async function list() {
    if (!(await E.signedIn())) { location.href = 'index.html'; return { ok: false, error: 'Not signed in.' }; }
    const items = [];
    for (const n of await names()) { const it = await readItem(n); if (it) { delete it.text; items.push(it); } }
    return { ok: true, items: HM.sortItems(items) };
  }
  const blobs = new Map();
  async function photo(file) {
    const f = String(file || ''); if (!f || /[\\/]/.test(f)) return null;
    if (blobs.has(f)) return blobs.get(f);
    const b64 = await E.readBin(HM.PHOTOS + '/' + f); if (!b64) return null;
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ext = f.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(new Blob([u], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' }));
    blobs.set(f, url);
    return url;
  }
  async function add(o) {
    o = o || {};
    const name = HM.freeName(o.name, await names());
    if (!name) return { ok: false, error: 'Give it a name.' };
    const p = HM.checkParents(name, o, (await list()).items || []);
    if (p.error) return { ok: false, error: p.error };
    const when = Date.now();
    let photoFile = null;
    if (o.small) {
      const s = String(o.small).replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]+=*$/.test(s) || s.slice(0, 4) !== '/9j/') return { ok: false, error: 'That photo could not be read.' };
      if (s.length * 0.75 > MAX_SMALL) return { ok: false, error: 'That photo is too big.' };
      photoFile = HM.photoName(name, when, 'jpg');
      try { await E.writeBin(HM.PHOTOS + '/' + photoFile, s); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    }
    try { await E.write(HM.notePath(name), HM.makeNote({ added: HM.day(new Date(when)), photo: photoFile, words: o.words, where: p.where, what: p.what, with: p.with })); }
    catch (e) { if (photoFile) await E.discard(HM.PHOTOS + '/' + photoFile).catch(() => {}); return { ok: false, error: String(e.message || e) }; }
    return { ok: true, name };
  }
  async function save(name, words, expect) {
    const it = await readItem(String(name || ''));
    if (!it) return { ok: false, error: 'That thing is no longer in the Home.' };
    let w = HM.cleanWords(words);
    if (expect != null && it.words !== HM.cleanWords(expect)) {
      w = HM.mergeWords(expect, w, it.words, SM);
    }
    if (w === it.words) return { ok: true, words: w };
    try { await E.write(HM.notePath(it.name), HM.withWords(it.text, w)); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    return { ok: true, words: w };
  }
  async function parents(name, p) {
    const it = await readItem(String(name || ''));
    if (!it) return { ok: false, error: 'That thing is no longer in the Home.' };
    const c = HM.checkParents(it.name, p || {}, (await list()).items || []);
    if (c.error) return { ok: false, error: c.error };
    const text = HM.setParents(it.text, c);
    try { await E.write(HM.notePath(it.name), text); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    const now = HM.parseNote(text);
    return { ok: true, where: now.where, what: now.what, with: now.with };
  }
  function onChanged(fn) { const f = () => fn(); document.addEventListener('phone-synced', f); return () => document.removeEventListener('phone-synced', f); }
  document.addEventListener('focusin', (e) => { if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName) && e.target.type !== 'file') setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });
  window.homeAPI = { phone: true, keepsOriginal: false, list, photo, add, save, parents, onChanged };
})();
