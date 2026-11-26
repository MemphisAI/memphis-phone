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
  const KEPT_DIR = 'Manuscript/.merged';
  const lf = (t) => String(t == null ? '' : t).replace(/\r\n/g, '\n');
  const sameArr = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
  function linePairs(a, b) {
    let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length, eb = b.length; while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const pairs = []; for (let k = 0; k < s; k++) pairs.push([k, k]);
    const n = ea - s, m = eb - s;
    if (n && m && n * m <= 2500000) {
      const w = m + 1, L = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = a[s + i] === b[s + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) { if (a[s + i] === b[s + j]) { pairs.push([s + i, s + j]); i++; j++; } else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) i++; else j++; }
    }
    for (let k = 0; k < a.length - ea; k++) pairs.push([ea + k, eb + k]);
    return pairs;
  }
  function merge3Lines(base, ours, theirs, newer) {
    const mo = new Map(linePairs(base, ours)), mt = new Map(linePairs(base, theirs));
    const out = []; let clashes = 0, lostSide = false, i = 0, o = 0, t = 0;
    const resolve = (b, x, y) => {
      if (sameArr(x, b)) return y;
      if (sameArr(y, b)) return x;
      if (sameArr(x, y)) return x;
      clashes++;
      if (!b.length) return x.concat(y);
      lostSide = true;
      return newer === 'theirs' ? y : x;
    };
    for (;;) {
      let j = i; while (j < base.length && !(mo.has(j) && mt.has(j) && mo.get(j) >= o && mt.get(j) >= t)) j++;
      if (j >= base.length) { out.push(...resolve(base.slice(i), ours.slice(o), theirs.slice(t))); break; }
      const oj = mo.get(j), tj = mt.get(j);
      if (j === i && oj === o && tj === t) { out.push(base[j]); i++; o++; t++; continue; }
      out.push(...resolve(base.slice(i, j), ours.slice(o, oj), theirs.slice(t, tj)));
      i = j; o = oj; t = tj;
    }
    return { lines: out, clashes, lostSide };
  }
  function splitStamp(text) {
    const s = lf(text);
    if (s.indexOf('---\n') !== 0) return { text: s, touched: null };
    const end = s.indexOf('\n---', 3);
    if (end < 0) return { text: s, touched: null };
    let touched = null;
    const head = s.slice(0, end).split('\n').filter((l) => { const m = /^touched: *(\d+)/.exec(l); if (m) { touched = +m[1]; return false; } return true; });
    return { text: head.join('\n') + s.slice(end), touched };
  }
  function putStamp(text, touched) {
    if (touched == null || text.indexOf('---\n') !== 0) return text;
    const end = text.indexOf('\n---', 3);
    return end < 0 ? text : text.slice(0, end) + '\ntouched: ' + touched + text.slice(end);
  }
  function mergeText(base, ours, theirs, opts) {
    opts = opts || {};
    const O = splitStamp(ours), T = splitStamp(theirs);
    const newer = opts.newer || (O.touched != null && T.touched != null && O.touched !== T.touched ? (O.touched > T.touched ? 'ours' : 'theirs') : (opts.prefer || 'ours'));
    if (base == null) {
      if (O.text === T.text) return { text: lf(ours), clashes: 0, lost: null, loser: null };
      return { text: lf(newer === 'theirs' ? theirs : ours), clashes: 1, lost: lf(newer === 'theirs' ? ours : theirs), loser: newer === 'theirs' ? 'ours' : 'theirs' };
    }
    const B = splitStamp(base);
    const r = merge3Lines(B.text.split('\n'), O.text.split('\n'), T.text.split('\n'), newer);
    const stampOut = O.touched == null ? T.touched : T.touched == null ? O.touched : Math.max(O.touched, T.touched);
    const text = putStamp(r.lines.join('\n'), stampOut);
    return { text, clashes: r.clashes, lost: r.lostSide ? lf(newer === 'theirs' ? ours : theirs) : null, loser: r.lostSide ? (newer === 'theirs' ? 'ours' : 'theirs') : null };
  }
  function merge3Json(b, a, f, prefer) {
    const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    if (eq(f, b)) return a;
    if (eq(a, b) || eq(a, f)) return f;
    const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    if (Array.isArray(a) && Array.isArray(f) && Array.isArray(b) && a.length === f.length && b.length === a.length) return a.map((x, k) => merge3Json(b[k], x, f[k], prefer));
    if (obj(a) && obj(f) && obj(b)) {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(f)])) { const v = merge3Json(b[k], a[k], f[k], prefer); if (v !== undefined) out[k] = v; }
      return out;
    }
    return prefer === 'theirs' ? f : a;
  }
  function mergeJson(base, ours, theirs, prefer) {
    try { return JSON.stringify(merge3Json(base == null ? {} : JSON.parse(base), JSON.parse(ours), JSON.parse(theirs), prefer || 'ours'), null, 1); }
    catch (e) { return null; }
  }
  function mergeFile(rel, base, ours, theirs, opts) {
    opts = opts || {};
    if (rel === DECISIONS) {
      const m = mergeDecisions(base ? JSON.parse(base) : {}, JSON.parse(ours), JSON.parse(theirs));
      return { text: JSON.stringify(m.state, null, 1), lost: null, clashes: m.clashes.length };
    }
    if (/\.json$/i.test(rel)) {
      const j = mergeJson(base, ours, theirs, opts.newer || opts.prefer || 'ours');
      if (j != null) return { text: j, lost: null, clashes: 0 };
    }
    return mergeText(base, ours, theirs, opts);
  }
  function keptName(rel, when, who) {
    const d = new Date(when == null ? Date.now() : when), p = (n) => String(n).padStart(2, '0');
    const stampTxt = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
    const m = /^(.*?)(\.[^./]+)?$/.exec(String(rel).replace(/^Manuscript\//, ''));
    const name = m[1].replace(/\//g, ' ~ ').replace(/[^A-Za-z0-9 _.~\-]/g, '_');
    return KEPT_DIR + '/' + name + ' ' + stampTxt + ' ' + (who || 'alaric') + (m[2] || '.md');
  }
  const isKept = (rel) => String(rel).indexOf(KEPT_DIR + '/') === 0;
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
  return { WORKBENCH, CANON_DIR, DECISIONS, PATHS, MAX_FILE, BLOCK, KEPT_DIR, gitignoreWith, hasBlock, copyName, isCopy, stampOnly, synced, mergeDecisions,
    mergeText, mergeJson, mergeFile, keptName, isKept, statusLine, stamp };
});
