'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SyncModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const WORKBENCH = 'Evrynthing Canon Workbench';
  const CANON_DIR = 'Canon';
  const DECISIONS = CANON_DIR + '/decisions.json';
  const PATHS = [
    { path: 'Manuscript', label: 'The Manuscript' },
    { path: 'Evrynthing', label: 'The Evrynthing notes (the wiki)' },
    { path: WORKBENCH, label: 'The Canon Workbench' },
    { path: CANON_DIR, label: 'Your Canon answers' },
  ];
  const MAX_FILE = 90 * 1024 * 1024;
  const BEGIN = '# --- book sync (Memphis, phone brief step 1) ---', END = '# --- end of book sync ---';
  const BLOCK = [BEGIN, '!/Evrynthing/', '!/' + WORKBENCH + '/', '!/' + CANON_DIR + '/',
    '/' + CANON_DIR + '/*.prev.json', '/' + CANON_DIR + '/*.tmp', '**/.snapshots/', END];
  function gitignoreWith(text) {
    const t = String(text || '').replace(/\r\n/g, '\n');
    const i = t.indexOf(BEGIN), j = t.indexOf(END);
    const rest = i >= 0 && j > i ? t.slice(0, i) + t.slice(j + END.length).replace(/^\n/, '') : t;
    const base = rest.replace(/\n*$/, '\n');
    if (!/^\/\*$/m.test(base)) throw new Error('The vault\'s .gitignore is not an allowlist; sync will not widen it.');
    return base + '\n' + BLOCK.join('\n') + '\n';
  }
  const hasBlock = (text) => String(text || '').indexOf(BEGIN) >= 0;
  function copyName(rel, exists) {
    const m = /^(.*?)(\.[^./]+)?$/.exec(rel);
    const stem = m[1], ext = m[2] || '';
    for (let n = 1; n < 100; n++) {
      const c = stem + '.from-phone' + (n > 1 ? '-' + n : '') + ext;
      if (!exists || !exists(c)) return c;
    }
    return stem + '.from-phone-' + Date.now() + ext;
  }
  const isCopy = (rel) => /\.from-phone(-\d+)?(\.[^./]+)?$/.test(rel);
  function unstamped(t) {
    const s = String(t == null ? '' : t).replace(/\r\n/g, '\n');
    if (s.indexOf('---\n') !== 0) return s;
    const end = s.indexOf('\n---', 3);
    if (end < 0) return s;
    return s.slice(0, end).split('\n').filter((l) => !/^touched: /.test(l)).join('\n') + s.slice(end);
  }
  const stampOnly = (a, b) => a != null && b != null && unstamped(a) === unstamped(b);
  const synced = (rel) => PATHS.some((p) => rel === p.path || rel.indexOf(p.path + '/') === 0);
  const MAPS = ['decisions', 'skipped', 'imported', 'suggest', 'checked'];
  function stamp(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Date.parse(v) || 0;
    if (v && typeof v === 'object') return Date.parse(v.at || v.decided || (v.placed && v.placed.at) || '') || 0;
    return 0;
  }
  function mergeDecisions(base, ours, theirs) {
    const b = base || {}, o = ours || {}, t = theirs || {};
    const out = { schema: o.schema || t.schema || 1 }, clashes = [];
    for (const k of MAPS) {
      const bm = b[k] || {}, om = o[k] || {}, tm = t[k] || {}, m = {};
      const keys = new Set([...Object.keys(om), ...Object.keys(tm), ...Object.keys(bm)]);
      for (const key of keys) {
        const bs = JSON.stringify(bm[key]), os = JSON.stringify(om[key]), ts = JSON.stringify(tm[key]);
        let pick;
        if (os === ts) pick = om[key];
        else if (os === bs) pick = tm[key];
        else if (ts === bs) pick = om[key];
        else {
          pick = stamp(tm[key]) > stamp(om[key]) ? tm[key] : om[key];
          if (k === 'decisions') clashes.push(key);
        }
        if (pick !== undefined) m[key] = pick;
      }
      out[k] = m;
    }
    for (const key of Object.keys(out.decisions)) { delete out.skipped[key]; if (out.suggest[key] && !out.suggest[key].dismissed) delete out.suggest[key]; }
    return { state: out, clashes };
  }
  function statusLine(st, now) {
    if (!st || !st.enabled) return 'Book sync is off.';
    if (st.running) return 'Syncing with GitHub...';
    const when = st.lastOk ? ago(st.lastOk, now) : null;
    if (st.lastError) return 'Last sync did not finish (' + st.lastError + ')' + (when ? '; last good sync ' + when : '') + '.';
    return when ? 'Synced with GitHub ' + when + '.' : 'Not synced yet.';
  }
  function ago(t, now) {
    const s = Math.max(0, Math.round(((now == null ? Date.now() : now) - Date.parse(t)) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }
  return { WORKBENCH, CANON_DIR, DECISIONS, PATHS, MAX_FILE, BLOCK, gitignoreWith, hasBlock, copyName, isCopy, stampOnly, synced, mergeDecisions, statusLine, stamp };
});
