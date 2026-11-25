'use strict';
(function (root) {
  const SUIT_OF = { domina: 'domina', aura: 'aura', magia: 'magia' };
  function fmStrip(text) { const s = String(text || '').replace(/\r\n/g, '\n'); if (!s.startsWith('---\n')) return s; const e = s.indexOf('\n---', 3); return e < 0 ? s : s.slice(s.indexOf('\n', e + 4) + 1); }

  function cards(text) {
    const body = fmStrip(text);
    const out = [];
    const decks = [];
    let inDecks = false, cur = null, field = null;
    for (const line of body.split('\n')) {
      if (/^## Decks/.test(line)) { inDecks = true; continue; }
      if (/^## /.test(line)) { inDecks = false; }
      if (inDecks) { const d = line.match(/^- (.+)$/); if (d) decks.push(d[1].trim()); continue; }
      const h = line.match(/^### (\S+) \| (.+?)\s*$/);
      if (h) { cur = { id: h[1], name: h[2], f: {} }; out.push(cur); field = null; continue; }
      if (!cur) continue;
      const kv = line.match(/^- ([^|:]+?) \| ?(.*)$/);
      if (kv) { cur.f[kv[1].trim()] = kv[2].trim(); field = null; continue; }
      const long = line.match(/^- ([^|:]+):\s*(.*)$/);
      if (long) { field = long[1].trim(); cur.f[field] = long[2].trim(); continue; }
      if (field && /^\s+\S/.test(line)) cur.f[field] = (cur.f[field] ? cur.f[field] + '\n' : '') + line.trim();
    }
    for (const c of out) {
      c.suit = SUIT_OF[String(c.f.Suit || '').toLowerCase()] || 'bone';
      c.order = parseFloat(c.f.Order); if (isNaN(c.order)) c.order = 1e6;
    }
    out.sort((a, b) => (['domina', 'aura', 'magia', 'bone'].indexOf(a.suit) - ['domina', 'aura', 'magia', 'bone'].indexOf(b.suit)) || a.order - b.order || a.id.localeCompare(b.id));
    return { decks, list: out };
  }

  function letters(json) {
    let d; try { d = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return { list: [], error: 'Dalinari.json could not be read' }; }
    const c = (d && d.cards) || {};
    const list = Object.keys(c).map((k, i) => Object.assign({ id: k, i }, c[k] || {}));
    return { list, glyphs: Object.keys((d && d.glyphs) || {}) };
  }

  function chapters(text) {
    const out = []; let book = '', act = '', actName = '', episode = '';
    for (const line of fmStrip(text).split('\n')) {
      let m;
      if ((m = line.match(/^## Book (\S+)/))) { book = m[1]; act = actName = episode = ''; continue; }
      if ((m = line.match(/^### (ACT [IVX]+)\s*"?(.*?)"?\s*$/i))) { act = m[1].toUpperCase(); actName = m[2]; episode = ''; continue; }
      if ((m = line.match(/^\*\*Episode\s*[—–-]\s*(.+?)\*\*/))) { episode = m[1].trim(); continue; }
      if (book && (m = line.match(/^- ([A-Za-z]+(?:[- ][A-Za-z]+)?):\s*\*\*(.+?)\*\*(?:\s*[—–-]\s*\*(.+?)\*)?/))) {
        out.push({ id: String(out.length + 1), n: out.length + 1, book, act, actName, episode, word: m[1], name: m[2].trim(), gloss: (m[3] || '').trim() });
      }
    }
    return { list: out };
  }

  function events(text) {
    const out = []; let inEv = false, cur = null;
    for (const line of fmStrip(text).split('\n')) {
      if (/^## /.test(line)) { inEv = /^## Events/.test(line); cur = null; continue; }
      if (!inEv) continue;
      const m = line.match(/^- (.+?) \| (.+?)(?: \| calendars: (.*))?\s*$/);
      if (m) { cur = { id: String(out.length + 1), n: out.length + 1, when: m[1].trim(), name: m[2].trim(), calendars: (m[3] || '').split(',').map(s => s.trim()).filter(Boolean), text: [], chapter: '', open: [], sources: '' }; out.push(cur); continue; }
      const s = cur && line.match(/^\s+- (.*)$/);
      if (!s) continue;
      const v = s[1];
      if (/^Chapter:/i.test(v)) cur.chapter = v.replace(/^Chapter:\s*/i, '');
      else if (/^Open:/i.test(v)) cur.open.push(v.replace(/^Open:\s*/i, ''));
      else if (/^Sources:/i.test(v)) cur.sources = v.replace(/^Sources:\s*/i, '');
      else cur.text.push(v);
    }
    return { list: out };
  }

  const SETS = [
    { id: 'cards', name: 'Cards', one: 'card', home: 'Infinity Parables.md', app: 'writer', appName: 'the Writer (Cards view)' },
    { id: 'letters', name: 'Dalinari letters', one: 'letter', home: 'Dalinari/Dalinari.json', app: 'atelier', appName: 'the Atelier' },
    { id: 'chapters', name: 'Chapters', one: 'chapter', home: 'Evrynthing - Structure.md', app: 'writer', appName: 'the Writer' },
    { id: 'events', name: 'Events', one: 'event', home: 'Evrynthing - Timeline.md', app: 'writer', appName: "the Writer's Timeline" },
  ];
  function build(homes) {
    homes = homes || {};
    const r = {
      cards: homes['Infinity Parables.md'] != null ? cards(homes['Infinity Parables.md']) : { list: [], missing: true },
      letters: homes['Dalinari/Dalinari.json'] != null ? letters(homes['Dalinari/Dalinari.json']) : { list: [], missing: true },
      chapters: homes['Evrynthing - Structure.md'] != null ? chapters(homes['Evrynthing - Structure.md']) : { list: [], missing: true },
      events: homes['Evrynthing - Timeline.md'] != null ? events(homes['Evrynthing - Timeline.md']) : { list: [], missing: true },
    };
    return r;
  }
  function member(sets, setId, id) {
    const L = (sets[setId] || {}).list || [];
    const i = L.findIndex(x => String(x.id) === String(id));
    if (i < 0) return null;
    return { m: L[i], prev: L[i - 1] || null, next: L[i + 1] || null, i, n: L.length };
  }
  function strip(s) { return String(s || '').toLowerCase().replace(/\(reversed\)/g, '').replace(/^the\s+/, '').trim(); }
  function inStructure(sets, name) {
    const k = strip(name), eps = new Map(), chs = [];
    for (const c of sets.chapters.list) {
      if (strip(c.episode) === k) { const key = c.book + '|' + c.act + '|' + c.episode; if (!eps.has(key)) eps.set(key, { book: c.book, act: c.act, episode: c.episode, chapters: [] }); eps.get(key).chapters.push(c); }
      if (strip(c.name) === k) chs.push(c);
    }
    return { episodes: [...eps.values()], chapters: chs };
  }
  function label(setId, m) {
    if (!m) return '';
    if (setId === 'letters') return (m.char || m.id) + (m.sound ? '  /' + m.sound + '/' : '');
    if (setId === 'chapters') return m.n + '. ' + m.name;
    return m.name;
  }
  const api = { SETS, build, cards, letters, chapters, events, member, inStructure, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.WikiSets = api;
})(typeof window !== 'undefined' ? window : globalThis);
