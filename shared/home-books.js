'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomeBooks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const digits = (s) => String(s == null ? '' : s).replace(/[^0-9Xx]/g, '').toUpperCase();
  function ean13ok(d) {
    if (!/^\d{13}$/.test(d)) return false;
    let s = 0; for (let i = 0; i < 12; i++) s += (+d[i]) * (i % 2 ? 3 : 1);
    return (10 - (s % 10)) % 10 === +d[12];
  }
  function isbn10ok(d) {
    if (!/^\d{9}[\dX]$/.test(d)) return false;
    let s = 0; for (let i = 0; i < 10; i++) s += (d[i] === 'X' ? 10 : +d[i]) * (10 - i);
    return s % 11 === 0;
  }
  function to13(d10) { const b = '978' + d10.slice(0, 9); let s = 0; for (let i = 0; i < 12; i++) s += (+b[i]) * (i % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); }
  function isbnFrom(text) {
    const d = digits(text);
    if (d.length === 13 && /^97[89]/.test(d) && ean13ok(d)) return d;
    if (d.length === 10 && isbn10ok(d)) return to13(d);
    return null;
  }
  const L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'].map((s) => s.split('').map(Number));
  const G = L.map((w) => w.slice().reverse());
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLL', 'LGLGGL', 'LGGLGL'];
  function bestDigit(runs, sets) {
    const sum = runs[0] + runs[1] + runs[2] + runs[3];
    if (!sum) return null;
    let best = null;
    for (const [name, set] of sets) for (let d = 0; d < 10; d++) {
      const p = set[d], k7 = 7 / sum; let et = 0, ew = 0;
      for (let k = 0; k < 3; k++) et += Math.abs((runs[k] + runs[k + 1]) * k7 - (p[k] + p[k + 1]));
      for (let k = 0; k < 4; k++) ew += Math.abs(runs[k] * k7 - p[k]);
      const e = et + ew * 0.25;
      if (!best || e < best.e) best = { d, set: name, e, et };
    }
    return best;
  }
  function runsOf(row) {
    const n = row.length; if (n < 95) return [];
    const win = Math.max(8, Math.round(n / 10));
    let lo = 255, hi = 0; for (let i = 0; i < n; i++) { if (row[i] < lo) lo = row[i]; if (row[i] > hi) hi = row[i]; }
    if (hi - lo < 40) return [];
    const f = new Float64Array(n), mid = (lo + hi) / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - win), b = Math.min(n, i + win + 1);
      let mn = 255, mx = 0; for (let j = a; j < b; j++) { const v = row[j]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const t = mx - mn < (hi - lo) * 0.3 ? mid : (mn + mx) / 2;
      f[i] = row[i] - t;
    }
    const runs = []; let cur = f[0] < 0, from = 0;
    for (let i = 1; i < n; i++) {
      const dark = f[i] < 0;
      if (dark === cur) continue;
      const edge = i - 1 + f[i - 1] / (f[i - 1] - f[i]);
      runs.push({ dark: cur, len: edge - from }); from = edge; cur = dark;
    }
    runs.push({ dark: cur, len: n - from });
    return runs;
  }
  function decodeRuns(runs) {
    for (let i = 1; i + 59 <= runs.length; i++) {
      if (!runs[i].dark) continue;
      const seg = runs.slice(i, i + 59).map((r) => r.len);
      const total = seg.reduce((a, b) => a + b, 0), unit = total / 95;
      if (unit < 1) continue;
      if (runs[i - 1].len < unit * 3) continue;
      if (runs[i + 59] && runs[i + 59].len < unit * 3) continue;
      const g = (a, k) => { const v = seg[a] / unit; return v > k * 0.35 && v < k * 2.1; };
      if (!(g(0, 1) && g(1, 1) && g(2, 1))) continue;
      if (!(g(27, 1) && g(28, 1) && g(29, 1) && g(30, 1) && g(31, 1))) continue;
      if (!(g(56, 1) && g(57, 1) && g(58, 1))) continue;
      let parity = '', out = '', err = 0, ok = true;
      for (let k = 0; k < 6 && ok; k++) { const b = bestDigit(seg.slice(3 + k * 4, 7 + k * 4), [['L', L], ['G', G]]); if (!b || b.et > 1.6) ok = false; else { out += b.d; parity += b.set; err += b.e; } }
      for (let k = 0; k < 6 && ok; k++) { const b = bestDigit(seg.slice(32 + k * 4, 36 + k * 4), [['R', L]]); if (!b || b.et > 1.6) ok = false; else { out += b.d; err += b.e; } }
      if (!ok) continue;
      const first = PARITY.indexOf(parity);
      if (first < 0) continue;
      const code = first + out;
      if (ean13ok(code)) return code;
    }
    return null;
  }
  function decodeRow(row) {
    const r = runsOf(row); if (r.length < 60) return null;
    return decodeRuns(r) || decodeRuns(r.slice().reverse());
  }
  function decodeImage(img, opts) {
    const need = (opts && opts.need) || 2, w = img.width, h = img.height, d = img.data;
    const seen = new Map();
    const rows = (opts && opts.rows) || 24;
    const row = new Uint8Array(w);
    for (let k = 0; k < rows; k++) {
      const y = Math.round(h * (0.2 + 0.6 * (k + 0.5) / rows));
      for (let x = 0; x < w; x++) { const p = (y * w + x) * 4; row[x] = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000; }
      const c = decodeRow(row);
      if (c) { const n = (seen.get(c) || 0) + 1; seen.set(c, n); if (n >= need) return c; }
    }
    return null;
  }
  const NB = (isbn) => 'https://api.nb.no/catalog/v1/items?q=isbn:' + isbn + '&size=5';
  const OL = (isbn) => 'https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data';
  const OL_COVER = (isbn) => 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg?default=false';
  const HOSTS = ['https://api.nb.no', 'https://www.nb.no', 'https://openlibrary.org', 'https://covers.openlibrary.org', 'https://archive.org', 'https://*.archive.org'];
  function personName(s) {
    let n = String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/,?\s*\d{4}-?(\d{4})?\s*$/, '').trim();
    const m = /^([^,]+),\s*([^,]+)$/.exec(n);
    if (m) n = m[2].trim() + ' ' + m[1].trim();
    return n.replace(/\s+/g, ' ').trim();
  }
  const yearOf = (s) => { const m = /(1[5-9]\d\d|20\d\d)/.exec(String(s || '')); return m ? m[1] : null; };
  function parseNb(json, isbn) {
    const items = (json && json._embedded && json._embedded.items) || [];
    const hit = items.find((x) => { const ids = (x.metadata && x.metadata.identifiers) || {}; return [].concat(ids.isbn13 || [], ids.isbn10 || []).some((v) => isbnFrom(v) === isbn); }) || null;
    if (!hit || !hit.metadata || !hit.metadata.title) return null;
    const m = hit.metadata, info = m.originInfo || {};
    const links = hit._links || {};
    const thumb = (links.thumbnail_large || links.thumbnail_medium || links.thumbnail_small || {}).href || null;
    return { isbn, title: String(m.title).trim(), authors: (m.creators || []).map(personName).filter(Boolean).slice(0, 4),
      year: yearOf(info.issued), publisher: info.publisher ? String(info.publisher).trim() : null,
      cover: thumb ? thumb.replace(/\/full\/[^/]+\/0\//, '/full/0,900/0/') : null, source: 'National Library of Norway' };
  }
  function parseOl(json, isbn) {
    const b = json && json['ISBN:' + isbn];
    if (!b || !b.title) return null;
    return { isbn, title: (String(b.title) + (b.subtitle ? ': ' + b.subtitle : '')).trim(), authors: (b.authors || []).map((a) => personName(a.name)).filter(Boolean).slice(0, 4),
      year: yearOf(b.publish_date), publisher: b.publishers && b.publishers[0] ? String(b.publishers[0].name || '').trim() || null : null,
      cover: OL_COVER(isbn), source: 'Open Library' };
  }
  async function lookup(isbn, fetchFn) {
    const order = /^97882/.test(isbn) ? ['nb', 'ol'] : ['ol', 'nb'];
    let reached = 0;
    for (const s of order) {
      try {
        const r = await fetchFn(s === 'nb' ? NB(isbn) : OL(isbn), { headers: { Accept: 'application/json' } });
        if (!r.ok) continue;
        reached++;
        const b = s === 'nb' ? parseNb(await r.json(), isbn) : parseOl(await r.json(), isbn);
        if (b) return b;
      } catch (e) {   }
    }
    if (!reached) throw new Error('The book databases could not be reached. Check the connection and scan again.');
    return null;
  }
  async function fetchCover(url, fetchFn) {
    if (!url) return null;
    try {
      const r = await fetchFn(url);
      if (!r.ok) return null;
      const u = new Uint8Array(await r.arrayBuffer());
      if (u.length < 800 || u.length > 3 * 1024 * 1024 || u[0] !== 0xff || u[1] !== 0xd8) return null;
      if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
      let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(bin);
    } catch (e) { return null; }
  }
  async function findBook(text, fetchFn) {
    const isbn = isbnFrom(text);
    if (!isbn) return { ok: false, error: 'That is not a book\'s ISBN.' };
    try {
      const book = await lookup(isbn, fetchFn);
      return { ok: true, isbn, book, cover: book ? await fetchCover(book.cover, fetchFn) : null };
    } catch (e) { return { ok: false, isbn, error: e.message }; }
  }
  function bookWords(b) {
    const parts = [];
    if (b.authors && b.authors.length) parts.push('By ' + b.authors.join(', ') + '.');
    const pub = [b.publisher, b.year].filter(Boolean).join(', ');
    if (pub) parts.push(pub + '.');
    return parts.join(' ');
  }
  function _modules(code) {
    const first = +code[0], par = PARITY[first];
    const enc = (w, startDark) => { let out = '', dark = startDark; for (const x of w) { out += (dark ? '1' : '0').repeat(x); dark = !dark; } return out; };
    let m = '101';
    for (let k = 0; k < 6; k++) m += enc((par[k] === 'L' ? L : G)[+code[1 + k]], false);
    m += '01010';
    for (let k = 0; k < 6; k++) m += enc(L[+code[7 + k]], true);
    return m + '101';
  }
  return { isbnFrom, ean13ok, decodeRow, decodeImage, lookup, parseNb, parseOl, personName, bookWords, fetchCover, findBook, HOSTS, _modules };
});
