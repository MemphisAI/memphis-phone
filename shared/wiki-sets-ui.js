'use strict';
(function () {
  const C = window.__wikiCore, S = window.WikiSets;
  if (!C || !S) return;
  const { el, status } = C;
  let sets = null, homeRel = {};
  const SET = Object.fromEntries(S.SETS.map(s => [s.id, s]));
  const SUIT_OF_SET = { cards: null, letters: 'bone', chapters: 'bone', events: 'bone' };

  function data(files, homes) {
    const h = Object.assign({}, homes || {});
    homeRel = {};
    for (const f of files || []) {
      const rel = String(f.rel);
      if (!rel.includes('/') && S.SETS.some(s => s.home === rel)) { h[rel] = f.text; homeRel[rel] = rel; }
    }
    sets = S.build(h);
  }
  function has(v) {
    if (!sets) return false;
    const [sid, mid] = String(v.id || '').split('|');
    if (!SET[sid]) return false;
    return v.kind === 'set' || !!S.member(sets, sid, mid);
  }
  function relOfHome(sid) { const h = SET[sid] && SET[sid].home; return h && !h.includes('/') ? h : null; }

  function left(strip) {
    if (!sets) return;
    strip.appendChild(el('div', 'fo-sep'));
    for (const s of S.SETS) {
      const n = sets[s.id].list.length;
      if (!n) continue;
      const b = el('button', 'fo set'); b.type = 'button'; b.dataset.id = 'set:' + s.id; b.title = s.name;
      const num = el('span', 'num'); num.appendChild(el('span', 'set-ic', s.id === 'cards' ? 'C' : s.id === 'letters' ? 'D' : s.id === 'chapters' ? 'Ch' : 'Ev'));
      b.append(num, el('span', 'nm', s.name), el('span', 'ct', String(n)));
      b.addEventListener('click', () => C.go({ kind: 'set', id: s.id }));
      strip.appendChild(b);
    }
  }
  function tiles(art) {
    if (!sets) return;
    const any = S.SETS.some(s => sets[s.id].list.length);
    if (!any) return;
    art.appendChild(el('div', 'sets-h', 'Numbered sets, read live from their homes'));
    const grid = el('div', 'folders');
    for (const s of S.SETS) {
      const n = sets[s.id].list.length; if (!n) continue;
      const a = el('a', 'ftile set'); a.href = '#'; a.dataset.go = 'set|' + s.id;
      a.append(C.dot('home'), el('span', 'num', ''), el('span', 'nm', s.name), el('span', 'ct', n + ' ' + s.one + (n === 1 ? '' : 's') + ' · in ' + s.appName));
      grid.appendChild(a);
    }
    art.appendChild(grid);
  }

  function openIn(s) {
    const b = el('button', 'bl-btn coal sm', 'Open in ' + s.appName); b.type = 'button';
    b.addEventListener('click', async () => { const r = window.wikiAPI.openApp ? await window.wikiAPI.openApp(s.app) : null; if (!r || !r.ok) status('Could not open ' + s.appName + '.', true); });
    return b;
  }
  function link(setId, m, text) { const a = el('a', 'wl page', text || S.label(setId, m)); a.href = '#'; a.dataset.go = 'member|' + setId + '|' + m.id; return a; }
  function render(v, page) {
    const [sid, mid] = String(v.id).split('|');
    const s = SET[sid];
    if (v.kind === 'set') return renderSet(s, page);
    return renderMember(s, S.member(sets, sid, mid), page);
  }
  function renderSet(s, page) {
    const L = sets[s.id].list;
    const art = el('article', 'pg set-page');
    art.appendChild(C.crumbs([{ text: 'Index', go: 'index|' }, { text: s.name }]));
    art.appendChild(el('h1', '', s.name));
    const meta = el('p', 'quiet', L.length + ' ' + s.one + (L.length === 1 ? '' : 's') + ', read live from ' + s.home.replace('/', ' › ') + '. Edit them in ' + s.appName + '; the wiki shows the change.');
    art.appendChild(meta);
    const bar = el('div', 'set-bar'); bar.appendChild(openIn(s)); art.appendChild(bar);
    const cols = {
      cards: [['#', m => m.f.Order || ''], ['Card', null], ['Suit', m => m.f.Suit || ''], ['Type', m => m.f.Type || ''], ['Value', m => m.f.Value || ''], ['Keyword', m => m.f.Keyword || '']],
      letters: [['Letter', null], ['Sound', m => m.sound || ''], ['Spelling', m => m.spelling || ''], ['Key', m => m.key || ''], ['Glyph', m => m.glyph || '']],
      chapters: [['#', m => String(m.n)], ['Chapter', null], ['Book', m => m.book], ['Act', m => m.act], ['Episode', m => m.episode]],
      events: [['When', m => m.when], ['Event', null], ['Calendars', m => m.calendars.join(', ')], ['Open', m => m.open.length ? String(m.open.length) : '']],
    }[s.id];
    const t = el('table', 'set-table');
    const hr = el('tr'); cols.forEach(([h]) => hr.appendChild(el('th', '', h))); const th = el('thead'); th.appendChild(hr); t.appendChild(th);
    const tb = el('tbody');
    let lastGroup = null;
    for (const m of L) {
      const group = s.id === 'cards' ? m.f.Suit : s.id === 'chapters' ? 'Book ' + m.book : null;
      if (group && group !== lastGroup) { const gr = el('tr', 'grp'); const td = el('td', '', group); td.colSpan = cols.length; gr.appendChild(td); tb.appendChild(gr); lastGroup = group; }
      const tr = el('tr');
      for (const [h, f] of cols) {
        const td = el('td');
        if (!f) { if (s.id === 'cards') td.appendChild(C.dot(m.suit)); td.appendChild(link(s.id, m, s.id === 'chapters' ? m.name : null)); }
        else td.textContent = f(m);
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb); art.appendChild(t);
    page.appendChild(art);
  }
  function box(suit, title, rows, extra) {
    const b = el('section', 'box card-' + suit);
    const h = el('div', 'box-h'); h.appendChild(el('span', 'rn', 'I')); h.appendChild(el('span', '', 'What it is'));
    h.appendChild(el('span', 'meta', title)); b.appendChild(h);
    const dl = el('dl', 'facts');
    for (const [k, v] of rows) { if (v == null || v === '') continue; dl.appendChild(el('dt', '', k)); const dd = el('dd'); if (v instanceof Node) dd.appendChild(v); else dd.textContent = v; dl.appendChild(dd); }
    b.appendChild(dl);
    if (extra) b.appendChild(extra);
    return b;
  }
  function section(n, title, node) { const s = el('section', 'story'); const h = el('h2'); h.append(el('span', 'rn', n), document.createTextNode(title)); s.append(h, node); return s; }
  function renderMember(s, mm, page) {
    const { m, prev, next, i, n } = mm;
    const suit = s.id === 'cards' ? m.suit : SUIT_OF_SET[s.id];
    const art = el('article', 'pg member suit-' + suit);
    art.appendChild(C.crumbs([{ text: 'Index', go: 'index|' }, { text: s.name, go: 'set|' + s.id }, { text: (i + 1) + ' of ' + n }]));
    art.appendChild(el('h1', '', s.id === 'letters' ? (m.char || m.id) : s.id === 'chapters' ? m.name : m.name));
    const pn = el('div', 'set-nav');
    if (prev) { const a = link(s.id, prev, '‹  ' + S.label(s.id, prev)); a.classList.add('prev'); pn.appendChild(a); } else pn.appendChild(el('span'));
    pn.appendChild(openIn(s));
    if (next) { const a = link(s.id, next, S.label(s.id, next) + '  ›'); a.classList.add('next'); pn.appendChild(a); } else pn.appendChild(el('span'));
    art.appendChild(pn);
    const main = el('div', 'main');
    if (s.id === 'cards') {
      const f = m.f;
      const pic = el('figure', 'pic card-art'); const fr = el('div', 'pic-frame'); pic.appendChild(fr);
      const art0 = String(f.Art || ''); const am = art0.match(/^([^:]+):\s*(.+)$/);
      if (am && window.wikiAPI.art) window.wikiAPI.art('card', am[1].trim(), am[2].trim()).then(r => { if (r && r.ok) { const im = el('img'); im.src = r.url; im.alt = m.name; fr.appendChild(im); } else pic.remove(); });
      else pic.remove();
      main.appendChild(box(suit, 'Card · ' + (f.Suit || ''), [['Suit', f.Suit], ['Type', f.Type], ['Value', f.Value], ['Order', f.Order], ['Keyword', f.Keyword], ['Norwegian', f.NO], ['English', f.EN], ['Dalinari', f.DA], ['Id', m.id]], am ? pic : null));
      const where = S.inStructure(sets, m.name);
      if (where.episodes.length || where.chapters.length) {
        const d = el('div', 'md');
        for (const e of where.episodes) {
          const p = el('p'); p.appendChild(el('strong', '', 'Book ' + e.book + ' · ' + e.act + ' · Episode ' + e.episode + ': '));
          e.chapters.forEach((c, k) => { if (k) p.appendChild(document.createTextNode(' · ')); p.appendChild(link('chapters', c, c.name)); });
          d.appendChild(p);
        }
        if (where.chapters.length) { const p = el('p'); p.appendChild(el('strong', '', 'A chapter of that name: ')); where.chapters.forEach((c, k) => { if (k) p.appendChild(document.createTextNode(' · ')); p.appendChild(link('chapters', c, 'Book ' + c.book + ', ' + c.n + '. ' + c.name)); }); d.appendChild(p); }
        main.appendChild(section('II', 'In the structure', d));
      }
      const text = [['Art brief', f['Art brief']], ['Symbolism', f.Symbolism], ['Story', f.Story]].filter(x => x[1]);
      if (text.length) { const d = el('div', 'md'); for (const [k, v] of text) { d.appendChild(el('h3', '', k)); v.split('\n').forEach(l => d.appendChild(el('p', '', l))); } main.appendChild(section(where.episodes.length ? 'III' : 'II', 'Its story', d)); }
    } else if (s.id === 'letters') {
      const g = el('figure', 'pic glyph'); const fr = el('div', 'pic-frame'); g.appendChild(fr);
      if (m.glyph && window.wikiAPI.art) window.wikiAPI.art('glyph', m.glyph).then(r => { if (r && r.ok) { const im = el('img'); im.src = r.url; im.alt = m.char || ''; fr.appendChild(im); } else g.remove(); });
      else g.remove();
      main.appendChild(box('bone', 'Dalinari letter', [['Letter', m.char], ['Sound', m.sound ? '/' + m.sound + '/' : ''], ['Spelling', m.spelling], ['Key', m.key], ['Glyph', m.glyph || 'not drawn yet'], ['Id', m.id]], m.glyph ? g : null));
      if (m.why) main.appendChild(section('II', 'Why this letter', el('p', 'md', m.why)));
    } else if (s.id === 'chapters') {
      main.appendChild(box('bone', 'Chapter ' + m.n + ' of 81', [['Book', m.book], ['Act', m.act + (m.actName ? ' · ' + m.actName : '')], ['Episode', m.episode]]));
      if (m.gloss) main.appendChild(section('II', 'Its theme', el('p', 'md', m.gloss)));
      const card = sets.cards.list.find(c => c.name.toLowerCase().replace(/^the /, '') === m.name.toLowerCase().replace(/\s*\(reversed\)/, '').replace(/^the /, ''));
      const ep = sets.cards.list.find(c => c.name.toLowerCase().replace(/^the /, '') === m.episode.toLowerCase().replace(/\s*\(reversed\)/, '').replace(/^the /, ''));
      if (card || ep) { const d = el('div', 'md'); const p = el('p'); if (card) { p.appendChild(document.createTextNode('Its card: ')); p.appendChild(link('cards', card)); } if (ep) { if (card) p.appendChild(document.createTextNode(' · ')); p.appendChild(document.createTextNode('Its episode’s card: ')); p.appendChild(link('cards', ep)); } d.appendChild(p); main.appendChild(section('III', 'Its threads', d)); }
    } else if (s.id === 'events') {
      main.appendChild(box('bone', 'Event', [['When', m.when], ['Calendars', m.calendars.join(', ')], ['In the book', m.chapter]]));
      if (m.text.length) main.appendChild(section('II', 'Its story', C.md(m.text.join('\n\n'))));
      if (m.sources) main.appendChild(section('III', 'Its threads', C.md('- Sources: ' + m.sources)));
      if (m.open.length && C.layers.behind) {
        const d = el('details', 'behind'); d.open = true; const sm = el('summary'); sm.appendChild(el('span', '', 'Behind the scenes')); d.appendChild(sm);
        const part = el('div', 'bpart'); part.appendChild(el('h4', '', 'Open')); part.appendChild(C.md(m.open.map(q => '- ? ' + q).join('\n'), true)); d.appendChild(part);
        main.appendChild(d);
      }
    }
    const cols = el('div', 'cols'); cols.appendChild(main); art.appendChild(cols);
    page.appendChild(art);
  }
  window.__wikiSets = { data, has, render, left, tiles, homeRel: (v) => relOfHome(String(v.id).split('|')[0]), sets: () => sets };
  if (C.W) C.load(true);   // the first read can finish before this file loads: read again so the sets are there
})();
