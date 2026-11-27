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
    const bk = cleanBook(o.book);
    if (bk) {
      head.push('isbn: "' + bk.isbn + '"');
      if (bk.author.length) head.push('author: ' + JSON.stringify(bk.author).replace(/","/g, '", "'));
      if (bk.published) head.push('published: "' + bk.published + '"');
    }
    head.push('---');
    const body = [];
    if (o.photo) body.push('![[' + o.photo + ']]');
    const w = cleanWords(o.words);
    if (w) body.push(w);
    const t = head.join(NL) + NL + (body.length ? NL + body.join(NL + NL) + NL : '');
    return o.where || asList(o.what).length || asList(o.with).length ? setParents(t, { where: o.where || null, what: o.what || [], with: o.with || [] }) : t;
  }
  const unq = (v) => String(v).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').replace(/\\"/g, '"');
  function splitNote(text) {
    const s = String(text == null ? '' : text).replace(/\r\n/g, NL);
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    const fm = {};
    if (m) {
      let list = null;
      for (const line of m[1].split(NL)) {
        const li = /^\s+-\s*(.*)$/.exec(line);
        if (li && list) { fm[list].push(unq(li[1])); continue; }
        const k = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
        list = null;
        if (!k) continue;
        const v = k[2].trim();
        if (v === '') { fm[k[1]] = []; list = k[1]; }
        else if (/^\[.*\]$/.test(v)) { const inner = v.slice(1, -1).trim(); fm[k[1]] = inner ? (inner.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^,]+/g) || []).map(unq).filter(Boolean) : []; }
        else fm[k[1]] = unq(v);
      }
    }
    return { fm, head: m ? m[0].replace(/\n*$/, '') : null, body: m ? s.slice(m[0].length) : s };
  }
  const PARENTS = ['where', 'what', 'with'];
  const asList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]).map(String).map((x) => x.trim()).filter(Boolean);
  const unlink = (s) => { const m = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(String(s || '').trim()); return (m ? m[1] : String(s || '')).trim(); };
  const link = (name) => '[[' + name + ']]';
  function uniq(arr) { const seen = new Set(), out = []; for (const x of arr) { const k = String(x).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x); } } return out; }
  function cleanKind(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f[\]",#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function parseNote(text) {
    const { fm, body } = splitNote(text);
    let photo = typeof fm.photo === 'string' && fm.photo ? fm.photo : null;
    const lines = body.split(NL);
    const emb = lines.findIndex((l) => /^\s*!\[\[[^\]]+\.(png|jpe?g|webp|gif)(\|[^\]]*)?\]\]\s*$/i.test(l));
    if (emb >= 0) { if (!photo) photo = /!\[\[([^\]|]+)/.exec(lines[emb])[1].trim(); lines.splice(emb, 1); }
    const where = asList(fm.where).map(unlink).filter(Boolean);
    return { added: typeof fm.added === 'string' ? fm.added : null, photo, words: lines.join(NL).trim(), item: fm.home === 'item',
      where: where[0] || null, what: uniq(asList(fm.what).map(unlink).map(cleanKind).filter(Boolean)),
      with: uniq(asList(fm.with).map(unlink).filter(Boolean)),
      isbn: typeof fm.isbn === 'string' && /^\d{13}$/.test(fm.isbn) ? fm.isbn : null, author: asList(fm.author).map(unlink), published: typeof fm.published === 'string' ? fm.published : null };
  }
  function cleanBook(b) {
    if (!b || !/^\d{13}$/.test(String(b.isbn || ''))) return null;
    const names = asList(b.author || b.authors).map((x) => x.replace(/[\u0000-\u001f"\\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, 6);
    const y = /^(1[5-9]\d\d|20\d\d)$/.test(String(b.year || b.published || '')) ? String(b.year || b.published) : null;
    return { isbn: String(b.isbn), author: names, published: y };
  }
  const fmList = (arr) => '[' + arr.map((x) => JSON.stringify(x)).join(', ') + ']';
  function setParents(text, p) {
    const s = String(text == null ? '' : text).replace(/\r\n/g, NL);
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    const lines = m ? m[1].split(NL) : ['home: item'];
    const body = m ? s.slice(m[0].length) : s;
    const keep = [], old = {};
    let skip = null;
    for (const line of lines) {
      if (skip && /^\s+-/.test(line)) continue;
      skip = null;
      const k = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (k && PARENTS.includes(k[1]) && Object.prototype.hasOwnProperty.call(p || {}, k[1])) { old[k[1]] = true; if (k[2].trim() === '') skip = k[1]; continue; }
      keep.push(line);
    }
    const add = [];
    if (p && 'where' in p) { const w = p.where ? cleanName(unlink(p.where)) : ''; if (w) add.push('where: ' + fmList([link(w)])); }
    if (p && 'what' in p) { const w = uniq(asList(p.what).map(cleanKind).filter(Boolean)); if (w.length) add.push('what: ' + fmList(w)); }
    if (p && 'with' in p) { const w = uniq(asList(p.with).map(unlink).map(cleanName).filter(Boolean)); if (w.length) add.push('with: ' + fmList(w.map(link))); }
    let at = keep.length;
    for (let i = keep.length - 1; i >= 0; i--) if (/^(home|added|photo):/.test(keep[i])) { at = i + 1; break; }
    keep.splice(at, 0, ...add);
    return '---' + NL + keep.join(NL) + NL + '---' + NL + (m ? (body.startsWith(NL) ? '' : NL) + body : NL + body);
  }
  const lower = (s) => String(s || '').toLowerCase();
  function byName(items) { const m = new Map(); for (const it of items) m.set(lower(it.name), it); return m; }
  function inside(items, name) { return items.filter((it) => it.where && lower(it.where) === lower(name)); }
  function pathOf(items, name) {
    const by = byName(items), out = [], seen = new Set([lower(name)]);
    let cur = by.get(lower(name));
    while (cur && cur.where && !seen.has(lower(cur.where))) {
      seen.add(lower(cur.where));
      const up = by.get(lower(cur.where));
      out.push(up ? up.name : cur.where);
      cur = up;
    }
    return out;
  }
  function canPlace(items, name, where) {
    if (!where) return true;
    if (lower(where) === lower(name)) return false;
    return !pathOf(items, where).some((x) => lower(x) === lower(name));
  }
  function countInside(items, name) {
    let n = 0; const seen = new Set([lower(name)]), todo = [name];
    while (todo.length) { const p = todo.pop(); for (const it of inside(items, p)) if (!seen.has(lower(it.name))) { seen.add(lower(it.name)); n++; todo.push(it.name); } }
    return n;
  }
  function checkParents(name, o, items) {
    const out = {};
    const real = (n) => { const it = items.find((x) => lower(x.name) === lower(String(n || '').trim())); return it ? it.name : null; };
    if ('where' in o) {
      if (o.where) {
        const w = real(unlink(o.where));
        if (!w) return { error: 'There is no ' + String(o.where).slice(0, 60) + ' in the Home to put it in.' };
        if (!canPlace(items, name, w)) return { error: lower(w) === lower(name) ? 'A thing cannot be inside itself.' : name + ' holds ' + w + ', so it cannot go inside it.' };
        out.where = w;
      } else out.where = null;
    }
    if ('what' in o) out.what = uniq(asList(o.what).map(cleanKind).filter(Boolean)).slice(0, 12);
    if ('with' in o) out.with = uniq(asList(o.with).map((n) => real(unlink(n))).filter((n) => n && lower(n) !== lower(name))).slice(0, 30);
    return out;
  }
  function topLevel(items) { const by = byName(items); return items.filter((it) => !it.where || !by.has(lower(it.where))); }
  function kinds(items) { const m = new Map(); for (const it of items) for (const k of it.what || []) if (!m.has(lower(k))) m.set(lower(k), k); return [...m.values()].sort((a, b) => a.localeCompare(b)); }
  function together(items, name) {
    const me = items.find((it) => lower(it.name) === lower(name));
    const out = new Map();
    for (const w of (me && me.with) || []) out.set(lower(w), w);
    for (const it of items) if ((it.with || []).some((w) => lower(w) === lower(name))) out.set(lower(it.name), it.name);
    out.delete(lower(name));
    return [...out.values()].sort((a, b) => a.localeCompare(b));
  }
  function withPhoto(text, file) {
    const s = String(text == null ? '' : text).replace(/\r\n/g, NL);
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    const head = m ? m[1].split(NL).filter((l) => !/^photo:/.test(l)) : ['home: item'];
    let at = head.length; for (let i = head.length - 1; i >= 0; i--) if (/^(home|added):/.test(head[i])) { at = i + 1; break; }
    head.splice(at, 0, 'photo: ' + file);
    const lines = (m ? s.slice(m[0].length) : s).split(NL);
    const emb = lines.findIndex((l) => /^\s*!\[\[[^\]]+\.(png|jpe?g|webp|gif)(\|[^\]]*)?\]\]\s*$/i.test(l));
    if (emb >= 0) lines[emb] = '![[' + file + ']]';
    else { while (lines.length && lines[0].trim() === '') lines.shift(); lines.unshift('![[' + file + ']]', ''); }
    let body = lines.join(NL).replace(/\n+$/, '') + NL;
    return '---' + NL + head.join(NL) + NL + '---' + NL + NL + body.replace(/^\n+/, '');
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
    cleanWords, mergeWords, makeNote, parseNote, withWords, firstLine, sortItems, day,
    withPhoto, cleanBook, PARENTS, cleanKind, unlink, link, setParents, checkParents, inside, pathOf, canPlace, countInside, topLevel, kinds, together };
});
