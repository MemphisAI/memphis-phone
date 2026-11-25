'use strict';
(function (root) {
  const FOLDERS = [
    { id: '00 Index', num: '00', name: 'Index', suit: 'bone' },
    { id: '01 Law', num: '01', name: 'Law', suit: 'magia' },
    { id: '02 Substance', num: '02', name: 'Substance', suit: 'magia' },
    { id: '03 Entities', num: '03', name: 'Entities', suit: 'domina' },
    { id: '04 Ideas', num: '04', name: 'Ideas', suit: 'domina' },
    { id: '05 Objects', num: '05', name: 'Objects', suit: 'domina' },
    { id: '06 Places', num: '06', name: 'Places', suit: 'domina' },
    { id: '07 Events', num: '07', name: 'Events', suit: 'domina' },
    { id: '08 Aura', num: '08', name: 'Aura', suit: 'aura' },
    { id: 'Behind the scenes', num: '', name: 'Behind the scenes', suit: 'behind' },
    { id: '01 Entities', num: '01', name: 'Entities', suit: 'domina', legacy: true, to: '03 Entities' },
    { id: '02 Ideas', num: '02', name: 'Ideas', suit: 'domina', legacy: true, to: '04 Ideas' },
    { id: '03 Objects', num: '03', name: 'Objects', suit: 'domina', legacy: true, to: '05 Objects' },
    { id: '04 Places', num: '04', name: 'Places', suit: 'domina', legacy: true, to: '06 Places' },
    { id: '05 Events', num: '05', name: 'Events', suit: 'domina', legacy: true, to: '07 Events' },
    { id: '06 Theory', num: '06', name: 'Theory', suit: 'magia', legacy: true, to: '01 Law' },
    { id: '07 Manifestations', num: '07', name: 'Manifestations', suit: 'aura', legacy: true, to: '08 Aura' },
    { id: '08 Lifedrive', num: '08', name: 'Lifedrive', suit: 'aura', legacy: true, to: '08 Aura' },
    { id: '09 Willcraft', num: '09', name: 'Willcraft', suit: 'aura', legacy: true, to: '08 Aura' },
    { id: '10 Kinweave', num: '10', name: 'Kinweave', suit: 'aura', legacy: true, to: '08 Aura' },
  ];
  const TOPS = [
    { name: 'Law', suit: 'magia', folder: '01 Law', facts: [], sections: ['Story'] },
    { name: 'Substance', suit: 'magia', folder: '02 Substance', facts: [], sections: ['Story'] },
    { name: 'Being', suit: 'domina', folder: '03 Entities', facts: ['Born', 'Died'], sections: ['Story', 'Bonds', 'Ties'] },
    { name: 'Group', suit: 'domina', folder: '03 Entities', facts: ['Founded'], sections: ['Story', 'Members', 'Ties'] },
    { name: 'Idea', suit: 'domina', folder: '04 Ideas', facts: ['Made by', 'Used by'], sections: ['Story'] },
    { name: 'Object', suit: 'domina', folder: '05 Objects', facts: ['Made by', 'Held by'], sections: ['Story'] },
    { name: 'Place', suit: 'domina', folder: '06 Places', facts: ['Ruled by'], sections: ['Story', 'Holds'] },
    { name: 'Event', suit: 'domina', folder: '07 Events', facts: ['When'], sections: ['Story', 'Who'] },
    { name: 'Unity', suit: 'aura', folder: '08 Aura', facts: [], sections: ['Story'] },
    { name: 'Manifestation', suit: 'aura', folder: '08 Aura', facts: [], sections: ['Story'] },
    { name: 'Aspect', suit: 'aura', folder: '08 Aura', facts: [], sections: ['Story'] },
  ];
  const TOP_ALIAS = { culture: 'Idea', force: 'Manifestation' };
  const TOP_BY_NAME = Object.fromEntries(TOPS.map(t => [t.name.toLowerCase(), t]).concat(Object.entries(TOP_ALIAS).map(([a, n]) => [a, TOPS.find(t => t.name === n)])));
  const FOLDER_TOP = { '01 Law': 'Law', '02 Substance': 'Substance', '03 Entities': 'Being', '04 Ideas': 'Idea', '05 Objects': 'Object',
    '06 Places': 'Place', '07 Events': 'Event', '08 Aura': 'Unity',
    '01 Entities': 'Being', '02 Ideas': 'Idea', '03 Objects': 'Object', '04 Places': 'Place', '05 Events': 'Event',
    '06 Theory': 'Law', '07 Manifestations': 'Manifestation', '08 Lifedrive': 'Aspect', '09 Willcraft': 'Aspect', '10 Kinweave': 'Aspect' };
  const TYPE_OF_FOLDER = { '00 Index': 'index', '01 Law': 'law', '02 Substance': 'substance', '03 Entities': 'entity', '04 Ideas': 'idea',
    '05 Objects': 'object', '06 Places': 'place', '07 Events': 'event', '08 Aura': 'aura', 'Behind the scenes': 'behind-the-scenes',
    '01 Entities': 'entity', '02 Ideas': 'idea', '03 Objects': 'object', '04 Places': 'place',
    '05 Events': 'event', '06 Theory': 'theory', '07 Manifestations': 'manifestation', '08 Lifedrive': 'lifedrive', '09 Willcraft': 'willcraft',
    '10 Kinweave': 'kinweave' };
  const SHELF_DIR = 'Behind the scenes/Sections';
  const PARENT_KEYS = ['where', 'what', 'with', 'book'];
  const FOLDER_BY_ID = Object.fromEntries(FOLDERS.map(f => [f.id, f]));
  const SUITS = ['domina', 'aura', 'magia', 'bone', 'behind'];
  const PREFIX = 'eV - ';

  function plainName(name) { return String(name || '').startsWith(PREFIX) ? String(name).slice(PREFIX.length) : String(name || ''); }

  function parseFrontmatter(text) {
    const s = String(text || '').replace(/^﻿/, '');
    if (!s.startsWith('---')) return { fm: {}, body: s };
    const end = s.indexOf('\n---', 3);
    if (end < 0) return { fm: {}, body: s };
    const head = s.slice(3, end).replace(/\r/g, '').split('\n');
    const nl = s.indexOf('\n', end + 4);
    const body = nl < 0 ? '' : s.slice(nl + 1);
    const fm = {};
    let lastKey = null;
    for (const line of head) {
      const li = line.match(/^\s+-\s+(.*)$/);   // a YAML block list under the last key
      if (li && lastKey && (fm[lastKey] === '' || Array.isArray(fm[lastKey]))) {
        if (!Array.isArray(fm[lastKey])) fm[lastKey] = [];
        fm[lastKey].push(li[1].trim().replace(/^['"]|['"]$/g, ''));
        continue;
      }
      const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!m) continue;
      lastKey = m[1].toLowerCase();
      let v = m[2].trim();
      if (/^\[\[[^\]]*\]\]$/.test(v)) { /* one bare [[link]]: a string */ }
      else if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      else v = v.replace(/^['"]|['"]$/g, '');
      fm[m[1].toLowerCase()] = v;
    }
    return { fm, body };
  }

  const LINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/g;
  function links(text) {
    const out = []; let m; LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(String(text || '')))) out.push({ target: m[1].trim(), heading: (m[2] || '').trim(), label: (m[3] || '').trim() || plainName(m[1].trim()) });
    return out;
  }

  function kindOf(h) {
    const t = h.trim().toLowerCase();
    if (/^i\s+what it is/.test(t)) return 'what';
    if (/^ii\s+its story/.test(t) || t === 'story') return 'story';
    if (/^iii\s+its threads/.test(t)) return 'threads';
    if (/^mentor'?s margin/.test(t) || /^mentor’s margin/.test(t)) return 'margin';
    if (/^behind the scenes/.test(t)) return 'behind';
    if (t === 'facts') return 'facts';           // v5: the facts box
    if (t === 'bonds') return 'bonds';           // v5: a link plus one word
    if (t === 'ties') return 'ties';             // v6: the unities a page's Filiai binds it to (a link plus one word)
    if (t === 'members' || t === 'holds') return 'members';   // v5: minor members as plain lines
    return 'other';
  }
  function parentList(v) {
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    const out = [];
    for (const x of arr) {
      const ls = links(x);
      if (ls.length) { for (const l of ls) out.push({ target: l.target, label: l.label }); continue; }
      const w = String(x || '').trim(); if (!w) continue;
      const top = TOP_BY_NAME[w.toLowerCase()];
      if (top) out.push({ top: top.name, label: top.name });
      else out.push({ target: w.startsWith(PREFIX) ? w : PREFIX + w, label: plainName(w) });
    }
    return out;
  }
  function parseFacts(t) {
    const out = []; let group = '';
    for (const line of String(t || '').split(/\r?\n/)) {
      const g = line.match(/^\s*#{3,6}\s+(.+?)\s*$/); if (g) { group = g[1]; continue; }
      const m = line.match(/^\s*[-*]\s+([^:\n]{1,60}?)\s*:\s*(.*)$/);
      if (m && !/^\[\[/.test(m[1])) out.push(group ? { name: m[1].trim(), value: m[2].trim(), group } : { name: m[1].trim(), value: m[2].trim() });
    }
    return out;
  }
  function parseBonds(t) {
    const out = [];
    for (const line of String(t || '').split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]\s+(\[\[[^\]]+\]\])\s*(?:[·\-–—:]\s*(.*))?$/);
      if (!m) continue;
      const l = links(m[1])[0]; if (!l) continue;
      out.push({ target: l.target, label: l.label, word: (m[2] || '').trim() });
    }
    return out;
  }
  function parseMembers(t) {
    const out = [];
    for (const line of String(t || '').split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]\s+(.+?)\s*$/); if (!m) continue;
      const l = links(m[1]);
      if (l.length && /^\s*\[\[/.test(m[1])) out.push({ target: l[0].target, label: l[0].label, line: line });
      else { const parts = m[1].split(/\s+[·–—]\s+/); out.push({ minor: true, name: parts[0].trim(), note: parts.slice(1).join(' · ').trim(), line: line }); }
    }
    return out;
  }
  function parseNote(text, name) {
    const { fm, body } = parseFrontmatter(text);
    const lines = body.split(/\r?\n/);
    let title = '';
    const secs = []; let cur = { kind: 'lead', head: '', lines: [] };
    for (const line of lines) {
      const h1 = line.match(/^#\s+(.+?)\s*$/);
      if (h1 && !title && cur.kind === 'lead') { title = h1[1]; continue; }
      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) { secs.push(cur); cur = { kind: kindOf(h2[1]), head: h2[1], lines: [] }; continue; }
      cur.lines.push(line);
    }
    secs.push(cur);
    const page = { name: name || '', title: plainName(title) || plainName(name), fm, what: '', story: '', margin: '', others: [], line: '',
      leadPics: '', threads: { up: [], down: [], across: [], raw: '' }, behind: { open: [], parts: [], raw: '' },
      facts: [], bonds: [], ties: [], minor: [], secs: [], parents: { where: [], what: [], with: [], book: [] }, kindPage: false, shelf: '' };
    const lead = secs[0].lines.join('\n').trim();
    let hasWhat = false;
    for (const s of secs.slice(1)) {
      const t = s.lines.join('\n').replace(/^\s*\n|\n\s*$/g, '');
      if (s.kind === 'what') { hasWhat = true; page.what += (page.what ? '\n\n' : '') + t; }
      else if (s.kind === 'story') page.story += (page.story ? '\n\n' : '') + t;
      else if (s.kind === 'margin') page.margin += (page.margin ? '\n\n' : '') + t;
      else if (s.kind === 'threads') { page.threads.raw = t; parseThreads(t, page.threads); }
      else if (s.kind === 'behind') { page.behind.raw = t; parseBehind(t, page.behind); }
      else if (s.kind === 'facts') page.facts = page.facts.concat(parseFacts(t));
      else if (s.kind === 'bonds') page.bonds = page.bonds.concat(parseBonds(t));
      else if (s.kind === 'ties') page.ties = page.ties.concat(parseBonds(t));
      else if (s.kind === 'members') page.minor = page.minor.concat(parseMembers(t).filter(x => x.minor));
      else page.others.push({ head: s.head, text: t });
      if (!['margin', 'behind', 'threads', 'facts', 'what'].includes(s.kind)) page.secs.push({ head: s.head, kind: s.kind, text: t });
    }
    page.v5 = PARENT_KEYS.some(k => Object.prototype.hasOwnProperty.call(fm, k)) || secs.some(s => s.kind === 'facts' || s.head === 'Story');
    if (page.v5 && !hasWhat) { const sp = splitPics(lead); page.line = sp.text; page.leadPics = sp.pics; }
    else if (!page.what && lead) page.what = lead;
    else if (lead) page.what = lead + '\n\n' + page.what;
    if (!page.threads.up.length && fm.up) { const l = links(fm.up); if (l.length) page.threads.up = l; }
    for (const k of PARENT_KEYS) page.parents[k] = parentList(fm[k]);
    if (!PARENT_KEYS.some(k => Object.prototype.hasOwnProperty.call(fm, k)) && page.threads.up.length)
      page.parents.with = page.threads.up.filter(l => l.target !== PREFIX + 'Index').map(l => ({ target: l.target, label: l.label }));
    page.kindPage = /^(true|yes|1)$/i.test(String(fm.kind_page || ''));
    page.shelf = /^(section|fact)$/i.test(String(fm.shelf || '')) ? String(fm.shelf).toLowerCase() : '';
    page.noRecord = /^(none|no)$/i.test(String(fm.record || '').trim());
    const ft = TOP_BY_NAME[String(fm.top || '').trim().toLowerCase()];
    page.topSet = ft ? ft.name : '';
    return page;
  }
  function splitPics(t) {
    const text = [], pics = []; let inPic = false;
    for (const line of String(t || '').split(/\r?\n/)) {
      if (/^\s*>\s*\[!picture\]/i.test(line)) { inPic = true; if (pics.length) pics.push(''); pics.push(line); continue; }
      if (inPic && /^\s*>/.test(line)) { pics.push(line); continue; }
      inPic = false; text.push(line);
    }
    return { text: text.join('\n').replace(/^\s+|\s+$/g, ''), pics: pics.join('\n') };
  }
  function parseThreads(t, into) {
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]\s*(Up|Down|Across)\b[^:]*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase();
      into[k] = into[k].concat(links(m[2]));
    }
  }
  function parseBehind(t, into) {
    let cur = null;
    for (const line of t.split(/\r?\n/)) {
      const h = line.match(/^###\s+(.+?)\s*$/);
      if (h) { cur = { head: h[1], lines: [] }; into.parts.push(cur); continue; }
      if (!cur) { cur = { head: '', lines: [] }; into.parts.push(cur); }
      cur.lines.push(line);
      const q = line.match(/^\s*[-*]?\s*\?\s+(.+)$/);
      if (q && /^open/i.test(cur.head)) into.open.push(q[1].trim());
    }
    for (const p of into.parts) p.text = p.lines.join('\n').replace(/^\s*\n|\n\s*$/g, '');
    into.parts = into.parts.filter(p => p.head || p.text);
  }
  function hasText(p) {
    if (p.line.trim() || p.what.trim() || p.facts.some(f => f.value) || p.bonds.length || p.ties.length || p.minor.length) return true;
    return p.secs.some(s => s.kind !== 'members' && s.text.replace(/^\s*[-*]\s*$/gm, '').trim());
  }

  function folderOfRel(rel) {
    const parts = String(rel).split('/');
    return parts.length > 1 && FOLDER_BY_ID[parts[0]] ? parts[0] : '';
  }
  function build(files) {
    const pages = new Map(), byLower = new Map(), others = new Set(), landings = new Map();
    for (const f of files || []) {
      const rel = String(f.rel || '').replace(/\\/g, '/');
      if (!/\.md$/i.test(rel)) continue;
      const base = rel.split('/').pop().replace(/\.md$/i, '');
      const folder = folderOfRel(rel);
      if (!folder) { others.add(base); continue; }   // Timeline, Structure, Infinity Parables: live homes, not wiki pages
      const p = parseNote(f.text, base);
      p.rel = rel; p.folder = folder; p.mtimeMs = f.mtimeMs || 0; p.raw = String(f.text || '');
      if (rel.startsWith(SHELF_DIR + '/')) p.onShelf = true;   // the shelf: a page per section and fact line
      const fo = FOLDER_BY_ID[folder];
      p.suit = fo.suit;
      if (base === PREFIX + fo.name && folder !== '00 Index') { landings.set(folder, p); p.landing = true; }
      pages.set(base, p); byLower.set(base.toLowerCase(), base);
    }
    const index = pages.get(PREFIX + 'Index') || null;
    const w = { pages, byLower, others, landings, index };
    for (const p of pages.values()) {
      p.top = p.landing || p === index ? null : topOf(w, p);
      if (p.top && p.folder !== 'Behind the scenes') p.suit = TOP_BY_NAME[p.top.toLowerCase()].suit;
      p.empty = !hasText(p);
      p.members = []; p.tiedBy = [];
    }
    for (const p of pages.values()) for (const t of p.ties) {
      const r = resolve(w, t.target);
      if (r && r.kind === 'page' && r.name !== p.name) pages.get(r.name).tiedBy.push({ name: p.name, word: t.word });
    }
    for (const p of pages.values()) {
      for (const k of PARENT_KEYS) for (const l of p.parents[k]) {
        if (!l.target) continue;
        const r = resolve(w, l.target);
        if (r && r.kind === 'page' && r.name !== p.name) pages.get(r.name).members.push({ name: p.name, rel: k });
      }
    }
    graphParents(w);
    return w;
  }
  function graphParents(w) {
    const INDEX = PREFIX + 'Index';
    const kids = new Map([...w.pages.keys()].map(n => [n, []]));
    for (const p of w.pages.values()) {
      p.up = [];
      if (p.name === INDEX) continue;
      if (!p.landing) for (const k of ['where', 'what', 'with']) for (const l of p.parents[k]) {
        const r = l.target && resolve(w, l.target);
        if (r && r.kind === 'page' && r.name !== p.name && !p.up.includes(r.name)) p.up.push(r.name);
      }
      if (!p.up.length) {
        const land = w.landings.get(p.folder);
        if (land && land !== p) p.up.push(land.name);
        else if (w.index) p.up.push(INDEX);
      }
      for (const u of p.up) kids.get(u).push(p.name);
    }
    for (const p of w.pages.values()) { p.depth = null; p.treeUp = null; }
    if (!w.index) return;
    w.index.depth = 0;
    const queue = [INDEX];
    while (queue.length) {
      const n = queue.shift(), d = w.pages.get(n).depth;
      for (const c of kids.get(n).slice().sort()) {
        const q = w.pages.get(c);
        if (q.depth == null) { q.depth = d + 1; q.treeUp = n; queue.push(c); }
      }
    }
  }
  function topOf(w, p, seen) {
    seen = seen || new Set();
    if (seen.has(p.name)) return null;
    seen.add(p.name);
    if (p.topSet && seen.size === 1) return p.topSet;   // v6: sorted by hand wins, for this page only
    const first = p.parents.what[0];
    if (first) {
      if (first.top) return first.top;
      const r = resolve(w, first.target);
      if (r && r.kind === 'page') {
        const q = w.pages.get(r.name);
        const t = topOf(w, q, seen);
        if (t) return !q.kindPage && t === 'Group' ? 'Being' : t;
      }
    }
    return FOLDER_TOP[p.folder] || null;
  }
  function kindChain(w, p) {
    const out = [], seen = new Set([p.name]);
    let f = p.parents.what[0];
    while (f && !f.top) {
      const r = resolve(w, f.target); const q = r && r.kind === 'page' ? w.pages.get(r.name) : null;
      if (!q || !q.kindPage || seen.has(q.name)) break;
      out.push(q.title); seen.add(q.name);
      f = q.parents.what[0];
    }
    return out;
  }
  function kindLoops(w, name) {
    const seen = new Set(); let cur = w.pages.get(name);
    while (cur) {
      if (seen.has(cur.name)) return true;
      seen.add(cur.name);
      const f = cur.parents.what[0];
      if (!f || f.top) return false;
      const r = resolve(w, f.target);
      cur = r && r.kind === 'page' ? w.pages.get(r.name) : null;
    }
    return false;
  }
  function depthOf(p) { return p ? p.depth : null; }
  function resolve(w, target) {
    if (!w || !target) return null;
    const t = String(target).trim();
    if (w.pages.has(t)) return { kind: 'page', name: t };
    const lo = w.byLower.get(t.toLowerCase()); if (lo) return { kind: 'page', name: lo };
    if (w.others.has(t)) return { kind: 'home', name: t };
    return { kind: 'missing', name: t };
  }
  function kindKey(w, p) {
    const f = p.parents.what[0];
    if (!f) return { key: '', title: '' };
    if (f.top) return { key: 'top:' + f.top, title: f.top };
    const r = resolve(w, f.target) || {};
    const q = r.kind === 'page' ? w.pages.get(r.name) : null;
    return { key: r.name || f.target, title: q ? q.title : f.label || plainName(f.target) };
  }
  function groupByKind(w, list) {
    const groups = new Map();
    for (const p of list) {
      const k = kindKey(w, p);
      if (!groups.has(k.key)) groups.set(k.key, { kind: k.key, kindTitle: k.title, pages: [] });
      groups.get(k.key).pages.push({ name: p.name, title: p.title, suit: p.suit, empty: p.empty, kindPage: p.kindPage });
    }
    return [...groups.values()].sort((a, b) => (a.kind === '' ? 1 : b.kind === '' ? -1 : a.kindTitle.localeCompare(b.kindTitle)));
  }
  function landing(w, folderId) {
    const list = [...w.pages.values()].filter(p => p.folder === folderId && !p.landing && !p.onShelf && p.name !== PREFIX + 'Index')
      .sort((a, b) => a.title.localeCompare(b.title));
    return groupByKind(w, list);
  }
  function kindTree(w, folderId) {
    const inFolder = [...w.pages.values()].filter(p => p.folder === folderId && !p.landing && !p.onShelf && p.name !== PREFIX + 'Index');
    const nodes = new Map();
    const node = (key, title, page) => { if (!nodes.has(key)) nodes.set(key, { key, title, page: page || '', parent: '', kids: [], pages: [], total: 0 }); return nodes.get(key); };
    const upKind = (q) => {
      const f = q.parents.what[0]; if (!f || f.top) return null;
      const r = resolve(w, f.target); const k = r && r.kind === 'page' ? w.pages.get(r.name) : null;
      return k && k.kindPage && k.name !== q.name ? k : null;
    };
    const addKind = (q, seen) => {
      seen = seen || new Set(); const n = node(q.name, q.title, q.name);
      if (seen.has(q.name)) return n; seen.add(q.name);
      const up = upKind(q); if (up && !n.parent) { n.parent = up.name; addKind(up, seen); }
      return n;
    };
    for (const p of inFolder) {
      if (p.kindPage) { addKind(p); continue; }
      const k = kindKey(w, p); let n;
      if (!k.key) n = node('', 'No kind yet');
      else if (k.key.startsWith('top:')) n = node(k.key, k.title);
      else { const q = w.pages.get(k.key); n = q && q.kindPage ? addKind(q) : node(k.key, k.title, q ? q.name : ''); }
      n.pages.push({ name: p.name, title: p.title, suit: p.suit, empty: !!p.empty });
    }
    for (const n of nodes.values()) {
      const seen = new Set([n.key]); let c = n.parent ? nodes.get(n.parent) : null;
      while (c) { if (seen.has(c.key)) { n.parent = ''; break; } seen.add(c.key); c = c.parent ? nodes.get(c.parent) : null; }
    }
    for (const n of nodes.values()) { if (n.parent && nodes.has(n.parent)) nodes.get(n.parent).kids.push(n.key); else n.parent = ''; }
    const total = (n, seen) => { if (seen.has(n.key)) return 0; seen.add(n.key); return n.pages.length + n.kids.reduce((a, k) => a + total(nodes.get(k), seen), 0); };
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    for (const n of nodes.values()) { n.pages.sort(byTitle); n.kids.sort((a, b) => byTitle(nodes.get(a), nodes.get(b))); n.total = total(n, new Set()); }
    const roots = [...nodes.values()].filter(n => !n.parent).sort((a, b) => a.key === '' ? 1 : b.key === '' ? -1 : byTitle(a, b)).map(n => n.key);
    return { nodes, roots, pages: inFolder.filter(p => !p.kindPage).length };
  }
  function kindPages(tree, key) {
    const out = [], seen = new Set();
    const walk = (k) => { const n = tree.nodes.get(k); if (!n || seen.has(k)) return; seen.add(k); for (const p of n.pages) out.push(Object.assign({ kind: n.title, kindKey: n.key }, p)); n.kids.forEach(walk); };
    if (key === '*') for (const n of tree.nodes.values()) for (const p of n.pages) out.push(Object.assign({ kind: n.title, kindKey: n.key }, p));
    else walk(key);
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }
  function membersOf(w, name) {
    const p = w.pages.get(name); if (!p) return { groups: [], minor: [], book: [] };
    const seen = new Set(), inWorld = [], book = [];
    for (const m of p.members) {
      if (seen.has(m.name + m.rel)) continue; seen.add(m.name + m.rel);
      const q = w.pages.get(m.name); if (!q) continue;
      if (q.noRecord && m.rel !== 'book') continue;   // 22 Nov evening: a page the Concordate holds no record of is not listed in-world
      (m.rel === 'book' ? book : inWorld).push(q);
    }
    const uniq = (l) => [...new Map(l.map(q => [q.name, q])).values()].sort((a, b) => a.title.localeCompare(b.title));
    const have = new Set(uniq(inWorld).map(q => q.title.toLowerCase()));
    return { groups: groupByKind(w, uniq(inWorld)), book: uniq(book).map(q => ({ name: q.name, title: q.title, suit: q.suit })),
      minor: p.minor.filter(x => !have.has(x.name.toLowerCase())) };
  }
  const PIC_RE = /^\s*>\s*\[!picture\]\s*(\w*)\s*\n\s*>\s*!\[\[([^\]|]+)(?:\|[^\]]*)?\]\](?:\s*\n\s*>\s*(?!\[!)([^\n]*))?/gim;
  function pictures(w) {
    const out = new Map();
    for (const p of w.pages.values()) {
      const src = String(p.raw || '').replace(/\r\n/g, '\n'); let m; PIC_RE.lastIndex = 0;
      while ((m = PIC_RE.exec(src))) {
        const file = m[2].trim().split('/').pop();
        const it = out.get(file) || { file, kinds: [], captions: [], pages: [] };
        const k = picKind(m[1]); if (!it.kinds.includes(k)) it.kinds.push(k);
        const cap = (m[3] || '').trim(); if (cap && !it.captions.includes(cap)) it.captions.push(cap);
        if (!it.pages.includes(p.name)) it.pages.push(p.name);
        out.set(file, it);
      }
    }
    return out;
  }
  function counts(w) {
    const c = {}; for (const f of FOLDERS) c[f.id] = 0;
    for (const p of w.pages.values()) if (!p.landing && !p.onShelf && p.name !== PREFIX + 'Index') c[p.folder]++;
    return c;
  }
  function find(w, q, max, filter) {
    const s = String(q || '').trim().toLowerCase(); if (!s) return [];
    const hits = [];
    for (const p of w.pages.values()) {
      if (filter && !filter(p)) continue;
      const al = [].concat(p.fm.aliases || []).map(String);
      const keys = [p.title, plainName(p.name)].concat(al).map(x => x.toLowerCase());
      let score = -1;
      for (const k of keys) { if (k.startsWith(s)) score = Math.max(score, 2); else if (k.includes(s)) score = Math.max(score, 1); }
      if (score >= 0) hits.push({ name: p.name, title: p.title, suit: p.suit, folder: p.folder, score });
    }
    hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return hits.slice(0, max || 8);
  }

  const BUILTIN_FORMS = { Story: 'text', Bonds: 'links', Ties: 'links', Members: 'list', Holds: 'list', Who: 'links' };
  function shelfName(p) {
    const n = plainName(p.name);
    return String(p.fm.name || n.replace(/^(Section|Fact)\s+-\s+/, '')).trim();
  }
  function shelf(w) {
    const sections = new Map(), facts = new Map();
    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x).trim()).filter(Boolean);
    for (const p of w.pages.values()) {
      if (!p.shelf) continue;
      const it = { name: shelfName(p), page: p.name, form: String(p.fm.form || 'text').toLowerCase(), synonyms: list(p.fm.synonyms),
        default_for: list(p.fm.default_for), order: Number(p.fm.order) || 50, empty: p.empty };
      (p.shelf === 'fact' ? facts : sections).set(it.name.toLowerCase(), it);
    }
    const builtin = !sections.size && !facts.size;
    const bs = new Map(), bf = new Map();
    TOPS.forEach((t) => {
      t.sections.forEach((n, i) => { const k = n.toLowerCase(); const it = bs.get(k) || { name: n, page: '', form: BUILTIN_FORMS[n] || 'text', synonyms: [], default_for: [], order: n === 'Story' ? 10 : 20 + i * 10 }; it.default_for.push(t.name); bs.set(k, it); });
      t.facts.forEach((n, i) => { const k = n.toLowerCase(); const it = bf.get(k) || { name: n, page: '', form: 'text', synonyms: [], default_for: [], order: 10 + i * 10 }; it.default_for.push(t.name); bf.set(k, it); });
    });
    for (const [k, it] of bs) if (!sections.has(k)) sections.set(k, it);
    for (const [k, it] of bf) if (!facts.has(k)) facts.set(k, it);
    const uses = (map, get) => { for (const it of map.values()) it.uses = 0; for (const p of w.pages.values()) { if (p.onShelf) continue; for (const n of new Set(get(p).map(x => x.toLowerCase()))) { const it = map.get(n); if (it) it.uses++; } } };
    uses(sections, p => p.secs.map(s => s.head).concat(p.bonds.length ? ['Bonds'] : []));
    uses(facts, p => p.facts.map(f => f.name));
    const sort = (m) => [...m.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return { sections: sort(sections), facts: sort(facts), builtin };
  }
  function layoutFor(w, top, kinds) {
    const sh = shelf(w);
    const want = new Set([String(top || '')].concat(kinds || []).map(x => String(x).toLowerCase()).filter(Boolean));
    const of = (l) => l.filter(it => it.default_for.some(x => want.has(x.toLowerCase()))).map(it => it.name);
    let sections = of(sh.sections), facts = of(sh.facts);
    if (!sections.length) sections = ['Story'];
    if (sections[0] !== 'Story' && sections.includes('Story')) sections = ['Story'].concat(sections.filter(x => x !== 'Story'));
    return { sections, facts };
  }
  function sing(x) {
    if (x.length > 4 && /ies$/.test(x)) return x.slice(0, -3) + 'y';
    if (x.length > 4 && /(sses|xes|zes|ches|shes)$/.test(x)) return x.slice(0, -2);
    if (x.length > 3 && /s$/.test(x) && !/(ss|us|is)$/.test(x)) return x.slice(0, -1);
    return x;
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      .split(/\s+/).filter(Boolean).map(sing).join(' ');
  }
  function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function twin(items, name) {
    const n = norm(name); if (!n) return null;
    let best = null;
    const rank = { same: 0, synonym: 1, close: 2, part: 3 };
    for (const it of items) {
      const names = [it.name].concat(it.synonyms || []);
      for (let i = 0; i < names.length; i++) {
        const m = norm(names[i]); if (!m) continue;
        let why = null;
        if (m === n) why = i ? 'synonym' : 'same';
        else if (Math.min(m.length, n.length) >= 4 && lev(m, n) <= 2) why = 'close';
        else if (Math.min(m.length, n.length) >= 3 && lev(m, n) <= 1) why = 'close';
        else if (n.startsWith(m + ' ') || m.startsWith(n + ' ') || n.split(' ').includes(m) && m.length >= 4) why = 'part';
        if (why && (!best || rank[why] < rank[best.why])) best = { item: it, why, as: names[i] };
      }
    }
    return best;
  }
  function suggestSections(w, p) {
    const sibs = new Set();
    for (const k of PARENT_KEYS) for (const l of p.parents[k]) {
      const r = l.target && resolve(w, l.target);
      if (!r || r.kind !== 'page') continue;
      for (const m of w.pages.get(r.name).members) if (m.name !== p.name) sibs.add(m.name);
    }
    const count = new Map(), mine = new Set(p.secs.map(s => s.head.toLowerCase()));
    for (const n of sibs) {
      const q = w.pages.get(n);
      for (const h of new Set(q.secs.map(s => s.head).concat(q.bonds.length ? ['Bonds'] : []))) {
        if (mine.has(h.toLowerCase()) || /^(ii\s+its story|i\s+what it is)$/i.test(h)) continue;
        count.set(h, (count.get(h) || 0) + 1);
      }
    }
    return [...count.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, c]) => ({ name, count: c }));
  }
  function kinds(w) {
    const out = TOPS.map(t => ({ name: t.name, top: t.name, title: t.name, isTop: true }));
    for (const p of w.pages.values()) if (p.kindPage) out.push({ name: p.name, title: p.title, top: p.top, synonyms: [].concat(p.fm.aliases || []) });
    return out;
  }
  const BACK = { teacher: 'student', student: 'teacher', mentor: 'student', master: 'apprentice', apprentice: 'master', parent: 'child',
    child: 'parent', mother: 'child', father: 'child', son: 'parent', daughter: 'parent', friend: 'friend', 'best friend': 'best friend',
    rival: 'rival', foil: 'foil', mirror: 'mirror', sibling: 'sibling', brother: 'sibling', sister: 'sibling', ally: 'ally', enemy: 'enemy',
    partner: 'partner', spouse: 'spouse', husband: 'wife', wife: 'husband', creator: 'creation', creation: 'creator', leader: 'follower',
    follower: 'leader', hunter: 'hunted', hunted: 'hunter', escort: 'escorted' };
  function backWord(w, word) {
    const k = String(word || '').trim().toLowerCase(); if (!k) return '';
    if (w) for (const p of w.pages.values()) for (const b of p.bonds) {
      if (b.word.toLowerCase() !== k) continue;
      const r = resolve(w, b.target); const q = r && r.kind === 'page' ? w.pages.get(r.name) : null;
      const back = q && q.bonds.find(x => (resolve(w, x.target) || {}).name === p.name);
      if (back && back.word) return back.word;
    }
    return BACK[k] || k;
  }


  const ORDER = ['what', 'story', 'threads', 'margin', 'behind'];
  const HEADS = { what: 'I What it is', story: 'II Its story', threads: 'III Its threads', margin: "Mentor's margin", behind: 'Behind the scenes' };
  function sections(text) {
    const src = String(text || '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    let i = 0, inFm = false;
    if (lines[0] === '---') { inFm = true; i = 1; while (i < lines.length && lines[i] !== '---') i++; i++; }
    const headEnd = (() => { for (let k = i; k < lines.length; k++) if (/^##\s+/.test(lines[k])) return k; return lines.length; })();
    const out = { head: lines.slice(0, headEnd).join('\n'), secs: [] };
    let cur = null;
    for (let k = headEnd; k < lines.length; k++) {
      const h = lines[k].match(/^##\s+(.+?)\s*$/);
      if (h) { cur = { heading: lines[k], kind: kindOf(h[1]), lines: [] }; out.secs.push(cur); continue; }
      cur.lines.push(lines[k]);
    }
    for (const s of out.secs) { s.body = s.lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''); delete s.lines; }
    return out;
  }
  function bodyOf(text, kind) { const s = sections(text).secs.find(x => x.kind === kind); return s ? s.body : ''; }
  function compose(text, edits) {
    const sp = sections(text);
    const secs = sp.secs.map(s => Object.assign({}, s));
    for (const k of Object.keys(edits || {})) {
      if (!HEADS[k]) continue;
      const v = String(edits[k] == null ? '' : edits[k]).replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '');
      const at = secs.findIndex(s => s.kind === k);
      if (at >= 0) { secs[at].body = v; continue; }
      if (!v) continue;
      const rank = ORDER.indexOf(k);
      let ins = secs.length;
      for (let j = 0; j < secs.length; j++) { const r = ORDER.indexOf(secs[j].kind); if (r > rank) { ins = j; break; } }
      secs.splice(ins, 0, { heading: '## ' + HEADS[k], kind: k, body: v });
    }
    let out = sp.head.replace(/\n+$/, '');
    for (const s of secs) {
      if (!s.body && HEADS[s.kind] && edits && Object.prototype.hasOwnProperty.call(edits, s.kind)) continue;
      out += '\n\n' + s.heading + (s.body ? '\n' + s.body : '');
    }
    return out + '\n';
  }
  function setFrontmatter(text, key, value) {
    const src = String(text || '').replace(/\r\n/g, '\n');
    const line = value == null || value === '' ? null : key + ': ' + (/[:#\[\]{}"']/.test(String(value)) ? JSON.stringify(String(value)) : String(value));
    if (!src.startsWith('---\n')) return line ? '---\n' + line + '\n---\n' + src : src;
    const end = src.indexOf('\n---', 3);
    const head = src.slice(4, end).split('\n'), rest = src.slice(end);
    const i = head.findIndex(l => new RegExp('^' + key + '\\s*:').test(l));
    if (i >= 0) { if (line) head[i] = line; else head.splice(i, 1); }
    else if (line) head.push(line);
    return '---\n' + head.join('\n') + rest;
  }
  const PIC_KINDS = ['canon', 'inspiration', 'sketch'];
  function picKind(k) { k = String(k || '').trim().toLowerCase(); return PIC_KINDS.includes(k) ? k : 'canon'; }
  function pictureBlock(kind, file, caption) {
    return '> [!picture] ' + picKind(kind) + '\n> ![[' + file + ']]' + (caption ? '\n> ' + String(caption).replace(/\n/g, ' ') : '');
  }
  function addPicture(text, where, kind, file, caption) {
    const block = pictureBlock(kind, file, caption);
    if (kind === 'inspiration' || kind === 'sketch' || where === 'behind') {
      const b = bodyOf(text, 'behind');
      const m = b.match(/^### Pictures[^\n]*$/m);
      let nb;
      if (m) {
        const at = b.indexOf(m[0]) + m[0].length;
        const next = b.slice(at).search(/\n### /);
        const end = next < 0 ? b.length : at + next;
        nb = b.slice(0, end).replace(/\s+$/, '') + '\n\n' + block + b.slice(end);
      } else nb = (b ? b.replace(/\s+$/, '') + '\n\n' : '') + '### Pictures\n' + block;
      return compose(text, { behind: nb });
    }
    const k = where === 'story' ? 'story' : 'what';
    if (k === 'what' && !sections(text).secs.some(s => s.kind === 'what')) {
      const sp = sections(text); sp.head = sp.head.replace(/\s+$/, '') + '\n\n' + block; return assemble(sp);
    }
    const cur = bodyOf(text, k);
    return compose(text, { [k]: (cur ? cur.replace(/\s+$/, '') + '\n\n' : '') + block });
  }

  function assemble(sp) {
    let out = sp.head.replace(/\n+$/, '');
    for (const s of sp.secs) out += '\n\n' + s.heading + (s.body ? '\n' + s.body : '');
    return out + '\n';
  }
  const headOf = (s) => s.heading.replace(/^##\s+/, '').trim();
  function fmList(items) {
    const l = (items || []).map(x => String(x).trim()).filter(Boolean);
    return l.length ? '[' + l.map(x => JSON.stringify(x)).join(', ') + ']' : null;
  }
  function setFmRaw(text, key, raw) {
    const src = String(text || '').replace(/\r\n/g, '\n');
    const line = raw == null ? null : key + ': ' + raw;
    if (!src.startsWith('---\n')) return line ? '---\n' + line + '\n---\n' + src : src;
    const end = src.indexOf('\n---', 3);
    const head = src.slice(4, end).split('\n'), rest = src.slice(end);
    let i = head.findIndex(l => new RegExp('^' + key + '\\s*:').test(l));
    if (i >= 0) {   // a block list under the key goes too
      let j = i + 1; while (j < head.length && /^\s+-\s/.test(head[j])) j++;
      head.splice(i, j - i, ...(line ? [line] : []));
    } else if (line) head.push(line);
    return '---\n' + head.join('\n') + rest;
  }
  function setParents(text, parents) {
    let t = String(text || '');
    for (const k of PARENT_KEYS) if (parents && Object.prototype.hasOwnProperty.call(parents, k)) t = setFmRaw(t, k, fmList(parents[k]));
    return setFmRaw(t, 'up', null);
  }
  function linkOf(name) { const n = String(name || '').trim(); if (!n) return ''; if (TOP_BY_NAME[n.toLowerCase()]) return TOP_BY_NAME[n.toLowerCase()].name; return '[[' + (n.startsWith(PREFIX) ? n : PREFIX + n) + ']]'; }
  function parentStrings(list) { return (list || []).map(l => l.top ? l.top : '[[' + l.target + ']]'); }
  function setLead(text, line) {
    const sp = sections(text);
    const lines = sp.head.split('\n');
    const t = lines.findIndex(l => /^#\s+/.test(l));
    const keep = t >= 0 ? lines.slice(0, t + 1) : lines;
    const v = String(line == null ? '' : line).replace(/\r?\n+/g, ' ').trim();
    const pics = splitPics(lines.slice(t >= 0 ? t + 1 : lines.length).join('\n')).pics;   // the lead's pictures stay
    sp.head = keep.join('\n') + (v ? '\n\n' + v : '') + (pics ? '\n\n' + pics : '');
    return assemble(sp);
  }
  function setSection(text, head, body) {
    const sp = sections(text);
    const want = String(head).trim().toLowerCase();
    const at = sp.secs.findIndex(s => headOf(s).toLowerCase() === want);
    const v = body == null ? null : String(body).replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '');
    if (at >= 0) { if (v == null) sp.secs.splice(at, 1); else sp.secs[at].body = v; return assemble(sp); }
    if (v == null) return assemble(sp);
    const sec = { heading: '## ' + String(head).trim(), kind: kindOf(String(head)), body: v };
    let ins = sp.secs.findIndex(s => s.kind === 'margin' || s.kind === 'behind');
    if (sec.kind === 'facts') ins = 0;
    if (ins < 0) ins = sp.secs.length;
    sp.secs.splice(ins, 0, sec);
    return assemble(sp);
  }
  function sectionBody(text, head) { const s = sections(text).secs.find(x => headOf(x).toLowerCase() === String(head).trim().toLowerCase()); return s ? s.body : null; }
  function factsBody(facts) {
    const fs = (facts || []).filter(f => f && f.name), line = f => '- ' + f.name + ': ' + String(f.value || '').trim();
    const out = fs.filter(f => !f.group).map(line), groups = [];
    for (const f of fs) if (f.group && !groups.includes(f.group)) groups.push(f.group);
    for (const g of groups) { if (out.length) out.push(''); out.push('### ' + g); for (const f of fs) if (f.group === g) out.push(line(f)); }
    return out.join('\n');
  }
  function setFacts(text, facts) { const b = factsBody(facts); return setSection(text, 'Facts', b || null); }
  function setBond(text, target, word) {
    const t = String(target).startsWith(PREFIX) ? String(target) : PREFIX + target;
    const cur = sectionBody(text, 'Bonds');
    const lines = (cur || '').split('\n').filter(l => l.trim() && !(parseBonds(l)[0] && parseBonds(l)[0].target.toLowerCase() === t.toLowerCase()));
    lines.push('- [[' + t + ']]' + (String(word || '').trim() ? ' · ' + String(word).trim() : ''));
    return setSection(text, 'Bonds', lines.join('\n'));
  }
  function renameHeading(text, old, neu) {
    const sp = sections(text); let n = 0;
    for (const s of sp.secs) if (headOf(s).toLowerCase() === String(old).trim().toLowerCase()) { s.heading = '## ' + String(neu).trim(); s.kind = kindOf(String(neu)); n++; }
    return n ? assemble(sp) : String(text);
  }
  function renameFactLine(text, old, neu) {
    const b = sectionBody(text, 'Facts'); if (b == null) return String(text);
    const facts = parseFacts(b); let n = 0;
    for (const f of facts) if (f.name.toLowerCase() === String(old).trim().toLowerCase()) { f.name = String(neu).trim(); n++; }
    return n ? setFacts(text, facts) : String(text);
  }
  function linkMinor(text, line, name) {
    const t = String(name).startsWith(PREFIX) ? String(name) : PREFIX + name;
    const src = String(text).replace(/\r\n/g, '\n').split('\n');
    const i = src.findIndex(l => l.replace(/\s+$/, '') === String(line).replace(/\s+$/, ''));
    if (i < 0) return String(text);
    const m = src[i].match(/^(\s*[-*]\s+)(.+?)(\s+[·–—]\s+.*)?$/);
    src[i] = (m ? m[1] : '- ') + '[[' + t + (m && m[2].trim() !== plainName(t) ? '|' + m[2].trim() : '') + ']]' + (m && m[3] ? m[3] : '');
    return src.join('\n');
  }
  function topFolder(top, aspect) {
    const t = TOP_BY_NAME[String(top || '').toLowerCase()];
    if (!t) return 'Behind the scenes';
    return t.folder;   // v6: Aura is one folder; the aspects are parent pages, not folders
  }
  function stamp(d) { d = d || new Date(); const z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  function cleanTitle(s) { return String(s || '').replace(/[\\/:*?"<>|\[\]#^\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 80).trim(); }
  function newPageText(o) {
    const folder = o.folder || topFolder(o.top, o.aspect);
    const fm = ['clearance: 2', 'status: active', 'inheritable: False', 'created: ' + (o.created || stamp()), 'tier: leaf', 'category: Evrynthing',
      'type: ' + (TYPE_OF_FOLDER[folder] || 'page')];
    if (o.kindPage) fm.push('kind_page: true');
    for (const k of PARENT_KEYS) { const v = fmList(o[k]); if (v) fm.push(k + ': ' + v); }
    let t = '---\n' + fm.join('\n') + '\n---\n\n# ' + o.title + '\n';
    if (o.line && String(o.line).trim()) t += '\n' + String(o.line).replace(/\r?\n+/g, ' ').trim() + '\n';
    if (!o.empty) {
      if ((o.facts || []).length) t += '\n## Facts\n' + o.facts.map(f => '- ' + f + ': ').join('\n') + '\n';
      for (const s of o.sections || []) t += '\n## ' + s + '\n';
    }
    if (o.top && TOP_BY_NAME[String(o.top).toLowerCase()] && o.topSet) t = setFmRaw(t, 'top', TOP_BY_NAME[String(o.top).toLowerCase()].name);
    if (o.history) t += '\n## Behind the scenes\n### History\n- ' + o.history + '\n';   // v6: no bookkeeping lines by default
    return t;
  }
  function shelfPageText(o) {
    const fm = ['clearance: 2', 'status: active', 'inheritable: False', 'created: ' + (o.created || stamp()), 'tier: leaf', 'category: Evrynthing',
      'type: behind-the-scenes', 'shelf: ' + (o.kind === 'fact' ? 'fact' : 'section')];
    if (o.kind !== 'fact') fm.push('form: ' + (o.form || 'text'));
    fm.push('synonyms: ' + (fmList(o.synonyms) || '[]'));
    fm.push('default_for: ' + (fmList(o.default_for) || '[]'));
    if (o.order) fm.push('order: ' + o.order);
    return '---\n' + fm.join('\n') + '\n---\n\n# ' + o.name + '\n' + (o.line ? '\n' + o.line + '\n' : '') +
      (o.history ? '\n## Behind the scenes\n### History\n- ' + o.history + '\n' : '');
  }
  function shelfRel(kind, name) { return SHELF_DIR + '/' + PREFIX + (kind === 'fact' ? 'Fact - ' : 'Section - ') + cleanTitle(name) + '.md'; }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const CANON_RE = /\s\^canon-[0-9a-f]{6}\s*$/;
  const CANON_MARK = '<span class="mk-canon" title="Made canon in Canon">Canon</span>';
  function inline(s, w) {
    const canon = CANON_RE.test(String(s));
    return inlineText(canon ? String(s).replace(CANON_RE, '') : s, w) + (canon ? ' ' + CANON_MARK : '');
  }
  function inlineText(s, w) {
    let out = '', last = 0, m; LINK_RE.lastIndex = 0;
    const src = String(s);
    while ((m = LINK_RE.exec(src))) {
      out += fmt(esc(src.slice(last, m.index)));
      const target = m[1].trim(), label = (m[3] || '').trim() || plainName(target);
      const r = resolve(w, target) || { kind: 'missing', name: target };
      out += '<a class="wl ' + r.kind + '" data-kind="' + r.kind + '" data-target="' + esc(r.name) + '"' +
        (r.kind === 'missing' ? ' title="No page yet"' : r.kind === 'home' ? ' title="Lives in its own home: opens in the vault"' : '') + '>' + fmt(esc(label)) + '</a>';
      last = m.index + m[0].length;
    }
    return out + fmt(esc(src.slice(last)));
  }
  function fmt(h) {
    return h.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  }
  function render(md, w, opts) {
    opts = opts || {};
    const lines = String(md || '').split(/\r?\n/);
    let html = '', para = [], list = [], quote = null, table = [];
    const flushTable = () => {
      if (!table.length) return;
      const cells = r => r.replace(/^\s*\||\|\s*$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(cells);
      const head = table.length > 1 && /^\s*\|?\s*:?-{2,}/.test(table[1]) ? rows.shift() : null;
      html += '<table class="wt">' + (head ? '<thead><tr>' + head.map(c => '<th>' + inline(c, w) + '</th>').join('') + '</tr></thead>' : '') +
        '<tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c, w) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      table = [];
    };
    const flushPara = () => { if (para.length) { html += '<p>' + inline(para.join(' '), w) + '</p>'; para = []; } };
    const flushList = () => {
      if (!list.length) return;
      const base = Math.min(...list.map(x => x.ind));
      let depth = 0; html += '<ul>';
      list.forEach((it, i) => {
        const d = it.ind > base ? 1 : 0;
        if (d > depth) { html += '<ul>'; depth = d; } else if (d < depth) { html += '</li></ul></li>'; depth = d; } else if (i) html += '</li>';
        html += '<li' + (it.open ? ' class="t-open"' : '') + '>' + (it.open && opts.truth ? '<span class="mk-open" aria-label="open">?</span>' : '') + inline(it.text, w);
      });
      html += depth ? '</li></ul></li></ul>' : '</li></ul>';
      list = [];
    };
    const flushQuote = () => {
      if (!quote) return;
      if (quote.picture != null) {
        const img = quote.lines.map(l => l.match(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/)).find(Boolean);
        const cap = quote.lines.filter(l => l.trim() && !/!\[\[/.test(l)).join(' ').trim();
        const kind = picKind(quote.picture);
        html += '<figure class="pic ' + kind + '"' + (img ? ' data-src="' + esc(img[1].trim()) + '"' : '') + '><div class="pic-frame">' +
          (img ? '' : '<span class="pic-empty">No picture yet</span>') + '</div>' +
          '<figcaption><span class="pic-lbl ' + kind + '">' + kind.replace(/^\w/, c => c.toUpperCase()) + '</span>' + (cap ? inline(cap, w) : '') + '</figcaption></figure>';
        quote = null; return;
      }
      if (quote.belief != null) {
        html += '<div class="t-belief">' + (opts.truth ? '<span class="mk-belief"><i></i>' + esc(quote.belief) + '</span>' : '<span class="mk-belief plain">' + esc(quote.belief) + '</span>') +
          '<div>' + render(quote.lines.join('\n'), w, opts) + '</div></div>';
      } else html += '<blockquote>' + render(quote.lines.join('\n'), w, opts) + '</blockquote>';
      quote = null;
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const q = line.match(/^\s*>\s?(.*)$/);
      if (q) {
        flushPara(); flushList();
        const b = q[1].match(/^\[!belief\]\s*(.*)$/i);
        if (b) { flushQuote(); quote = { belief: b[1].trim() || 'someone', lines: [] }; continue; }
        const pc = q[1].match(/^\[!picture\]\s*(.*)$/i);
        if (pc) { flushQuote(); quote = { picture: (pc[1].trim().toLowerCase() || 'canon'), lines: [] }; continue; }
        if (!quote) quote = { belief: null, lines: [] };
        quote.lines.push(q[1]); continue;
      }
      flushQuote();
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); table.push(line); continue; }
      flushTable();
      if (!line.trim()) { flushPara(); flushList(); continue; }
      const em = line.match(/^\s*!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/);
      if (em && /\.(png|jpe?g|webp|gif)$/i.test(em[1])) { flushPara(); flushList(); html += '<figure class="pic plain" data-src="' + esc(em[1].trim()) + '"><div class="pic-frame"></div></figure>'; continue; }
      const h = line.match(/^(#{3,6})\s+(.+)$/);
      if (h) { flushPara(); flushList(); const lv = Math.min(5, h[1].length + 0); html += '<h' + lv + '>' + inline(h[2], w) + '</h' + lv + '>'; continue; }
      const li = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (li) {
        flushPara();
        const o = li[2].match(/^\?\s+(.*)$/);
        list.push({ ind: li[1].replace(/\t/g, '  ').length, text: o && opts.openMarks ? o[1] : li[2], open: !!(o && opts.openMarks) });
        continue;
      }
      if (list.length && /^\s{2,}\S/.test(line)) { list[list.length - 1].text += ' ' + line.trim(); continue; }
      flushList();
      para.push(line.trim());
    }
    flushPara(); flushList(); flushQuote(); flushTable();
    return html;
  }

  const api = { ORDER, HEADS, sections, bodyOf, compose, setFrontmatter, pictureBlock, addPicture, FOLDERS, FOLDER_BY_ID, SUITS, PREFIX, plainName, parseFrontmatter, parseNote, links, build, resolve, landing, counts, find, render, esc, depthOf,
    TOPS, TOP_BY_NAME, FOLDER_TOP, kindChain, TYPE_OF_FOLDER, SHELF_DIR, PARENT_KEYS, parentList, parseFacts, parseBonds, parseMembers, hasText, topOf, kindLoops, kindKey,
    groupByKind, membersOf, shelf, layoutFor, BUILTIN_FORMS, norm, lev, twin, suggestSections, kinds, backWord, BACK, assemble, setFmRaw, fmList, setParents, linkOf, parentStrings,
    setLead, setSection, sectionBody, setFacts, factsBody, setBond, renameHeading, renameFactLine, linkMinor, topFolder, stamp, cleanTitle, newPageText, shelfPageText, shelfRel,
    TOP_ALIAS, PIC_KINDS, picKind, pictures,
    kindTree, kindPages, splitPics };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.WikiModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
