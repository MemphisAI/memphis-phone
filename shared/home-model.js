'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomeModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DIR = 'Home', PHOTOS = 'Home/Photos', ORIGINALS = 'Home/.originals';
  const MAX_NAME = 80, MAX_WORDS = 4000;
  const PHOTO_MAX = 1080, PHOTO_Q = 0.8;
  const NL = '\n';
  function cleanName(s) {
    let n = String(s == null ? '' : s).replace(/[\u0000-\u001f\\/:*?"<>|#^[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
    n = n.replace(/^\.+/, '').replace(/[. ]+$/, '').trim();
    if (n.length > MAX_NAME) n = n.slice(0, MAX_NAME).replace(/[. ]+$/, '').trim();
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) n += ' (thing)';
    return n;
  }
  function freeName(name, taken) {
    const n = cleanName(name); if (!n) return '';
    const has = new Set([...(taken || [])].map((x) => String(x).toLowerCase()));
    if (!has.has(n.toLowerCase())) return n;
    for (let k = 2; k < 1000; k++) { const c = n + ' ' + k; if (!has.has(c.toLowerCase())) return c; }
    return n + ' ' + Date.now();
  }
  const notePath = (name) => DIR + '/' + name + '.md';
  function itemName(p) {
    const m = /^Home\/([^/]+)\.md$/.exec(String(p || ''));
    if (!m || m[1].startsWith('.') || /\.from-phone(-\d+)?$/.test(m[1])) return null;
    return m[1];
  }
  const stamp = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
  const day = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  function photoName(name, when, ext) {
    const slug = String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'thing';
    return slug + '-' + stamp(new Date(when == null ? Date.now() : when)) + '.' + (ext || 'jpg');
  }
  const okPhoto = (f) => /^[a-z0-9-]+-\d{8}-\d{6}\.(jpe?g|png|webp)$/i.test(String(f || ''));
  function cleanWords(w) {
    let t = String(w == null ? '' : w).replace(/\r\n?/g, NL).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim();
    if (t.length > MAX_WORDS) t = t.slice(0, MAX_WORDS).trim();
    return t.split(NL).map((l) => (/^\s*---\s*$/.test(l) ? '-- -' : l)).join(NL);
  }
  function makeNote(o) {
    const head = ['---', 'home: item', 'added: ' + (o.added || day(new Date()))];
    if (o.photo) head.push('photo: ' + o.photo);
    head.push('---');
    const body = [];
    if (o.photo) body.push('![[' + o.photo + ']]');
    const w = cleanWords(o.words);
    if (w) body.push(w);
    return head.join(NL) + NL + NL + body.join(NL + NL) + NL;
  }
  function splitNote(text) {
    const s = String(text == null ? '' : text).replace(/\r\n/g, NL);
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    const fm = {}, order = [];
    if (m) for (const line of m[1].split(NL)) { const k = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line); if (k) { fm[k[1]] = k[2].replace(/^"(.*)"$/, '$1'); order.push(line); } }
    return { fm, head: m ? m[0].replace(/\n*$/, '') : null, body: m ? s.slice(m[0].length) : s };
  }
  function parseNote(text) {
    const { fm, body } = splitNote(text);
    let photo = fm.photo || null;
    const lines = body.split(NL);
    const emb = lines.findIndex((l) => /^\s*!\[\[[^\]]+\.(png|jpe?g|webp|gif)(\|[^\]]*)?\]\]\s*$/i.test(l));
    if (emb >= 0) { if (!photo) photo = /!\[\[([^\]|]+)/.exec(lines[emb])[1].trim(); lines.splice(emb, 1); }
    return { added: fm.added || null, photo, words: lines.join(NL).trim(), item: fm.home === 'item' };
  }
  function withWords(text, words) {
    const { head, body } = splitNote(text);
    const lines = body.split(NL);
    const emb = lines.findIndex((l) => /^\s*!\[\[[^\]]+\.(png|jpe?g|webp|gif)(\|[^\]]*)?\]\]\s*$/i.test(l));
    const parts = [];
    if (emb >= 0) parts.push(lines[emb].trim());
    const w = cleanWords(words);
    if (w) parts.push(w);
    return (head != null ? head + NL + NL : '') + parts.join(NL + NL) + NL;
  }
  function mergeWords(base, ours, theirs, SM) {
    const b = cleanWords(base), o = cleanWords(ours), t = cleanWords(theirs);
    if (o === t || t === b) return o;
    if (o === b) return t;
    let m = null; try { m = SM ? SM.mergeText(b, o, t, { newer: 'ours' }) : null; } catch (e) { m = null; }
    if (m && !m.lost) return cleanWords(m.text);
    const paras = (s) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const have = new Set(paras(o).concat(paras(b)));
    const extra = paras(t).filter((x) => !have.has(x));
    return cleanWords([o].concat(extra).join(NL + NL));
  }
  function firstLine(words, max) {
    const l = (String(words || '').split(/\n/).map((x) => x.trim()).find(Boolean) || '').replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');
    const n = max || 90;
    return l.length > n ? l.slice(0, n).replace(/\s+\S*$/, '') + '…' : l;
  }
  function sortItems(items) {
    const key = (x) => { const m = /-(\d{8}-\d{6})\.[a-z]+$/i.exec(x.photo || ''); return String(x.added || '') + ' ' + (m ? m[1] : ''); };
    return items.slice().sort((a, b) => key(b).localeCompare(key(a)) || a.name.localeCompare(b.name));
  }
  return { DIR, PHOTOS, ORIGINALS, MAX_NAME, MAX_WORDS, PHOTO_MAX, PHOTO_Q, cleanName, freeName, notePath, itemName, photoName, okPhoto,
    cleanWords, mergeWords, makeNote, parseNote, withWords, firstLine, sortItems, day };
});
