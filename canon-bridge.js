'use strict';
(function () {
  const SM = window.SyncModel, P = window.Phone, E = P.engine;
  const PREFIX = SM.WORKBENCH + '/';
  let lastJson = null;

  function checkState(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'not a state';
    for (const k of ['decisions', 'skipped', 'imported']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) return 'missing ' + k;
    for (const k of ['suggest', 'checked']) if (s[k] != null && (typeof s[k] !== 'object' || Array.isArray(s[k]))) return 'malformed ' + k;
    for (const v of Object.values(s.decisions)) if (!v || typeof v !== 'object' || ['pick', 'merge', 'own'].indexOf(v.kind) < 0 || typeof v.text !== 'string') return 'a decision is malformed';
    return null;
  }
  const body = (s) => JSON.stringify({ schema: 1, decisions: s.decisions, skipped: s.skipped, imported: s.imported, suggest: s.suggest || {}, checked: s.checked || {} }, null, 1);

  async function read() {
    if (!(await E.signedIn())) { location.href = 'index.html'; return { ok: false, error: 'Not signed in.' }; }
    const files = [];
    for (const p of await E.list(SM.WORKBENCH)) {
      const rel = p.slice(PREFIX.length), parts = rel.split('/');
      if (parts.length !== 2 || parts[0].startsWith('.') || !/\.md$/i.test(parts[1])) continue;   // one level down, as on Alaric
      files.push({ rel, text: await E.read(p) });
    }
    if (!files.length) return { ok: false, error: 'The Canon Workbench is not on this phone yet. On Alaric, press Start syncing in Canon; then tap the badge here to sync.' };
    const raw = await E.read(SM.DECISIONS);
    lastJson = raw;
    let state = null; try { state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
    return { ok: true, where: 'this phone', files, state };
  }

  async function save(s) {
    if (checkState(s)) return { ok: false, error: checkState(s) };
    let merged = false;
    const disk = await E.read(SM.DECISIONS);
    if (disk != null && lastJson != null && disk !== lastJson) {
      const m = SM.mergeDecisions(JSON.parse(lastJson), s, JSON.parse(disk)).state;
      if (!checkState(m)) { s = m; merged = true; }
    }
    const b = body(s);
    try { await E.write(SM.DECISIONS, b); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    lastJson = b;
    return merged ? { ok: true, merged: true, state: JSON.parse(b) } : { ok: true };
  }

  async function openNote(name) {
    const want = String(name || '').trim().toLowerCase();
    const hit = (await E.list()).find((p) => p.split('/').pop().replace(/\.md$/i, '').toLowerCase() === want);
    if (!hit) { P.toast('"' + name + '" is a chat in the ChatGPT archive, not a note on this phone. The card shows its words.', 5000); return { ok: true }; }
    const text = await E.read(hit);
    const box = P.el('div', 'noteview');
    const head = P.el('div', 'nv-head', '<b>' + P.esc(hit.split('/').pop().replace(/\.md$/i, '')) + '</b>');
    head.appendChild(P.btn('coal', 'Close', () => box.remove()));
    box.appendChild(head);
    box.appendChild(P.el('pre', 'nv-text', P.esc(text)));
    document.body.appendChild(box);
    return { ok: true };
  }

  function onChanged(fn) { const f = () => fn(); document.addEventListener('phone-synced', f); return () => document.removeEventListener('phone-synced', f); }

  document.addEventListener('focusin', (e) => { if (e.target && e.target.tagName === 'TEXTAREA') setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });

  window.canonAPI = { phone: true, read, save, openNote, onChanged, _checkState: checkState };
})();
