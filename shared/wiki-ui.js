'use strict';
(function () {
  const M = window.WikiModel, API = window.wikiAPI;
  const $ = (id) => document.getElementById(id);
  const IC = (n, s) => (window.BladesIcon ? window.BladesIcon(n, s || 16) : '');
  const page = $('page');
  const LKEY = 'memphis.wiki.layers', VKEY = 'memphis.wiki.view';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept: fine */ } },
  };
  const layers = Object.assign({ margin: true, behind: true, truth: true }, store.get(LKEY) || {});
  let W = null, relOf = new Map(), folderList = [], media = [];
  let view = store.get(VKEY) || { kind: 'index' };
  const back = [];

  function status(msg, bad) {
    const s = $('status'); s.textContent = msg || ''; s.classList.toggle('bad', !!bad); s.classList.toggle('on', !!msg);
    clearTimeout(status.t); if (msg) status.t = setTimeout(() => s.classList.remove('on'), 4200);
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dot(suit) { const d = el('span', 'sd ' + suit); d.setAttribute('aria-hidden', 'true'); return d; }
  function folderOf(id) { return M.FOLDER_BY_ID[id] || { id, num: '', name: id, suit: 'bone' }; }
  function folderLabel(f) { return f.num ? f.num + ' ' + f.name : f.name; }

  async function load(keepScroll) {
    let r;
    try { r = await API.read(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (!r || !r.ok) { page.innerHTML = ''; page.appendChild(el('p', 'err', 'The wiki could not read the notes: ' + ((r && r.error) || 'no answer'))); return; }
    W = M.build(r.files); media = r.media || [];
    if (window.__wikiSets) { try { window.__wikiSets.data(r.files, r.homes || {}); } catch (e) { console.error(e); } }   // step 5
    relOf = new Map(r.files.map(f => [String(f.rel).split('/').pop().replace(/\.md$/i, ''), f.rel]));
    const have = new Set(r.folders || []);
    folderList = M.FOLDERS.filter(f => have.has(f.id) || f.id === '00 Index');
    buildLeft(); buildRight();
    if (window.__wikiGraph) { try { window.__wikiGraph.data(W); } catch (e) { console.error(e); } }
    const y = keepScroll ? page.scrollTop : 0;
    show(view, { noHistory: true, quiet: true });
    if (keepScroll) page.scrollTop = y;
  }

  function go(v) { if (window.__wikiGraph && window.__wikiGraph.on()) { window.__wikiGraph.set(false); } show(v); buildRight(); }
  function show(v, o) {
    o = o || {};
    if (!W) return;
    if (window.__wikiLeave && !window.__wikiLeave()) return;   // step 4: unsaved edits ask first
    if (v.kind === 'page' && !W.pages.has(v.id)) {
      if (!o.quiet) status('No page by that name.', true);
      v = { kind: 'index' };
      if (o.quiet) status('The page you had open moved or was removed. Here is the Index.');
    }
    if (v.kind === 'folder' && !M.FOLDER_BY_ID[v.id]) v = { kind: 'index' };
    if ((v.kind === 'set' || v.kind === 'member') && !(window.__wikiSets && window.__wikiSets.has(v))) v = { kind: 'index' };
    if (!o.noHistory && (view.kind !== v.kind || view.id !== v.id)) { back.push({ view, y: page.scrollTop }); if (back.length > 60) back.shift(); }
    view = v; store.set(VKEY, v);
    if (hits.length) { hits = []; drawHits(); }
    page.innerHTML = '';
    if (v.kind === 'set' || v.kind === 'member') window.__wikiSets.render(v, page);   // step 5: numbered sets, drawn live
    else if (v.kind === 'folder') renderFolder(v.id);
    else if (v.kind === 'media') renderMedia(v.id === 'sketch' ? 'sketch' : 'all');
    else if (v.kind === 'page') renderPage(W.pages.get(v.id));
    else renderIndex();
    if (!o.noHistory) page.scrollTop = 0;
    markLeft();
    updateTools();
    hydratePictures();
    if (window.__wikiAfterShow) { try { window.__wikiAfterShow(view); } catch (e) { console.error(e); } }
  }
  const picCache = new Map();
  function hydratePictures() {
    page.querySelectorAll('figure.pic[data-src]').forEach(async (f) => {
      const n = f.dataset.src.split('/').pop();
      let url = picCache.get(n);
      if (url === undefined) { const r = API.media ? await API.media(n) : null; url = r && r.ok ? r.url : null; picCache.set(n, url); }
      const fr = f.querySelector('.pic-frame'); if (!fr) return;
      fr.innerHTML = '';
      if (url) { const im = document.createElement('img'); im.src = url; im.alt = f.querySelector('figcaption') ? f.querySelector('figcaption').textContent : ''; fr.appendChild(im); }
      else fr.appendChild(el('span', 'pic-empty', (API.phone ? 'Pictures stay on Alaric for now: ' : 'Missing from Media: ') + n));   // phone step 4
    });
  }
  function goBack() { const b = back.pop(); if (!b) return; show(b.view, { noHistory: true }); page.scrollTop = b.y || 0; }
  window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); goBack(); } });
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
    if ((e.ctrlKey && (e.key === 'f' || e.key === 'k')) || (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName))) { e.preventDefault(); $('find').focus(); $('find').select(); }
  });
  page.addEventListener('click', (e) => {
    const a = e.target.closest('a.wl, [data-go]');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.go) { const g = a.dataset.go, i = g.indexOf('|'); go({ kind: g.slice(0, i), id: g.slice(i + 1) }); return; }   // step 5: an id may hold '|'
    const kind = a.dataset.kind, t = a.dataset.target;
    if (kind === 'page') go({ kind: 'page', id: t });
    else if (kind === 'home') openVault(relOf.get(t));
    else status('No page called ' + M.plainName(t) + ' yet.');
  });

  async function openVault(rel) {
    if (!rel) { status('Nothing to open here.'); return; }
    const r = await API.openInVault(rel);
    if (!r || !r.ok) status('Could not open it: ' + ((r && r.error) || 'no answer'), true);
  }

  function buildLeft() {
    const s = $('s-left'); s.innerHTML = '';
    const brand = el('div', 'brand'); brand.innerHTML = window.BladesCoin ? window.BladesCoin('wiki', 28) : '';
    brand.appendChild(el('span', 'nm', 'Evrynthing wiki'));
    s.appendChild(brand);
    const c = M.counts(W);
    for (const f of folderList) {
      const b = el('button', 'fo ' + f.suit); b.type = 'button'; b.dataset.id = f.id;
      const n = el('span', 'num'); if (f.num) n.textContent = f.num; else n.appendChild(dot('behind'));
      b.appendChild(n);
      b.appendChild(el('span', 'nm', f.name));
      if (f.id !== '00 Index') b.appendChild(el('span', 'ct', String(c[f.id] || 0)));
      b.title = folderLabel(f);
      b.addEventListener('click', () => go(f.id === '00 Index' ? { kind: 'index' } : { kind: 'folder', id: f.id }));
      s.appendChild(b);
    }
    if (window.__wikiSets) { try { window.__wikiSets.left(s); } catch (e) { console.error(e); } }
  }
  function markLeft() {
    const cur = view.kind === 'index' ? '00 Index' : view.kind === 'folder' ? view.id : view.kind === 'set' || view.kind === 'member' ? 'set:' + String(view.id).split('|')[0] : (W.pages.get(view.id) || {}).folder;
    document.querySelectorAll('#s-left .fo').forEach(b => b.classList.toggle('on', b.dataset.id === cur));
  }

  function buildRight() {
    const s = $('s-right'); s.innerHTML = '';
    s.appendChild(el('div', 'rh', 'View'));
    const seg = el('div', 'seg');
    const G = window.__wikiGraph, inGraph = !!(G && G.on());
    const pg = el('button', inGraph ? '' : 'on', 'Page'); pg.type = 'button'; pg.setAttribute('aria-pressed', inGraph ? 'false' : 'true');
    const gr = el('button', inGraph ? 'on' : '', 'Graph'); gr.type = 'button'; gr.setAttribute('aria-pressed', inGraph ? 'true' : 'false');
    if (!G) { gr.disabled = true; gr.title = 'The graph could not load'; }
    pg.addEventListener('click', () => { if (G && G.on()) { G.set(false); buildRight(); } });
    gr.addEventListener('click', () => { if (G && !G.on()) { G.set(true); buildRight(); } });
    seg.append(pg, gr); s.appendChild(seg);
    const pics = el('div', 'seg');
    [['all', 'Media'], ['sketch', 'Sketchbook']].forEach(([id, n]) => {
      const b = el('button', view.kind === 'media' && (view.id === 'sketch') === (id === 'sketch') ? 'on' : '', n); b.type = 'button';
      b.addEventListener('click', () => go({ kind: 'media', id }));
      pics.appendChild(b);
    });
    s.appendChild(pics);
    if (window.__wikiRightTop) { try { window.__wikiRightTop(s); } catch (e) { console.error(e); } }
    s.appendChild(el('div', 'rh', 'Layers'));
    const nMargin = [...W.pages.values()].filter(p => p.margin.trim()).length;
    const nOpen = [...W.pages.values()].reduce((a, p) => a + p.behind.open.length, 0);
    const rows = [
      ['margin', "Mentor's margin", nMargin === 1 ? '1 page' : nMargin + ' pages'],
      ['behind', 'Behind the scenes', ''],
      ['truth', 'Truth marks', nOpen + ' open'],
      ['background', 'Background', 'the Flock, behind the graph'],
    ];
    for (const [k, name, note] of rows) {
      const b = el('button', 'lay'); b.type = 'button'; b.setAttribute('role', 'switch');
      const on = k === 'background' ? !!(window.__wikiGraph && window.__wikiGraph.background()) : !!layers[k];
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
      if (k === 'background' && !(window.__wikiGraph && window.__wikiGraph.canBackground())) { b.disabled = true; b.title = 'The Flock background could not load'; }
      b.append(el('span', 'sw'), el('span', 'nm', name));
      if (note) b.appendChild(el('span', 'nt', note));
      b.addEventListener('click', () => {
        if (k === 'background') { window.__wikiGraph.background(!window.__wikiGraph.background()); buildRight(); return; }
        layers[k] = !layers[k]; store.set(LKEY, layers); buildRight(); show(view, { noHistory: true });
      });
      s.appendChild(b);
    }
    if (window.__wikiRightBottom) { try { window.__wikiRightBottom(s); } catch (e) { console.error(e); } }
  }

  const find = $('find'), list = $('find-list');
  let hits = [], hi = 0;
  function drawHits() {
    list.innerHTML = '';
    list.hidden = !hits.length;
    hits.forEach((h, i) => {
      const b = el('button', 'hit' + (i === hi ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'option');
      b.append(dot(h.suit), el('span', 'nm', h.title), el('span', 'fd', folderLabel(folderOf(h.folder))));
      b.addEventListener('mousedown', (e) => { e.preventDefault(); pickHit(i); });
      list.appendChild(b);
    });
  }
  function pickHit(i) { const h = hits[i]; if (!h) return; find.value = ''; hits = []; drawHits(); find.blur(); go({ kind: 'page', id: h.name }); }
  find.addEventListener('input', () => { hits = W ? M.find(W, find.value, 8) : []; hi = 0; drawHits(); });
  find.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hits.length - 1, hi + 1); drawHits(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); drawHits(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits.length) pickHit(hi); else if (find.value.trim()) status('No page matches that.'); }
    else if (e.key === 'Escape') { find.value = ''; hits = []; drawHits(); find.blur(); }
  });
  find.addEventListener('focus', () => $('s-bottom').classList.add('pin'));
  find.addEventListener('blur', () => { $('s-bottom').classList.remove('pin'); setTimeout(() => { hits = []; drawHits(); }, 120); });
  document.querySelector('.find-ic').innerHTML = IC('search', 15);
  $('t-vault').insertAdjacentHTML('afterbegin', IC('window', 14));
  $('t-vault').addEventListener('click', () => openVault(currentRel()));
  function currentRel() {
    if (!W) return null;
    if (view.kind === 'page') return (W.pages.get(view.id) || {}).rel;
    if (view.kind === 'folder') { const l = W.landings.get(view.id); return l ? l.rel : null; }
    if ((view.kind === 'set' || view.kind === 'member') && window.__wikiSets) return window.__wikiSets.homeRel(view);
    if (view.kind === 'media') return null;   // v6: Media is drawn live, it has no note
    return W.index ? W.index.rel : null;
  }
  function currentPage() {
    if (!W) return null;
    if (view.kind === 'page') return W.pages.get(view.id) || null;
    if (view.kind === 'folder') return W.landings.get(view.id) || null;
    if (view.kind === 'set' || view.kind === 'member') return null;   // step 5: a set is edited in its own app
    if (view.kind === 'media') return null;
    return W.index || null;
  }
  function updateTools() { const r = currentRel(); $('t-vault').disabled = !r; $('t-vault').title = r ? 'Open this note in Obsidian' : 'This folder has no landing note yet'; }

  function crumbs(parts) {
    const c = el('div', 'crumbs');
    parts.forEach((p, i) => {
      if (i) c.appendChild(el('span', 'sep', '/'));
      if (p.go) { const a = el('a', '', p.text); a.href = '#'; a.dataset.go = p.go; c.appendChild(a); }
      else c.appendChild(el('span', '', p.text));
    });
    return c;
  }
  function md(text, open) { const d = el('div', 'md'); d.innerHTML = M.render(text, W, { truth: layers.truth, openMarks: !!open }); return d; }
  function chip(target) {
    const r = M.resolve(W, target.target) || { kind: 'missing', name: target.target };
    const a = el('a', 'chip wl ' + r.kind); a.href = '#'; a.dataset.kind = r.kind; a.dataset.target = r.name;
    if (r.kind === 'page') { const q = W.pages.get(r.name); a.appendChild(dot(q.suit)); if (q.empty) { a.classList.add('dashed'); a.title = 'This page has no text yet'; } }
    else if (r.kind === 'home') a.appendChild(dot('home'));
    else { a.appendChild(dot('missing')); a.classList.add('dashed'); a.title = 'No page yet'; }
    a.appendChild(el('span', '', target.label || M.plainName(r.name)));
    return a;
  }
  function margin(text, label) {
    const m = el('aside', 'margin');
    m.appendChild(el('div', 'mh', label || "Mentor's margin"));
    const body = md(text); body.classList.add('hand');
    if (layers.truth) m.classList.add('belief');
    m.appendChild(body);
    return m;
  }

  const SUIT_WORDS = {
    magia: ['Magia', 'Rules that are omniversal.'],
    domina: ['Domina', 'The results of recursive complexity, either organically, mechanically or culturally.'],
    aura: ['Aura', 'The relationship between Lifedrive, Willcraft and Kinweave, and unity fields.'] };
  function plainPages() { return [...W.pages.values()].filter(q => !q.landing && !q.onShelf && q.name !== M.PREFIX + 'Index' && q.folder !== 'Behind the scenes'); }
  function pick(list) { return list.length ? list[Math.floor(Math.random() * list.length)] : null; }
  function canonPicture(q) { const m = String(q.raw || '').replace(/\r\n/g, '\n').match(/^\s*>\s*\[!picture\]\s*(canon)?\s*\n\s*>\s*!\[\[([^\]|]+)/im); return m ? m[2].trim().split('/').pop() : ''; }
  function featured(box) {
    box.textContent = '';
    const q = pick(plainPages().filter(x => !x.kindPage && !x.noRecord && x.line && x.line.trim()));
    box.appendChild(el('div', 'ix-h', 'Featured page'));
    if (!q) { box.appendChild(el('p', 'quiet', 'A page with a one line can be featured here.')); return; }
    const pic = canonPicture(q);
    if (pic) { const f = el('figure', 'pic canon ix-pic'); f.dataset.src = pic; f.appendChild(el('div', 'pic-frame')); box.appendChild(f); }
    const t = el('a', 'wl page ix-t', q.title); t.href = '#'; t.dataset.kind = 'page'; t.dataset.target = q.name; box.appendChild(t);
    box.appendChild(md(q.line));
    const again = el('button', 'bl-btn sm ghost', 'Another'); again.type = 'button';
    again.addEventListener('click', () => { featured(box); hydratePictures(); });
    box.appendChild(again);
  }
  function archive(box) {
    box.textContent = '';
    box.appendChild(el('div', 'ix-h', 'From the archive'));
    const lines = [];
    for (const q of plainPages()) if (!q.noRecord) for (const f of q.facts) if (f.value && f.value.trim()) lines.push({ q, f });
    const it = pick(lines);
    if (!it) { box.appendChild(el('p', 'quiet', 'Fact lines from the pages show up here.')); return; }
    const t = el('a', 'wl page ix-t', it.q.title); t.href = '#'; t.dataset.kind = 'page'; t.dataset.target = it.q.name;
    const d = el('div', 'ix-fact'); d.append(t, el('span', 'ix-k', it.f.name));
    const v = el('div', 'md'); v.innerHTML = M.render(it.f.value, W, { truth: layers.truth }); d.appendChild(v);
    box.appendChild(d);
    const again = el('button', 'bl-btn sm ghost', 'Another'); again.type = 'button'; again.addEventListener('click', () => archive(box)); box.appendChild(again);
  }
  function renderIndex() {
    const p = W.index;
    const art = el('article', 'pg index');
    art.appendChild(el('div', 'kicker', 'The omnipedia of everything'));
    art.appendChild(el('h1', '', 'Evrynthing'));
    if (p) { const what = (p.line || p.what || '').split(/\r?\n/).filter(l => !/^\s*[-*]\s+/.test(l)).join('\n').trim(); if (what) { const d = md(what); d.classList.add('oneline'); art.appendChild(d); } }
    else art.appendChild(el('p', 'quiet', 'There is no Index note (eV - Index) yet.'));
    const c = M.counts(W);
    const suits = el('div', 'ix-suits');
    for (const s of ['magia', 'domina', 'aura']) {
      const fs = folderList.filter(f => f.suit === s && f.id !== '00 Index'); if (!fs.length) continue;
      const card = el('section', 'ix-suit card-' + s);
      card.appendChild(el('div', 'ix-sn', SUIT_WORDS[s][0]));
      card.appendChild(el('p', 'ix-sw', SUIT_WORDS[s][1]));
      for (const f of fs) {
        const a = el('a', 'ix-f'); a.href = '#'; a.dataset.go = 'folder|' + f.id;
        a.append(el('span', 'num', f.num), el('span', 'nm', f.name), el('span', 'ct', c[f.id] ? String(c[f.id]) : 'empty'));
        card.appendChild(a);
      }
      suits.appendChild(card);
    }
    art.appendChild(suits);
    const row = el('div', 'ix-row');
    const fb = el('section', 'ix-box'); featured(fb);
    const ab = el('section', 'ix-box'); archive(ab);
    row.append(fb, ab); art.appendChild(row);
    const recent = plainPages().filter(q => q.mtimeMs).sort((x, y) => y.mtimeMs - x.mtimeMs).slice(0, 6);
    if (recent.length) {
      const r = el('section', 'ix-recent'); r.appendChild(el('div', 'ix-h', 'Changed lately'));
      const cs = el('div', 'chips'); recent.forEach(q => cs.appendChild(chip({ target: q.name, label: q.title }))); r.appendChild(cs);
      art.appendChild(r);
    }
    const out = el('div', 'folders ix-out');
    for (const f of folderList) {
      if (['magia', 'domina', 'aura'].includes(f.suit) || f.id === '00 Index') continue;
      const a = el('a', 'ftile ' + f.suit); a.href = '#'; a.dataset.go = 'folder|' + f.id;
      a.append(dot(f.suit), el('span', 'num', f.num), el('span', 'nm', f.name), el('span', 'ct', c[f.id] ? c[f.id] + (c[f.id] === 1 ? ' page' : ' pages') : 'empty'));
      out.appendChild(a);
    }
    if (out.children.length) art.appendChild(out);
    if (window.__wikiSets) { try { window.__wikiSets.tiles(art); } catch (e) { console.error(e); } }
    if (p) pageBody(art, p, { skipWhat: true, noBox: true, noLead: true });
    page.appendChild(art);
  }

  function renderFolder(id) {
    const f = folderOf(id), l = W.landings.get(id);
    const art = el('article', 'pg landing suit-' + f.suit);
    art.appendChild(crumbs([{ text: 'Index', go: 'index|' }, { text: folderLabel(f) }]));
    const h = el('h1', ''); h.appendChild(dot(f.suit)); h.appendChild(document.createTextNode((f.num ? f.num + '  ' : '') + f.name)); art.appendChild(h);
    const say = l ? (l.line || l.what || '').trim() : '';
    if (say) { const box = el('section', 'box card-' + f.suit); box.appendChild(el('div', 'box-h', 'What belongs here')); box.appendChild(md(say)); art.appendChild(box); }
    if (l && layers.margin && l.margin.trim()) art.appendChild(margin(l.margin, 'Mentor'));
    if (id === 'Behind the scenes') {
      const sh = M.shelf(W), sp = W.pages.get(M.PREFIX + 'Sections');
      const a = el('a', 'prow wl ' + (sp ? 'page' : 'missing')); a.href = '#'; a.dataset.kind = sp ? 'page' : 'missing'; a.dataset.target = M.PREFIX + 'Sections';
      a.append(dot('behind'), el('span', 'nm', 'The shelf: sections and fact lines'), el('span', 'ct', sh.sections.length + ' sections, ' + sh.facts.length + ' fact lines'));
      art.appendChild(a);
    }
    const tree = M.kindTree(W, id);
    if (!tree.nodes.size) art.appendChild(el('p', 'quiet', 'No pages here yet.'));
    else art.appendChild(kindSplit(id, tree));
    page.appendChild(art);
  }
  function kindSplit(fid, tree) {
    const KEY = 'memphis.wiki.kinds.' + fid;
    const saved = store.get(KEY) || {};
    const st = { sel: tree.nodes.has(saved.sel) || saved.sel === '*' ? saved.sel : '*', open: new Set(saved.open || []), kq: '', pq: '' };
    const save = () => store.set(KEY, { sel: st.sel, open: [...st.open] });
    const wrap = el('div', 'ksplit');
    const left = el('aside', 'kinds'), right = el('section', 'kpane');
    wrap.append(left, right);
    const kf = el('input', 'kfilter'); kf.type = 'text'; kf.placeholder = 'Find a kind'; kf.spellcheck = false; kf.setAttribute('aria-label', 'Find a kind');
    const ktree = el('div', 'ktree'); ktree.setAttribute('role', 'tree');
    const empty = el('details', 'kempty');
    left.append(kf, ktree, empty);
    kf.addEventListener('input', () => { st.kq = kf.value.trim().toLowerCase(); drawTree(); });
    const N = (k) => tree.nodes.get(k);
    const live = (k) => N(k) && N(k).total > 0;
    function ancestorsOf(k) { const out = []; let n = N(k), guard = 0; while (n && n.parent && guard++ < 50) { out.push(n.parent); n = N(n.parent); } return out; }
    function drawTree() {
      ktree.textContent = '';
      const all = el('button', 'krow all' + (st.sel === '*' ? ' on' : '')); all.type = 'button';
      all.append(el('span', 'kn', 'All pages'), el('span', 'kc', String(tree.pages)));
      all.addEventListener('click', () => select('*'));
      ktree.appendChild(all);
      let show = null;
      if (st.kq) { show = new Set(); for (const n of tree.nodes.values()) if (live(n.key) && n.title.toLowerCase().includes(st.kq)) { show.add(n.key); ancestorsOf(n.key).forEach(x => show.add(x)); } }
      const row = (k, depth) => {
        const n = N(k); if (!live(k) || (show && !show.has(k))) return;
        const kids = n.kids.filter(live);
        const open = show ? true : st.open.has(k);
        const b = el('button', 'krow' + (st.sel === k ? ' on' : '') + (show && n.title.toLowerCase().includes(st.kq) ? ' hit' : '')); b.type = 'button';
        b.style.paddingLeft = (10 + depth * 16) + 'px'; b.setAttribute('role', 'treeitem');
        const tw = el('span', 'tw' + (kids.length ? '' : ' none') + (open ? ' open' : '')); tw.setAttribute('aria-hidden', 'true');
        if (kids.length) { tw.title = open ? 'Fold' : 'Open'; tw.addEventListener('click', (e) => { e.stopPropagation(); if (st.open.has(k)) st.open.delete(k); else st.open.add(k); save(); drawTree(); }); b.setAttribute('aria-expanded', String(open)); }
        b.append(tw, el('span', 'kn', n.title), el('span', 'kc', String(n.total)));
        if (!n.page && n.key && !n.key.startsWith('top:')) b.title = 'No kind page yet';
        b.addEventListener('click', () => { if (kids.length && !show) st.open.add(k); select(k); });
        ktree.appendChild(b);
        if (open) kids.forEach(x => row(x, depth + 1));
      };
      tree.roots.forEach(k => row(k, 0));
      if (show && !show.size) ktree.appendChild(el('p', 'quiet kq', 'No kind matches that.'));
      const dead = [...tree.nodes.values()].filter(n => !live(n.key) && n.page && (!st.kq || n.title.toLowerCase().includes(st.kq))).sort((x, y) => x.title.localeCompare(y.title));
      empty.textContent = ''; empty.hidden = !dead.length;
      const sm = el('summary', '', 'Empty kinds (' + dead.length + ')'); empty.appendChild(sm);
      for (const n of dead) { const a = el('a', 'wl page kdead', n.title); a.href = '#'; a.dataset.kind = 'page'; a.dataset.target = n.page; empty.appendChild(a); }
    }
    const head = el('div', 'kp-h');
    const menu = el('select', 'kmenu'); menu.setAttribute('aria-label', 'Kind');
    const kpage = el('a', 'wl page kp-open', 'Open the kind page'); kpage.href = '#'; kpage.dataset.kind = 'page';
    head.append(menu, kpage);
    const pf = el('input', 'kfilter pf'); pf.type = 'text'; pf.placeholder = 'Find a page'; pf.spellcheck = false; pf.setAttribute('aria-label', 'Find a page in this kind');
    const list = el('div', 'plist kplist');
    right.append(head, pf, list);
    pf.addEventListener('input', () => { st.pq = pf.value.trim().toLowerCase(); drawPages(); });
    menu.addEventListener('change', () => select(menu.value));
    function fillMenu() {
      menu.textContent = '';
      const o = el('option', '', 'All pages (' + tree.pages + ')'); o.value = '*'; menu.appendChild(o);
      const add = (k, depth) => { const n = N(k); if (!live(k)) return; const x = el('option', '', ' '.repeat(depth) + n.title + ' (' + n.total + ')'); x.value = k; menu.appendChild(x); n.kids.forEach(c => add(c, depth + 1)); };
      tree.roots.forEach(k => add(k, 0));
      menu.value = st.sel;
    }
    function drawPages() {
      list.textContent = '';
      const n = N(st.sel);
      kpage.hidden = !(n && n.page); if (n && n.page) kpage.dataset.target = n.page;
      const ps = M.kindPages(tree, st.sel).filter(x => !st.pq || x.title.toLowerCase().includes(st.pq));
      for (const it of ps) {
        const a = el('a', 'prow wl page' + (it.empty ? ' dashed' : '')); a.href = '#'; a.dataset.kind = 'page'; a.dataset.target = it.name;
        a.append(dot(it.suit), el('span', 'nm', it.title));
        if (st.sel === '*' || it.kindKey !== st.sel) a.appendChild(el('span', 'tag', it.kind || 'no kind'));
        list.appendChild(a);
      }
      if (!ps.length) list.appendChild(el('p', 'quiet', st.pq ? 'No page matches that.' : 'No pages of this kind yet.'));
    }
    function select(k) {
      st.sel = k; ancestorsOf(k).forEach(x => st.open.add(x)); save();
      menu.value = k; drawTree(); drawPages();
    }
    fillMenu(); drawTree(); drawPages();
    return wrap;
  }
  function kindGroup(g) {
    const sec = el('section', 'group');
    const gh = el('div', 'gh');
    gh.appendChild(el('span', 'up', 'Kind'));
    if (g.kind.startsWith('top:')) gh.appendChild(el('span', 'topname', g.kindTitle));
    else if (g.kind) { const a = el('a', 'wl ' + (W.pages.has(g.kind) ? 'page' : 'missing'), g.kindTitle); a.href = '#'; a.dataset.kind = W.pages.has(g.kind) ? 'page' : 'missing'; a.dataset.target = g.kind; gh.appendChild(a); }
    else gh.appendChild(el('span', 'none', 'no kind yet'));
    sec.appendChild(gh);
    const ul = el('div', 'plist');
    for (const it of g.pages) {
      const a = el('a', 'prow wl page' + (it.empty ? ' dashed' : '')); a.href = '#'; a.dataset.kind = 'page'; a.dataset.target = it.name;
      a.append(dot(it.suit), el('span', 'nm', it.title));
      if (it.kindPage) a.appendChild(el('span', 'tag', 'kind'));
      ul.appendChild(a);
    }
    sec.appendChild(ul);
    return sec;
  }

  function renderPage(p) {
    const f = folderOf(p.folder);
    const art = el('article', 'pg suit-' + p.suit + (layers.margin && p.margin.trim() ? ' has-margin' : ''));
    const parts = [{ text: 'Index', go: 'index|' }];
    if (p.folder !== '00 Index') parts.push({ text: folderLabel(f), go: 'folder|' + p.folder });
    art.appendChild(crumbs(parts));
    art.appendChild(el('h1', '', p.title));
    pageBody(art, p, {});
    page.appendChild(art);
  }
  function pchip(l) {
    if (l.top) { const s = el('span', 'chip top'); s.appendChild(el('span', '', l.top)); s.title = 'One of the nine tops'; return s; }
    return chip(l);
  }
  function parentsRow(p) {
    const rows = [['Where', p.parents.where], ['What', p.parents.what], ['With', p.parents.with]].filter(r => r[1].length);
    if (!rows.length) return null;
    const box = el('div', 'parents');
    for (const [k, ls] of rows) {
      const r = el('div', 'prow2'); r.appendChild(el('span', 'pk', k));
      const cs = el('div', 'chips'); ls.forEach(x => cs.appendChild(pchip(x))); r.appendChild(cs); box.appendChild(r);
    }
    return box;
  }
  function boxMeta(p) {
    const bits = [];
    if (p.kindPage) bits.push('Kind');
    if (p.top) bits.push(p.top);
    else if (p.fm.type) bits.push(String(p.fm.type).replace(/^\w/, c => c.toUpperCase()));
    bits.push(folderLabel(folderOf(p.folder)));
    return bits.join('  ·  ');
  }
  function membersHead(p) {
    if (p.kindPage) return 'Every ' + p.title;
    if (p.top === 'Place') return 'Holds';
    return 'Members';
  }
  function ilinks(ls) {
    const d = el('span', 'ib-v');
    ls.forEach((l, i) => {
      if (i) d.appendChild(document.createTextNode(' · '));
      if (l.top) { d.appendChild(el('span', 'ib-top', l.top)); return; }
      const r = M.resolve(W, l.target) || { kind: 'missing', name: l.target };
      const a = el('a', 'wl ' + r.kind, l.label || (r.kind === 'page' ? W.pages.get(r.name).title : M.plainName(r.name))); a.href = '#'; a.dataset.kind = r.kind; a.dataset.target = r.name;
      if (r.kind === 'page' && W.pages.get(r.name).empty) a.classList.add('dashed');
      d.appendChild(a);
    });
    return d;
  }
  function infobox(p, pics) {
    const facts = p.facts.filter(f => f.value);
    const shelfLines = p.shelf ? [['Kind', p.shelf === 'fact' ? 'A fact line' : 'A section' + (p.fm.form ? ' (' + p.fm.form + ')' : '')],
      ['Also called', [].concat(p.fm.synonyms || []).join(', ')], ['Default for', [].concat(p.fm.default_for || []).join(', ')]].filter(x => x[1]) : [];
    const rows = [[p.kindPage ? 'A kind of' : 'Kind', p.parents.what], ['Where', p.parents.where], ['With', p.parents.with]].filter(r => r[1].length);
    const box = el('aside', 'ibox card-' + p.suit); box.dataset.part = 'what';
    box.appendChild(el('div', 'ib-title', p.title));
    const pw = el('div', 'ib-pics'); pics.forEach(f => pw.appendChild(f)); box.appendChild(pw);
    const dl = el('dl', 'ib');
    for (const [k, ls] of rows) { dl.appendChild(el('dt', '', k)); const dd = el('dd'); dd.appendChild(ilinks(ls)); dl.appendChild(dd); }
    let group = null;
    for (const f of facts) {
      if ((f.group || '') !== (group || '')) { group = f.group || ''; if (group) dl.appendChild(el('div', 'ib-g', group)); }
      dl.appendChild(el('dt', '', f.name)); const dd = el('dd'); dd.innerHTML = M.render(f.value, W, { truth: layers.truth }).replace(/^<p>|<\/p>$/g, ''); dl.appendChild(dd);
    }
    for (const [k, v] of shelfLines) { dl.appendChild(el('dt', '', k)); dl.appendChild(el('dd', '', v)); }
    if (dl.children.length) box.appendChild(dl);
    box.appendChild(el('div', 'ib-meta', boxMeta(p)));
    return (pics.length || dl.children.length) ? box : null;
  }
  function pageBody(art, p, o) {
    const cols = el('div', 'cols'), main = el('div', 'main');
    cols.appendChild(main);
    const lead = [];
    if (!o.noLead && p.line && p.line.trim()) { const d = md(p.line); d.classList.add('oneline'); lead.push(d); }
    if (!o.noLead && p.leadPics) lead.push(md(p.leadPics));
    if (!o.skipWhat && p.what.trim()) lead.push(md(p.what));
    const pics = [];
    lead.forEach(d => d.querySelectorAll('figure.pic').forEach(f => { if (!f.classList.contains('inspiration') && !f.classList.contains('sketch')) { f.remove(); pics.push(f); } }));
    const box = o.noBox || o.skipWhat ? null : infobox(p, pics);
    if (box) main.appendChild(box);
    if (p.noRecord) main.appendChild(el('p', 'norecord', 'The Concordate holds no record.'));
    lead.forEach(d => { if (d.textContent.trim() || d.querySelector('figure,table')) main.appendChild(d); });
    for (const s of p.secs) {
      if (s.kind === 'members') continue;   // drawn live below, with its minor members
      if (s.kind === 'bonds' || s.kind === 'ties') {
        const bonds = M.parseBonds(s.text); if (!bonds.length) continue;
        const sec = el('section', 'sec bonds' + (s.kind === 'ties' ? ' ties' : '')); sec.dataset.part = s.kind === 'ties' ? 'Ties' : 'Bonds'; sec.appendChild(el('h2', '', s.head));
        const cs = el('div', 'chips');
        for (const b of bonds) { const c = chip(b); if (b.word) c.appendChild(el('span', 'bw', b.word)); cs.appendChild(c); }
        sec.appendChild(cs); main.appendChild(sec); continue;
      }
      if (!s.text.trim()) continue;   // an empty section is hidden
      const sec = el('section', 'sec story'); sec.dataset.part = s.kind === 'story' ? 'story' : s.head;
      const h = el('h2');
      if (/^ii\s/i.test(s.head)) h.append(el('span', 'rn', 'II'), document.createTextNode('Its story')); else h.textContent = s.head;
      sec.appendChild(h); sec.appendChild(md(s.text)); main.appendChild(sec);
    }
    if (p.threads.across.length) {
      const s = el('section', 'threads'); const h = el('h2', '', 'Echoes'); s.appendChild(h);
      const cs = el('div', 'chips'); p.threads.across.forEach(x => cs.appendChild(chip(x))); s.appendChild(cs); main.appendChild(s);
    }
    const mem = M.membersOf(W, p.name);
    if (mem.groups.length || mem.minor.length) {
      const s = el('section', 'sec members'); s.dataset.part = 'Members';
      s.appendChild(el('h2', '', membersHead(p)));
      for (const g of mem.groups) s.appendChild(kindGroup(g));
      if (mem.minor.length) {
        const ml = el('div', 'minor');
        for (const x of mem.minor) {
          const r = el('div', 'mrow'); r.appendChild(el('span', 'nm', x.name)); if (x.note) r.appendChild(el('span', 'note', x.note));
          const b = el('button', 'bl-btn sm ghost make', 'Make a page'); b.type = 'button'; b.title = 'Give ' + x.name + ' its own page (one save, one undo)';
          b.addEventListener('click', () => { if (window.__wikiMakeMinor) window.__wikiMakeMinor(p, x); });
          r.appendChild(b); ml.appendChild(r);
        }
        s.appendChild(ml);
      }
      main.appendChild(s);
    }
    if (p.tiedBy && p.tiedBy.length) {
      const s = el('section', 'sec bonds tiedby'); s.dataset.part = 'Tied';
      s.appendChild(el('h2', '', 'Tied to it'));
      const cs = el('div', 'chips');
      for (const t of p.tiedBy.slice().sort((a, b) => a.name.localeCompare(b.name))) { const c = chip({ target: t.name, label: (W.pages.get(t.name) || {}).title }); if (t.word) c.appendChild(el('span', 'bw', t.word)); cs.appendChild(c); }
      s.appendChild(cs); main.appendChild(s);
    }
    if (p.name === M.PREFIX + 'Sections') main.appendChild(shelfList());
    if (p.shelf) main.appendChild(usedOn(p));
    if (layers.margin && p.margin.trim()) cols.appendChild(margin(p.margin));
    if (layers.behind && p.behind.parts.length) {
      const d = el('details', 'behind'); d.dataset.part = 'behind';
      const open = store.get('memphis.wiki.behindOpen');
      if (open || p.noRecord) d.open = true;   // v6: a page with no record opens on what is behind it
      const sm = el('summary'); sm.appendChild(el('span', '', 'Behind the scenes'));
      if (p.behind.open.length && layers.truth) { const q = el('span', 'mk-open small', '?'); q.title = p.behind.open.length + ' open'; sm.appendChild(q); sm.appendChild(el('span', 'nopen', p.behind.open.length + ' open')); }
      d.appendChild(sm);
      d.addEventListener('toggle', () => store.set('memphis.wiki.behindOpen', d.open));
      for (const part of p.behind.parts) {
        const sec = el('div', 'bpart');
        if (part.head) sec.appendChild(el('h4', '', part.head));
        sec.appendChild(md(part.text, /^open/i.test(part.head)));
        d.appendChild(sec);
      }
      main.appendChild(d);
    }
    art.appendChild(cols);
  }
  function renderMedia(which) {
    const art = el('article', 'pg media');
    art.appendChild(crumbs([{ text: 'Index', go: 'index|' }, { text: which === 'sketch' ? 'Sketchbook' : 'Media' }]));
    art.appendChild(el('h1', '', which === 'sketch' ? 'Sketchbook' : 'Media'));
    const used = M.pictures(W);
    const all = new Map(); for (const n of media) all.set(n, used.get(n) || { file: n, kinds: [], captions: [], pages: [] });
    for (const [n, it] of used) all.set(n, it);
    let items = [...all.values()];
    if (which === 'sketch') items = items.filter(it => it.kinds.includes('sketch'));
    items.sort((a, b) => a.file.localeCompare(b.file));
    art.appendChild(el('p', 'oneline', which === 'sketch'
      ? (items.length ? 'Your drawings and work in progress. They live Behind the scenes, never as canon, until you promote them.' : 'No sketches yet. Place a picture frame Behind the scenes on a page and choose Sketch.')
      : (items.length ? items.length + (items.length === 1 ? ' picture' : ' pictures') + ' in Media.' : 'No pictures in Media yet.')));
    const grid = el('div', 'mgrid');
    for (const it of items) {
      const f = el('figure', 'pic mcard ' + (it.kinds[0] || 'unused')); f.dataset.src = it.file;
      f.appendChild(el('div', 'pic-frame'));
      const cap = el('figcaption');
      const lb = el('div', 'mlbls');
      if (!it.kinds.length) lb.appendChild(el('span', 'pic-lbl unused', 'Unused'));
      for (const k of it.kinds) lb.appendChild(el('span', 'pic-lbl ' + k, k.replace(/^\w/, c => c.toUpperCase())));
      cap.appendChild(lb);
      if (it.captions.length) cap.appendChild(el('div', 'mcap', it.captions.join(' / ')));
      const cs = el('div', 'chips'); it.pages.forEach(n => cs.appendChild(chip({ target: n, label: (W.pages.get(n) || {}).title })));
      cap.appendChild(cs); f.appendChild(cap); grid.appendChild(f);
    }
    art.appendChild(grid);
    page.appendChild(art);
  }
  function shelfList() {
    const sh = M.shelf(W);
    const s = el('section', 'sec shelf');
    for (const [head, list] of [['Sections', sh.sections], ['Fact lines', sh.facts]]) {
      s.appendChild(el('h2', '', head));
      const ul = el('div', 'plist');
      for (const it of list) {
        const a = el('a', 'prow wl ' + (it.page ? 'page' : 'missing') + (it.empty ? ' dashed' : '')); a.href = '#'; a.dataset.kind = it.page ? 'page' : 'missing'; a.dataset.target = it.page || it.name;
        a.append(el('span', 'nm', it.name), el('span', 'ct', (it.uses || 0) + (it.uses === 1 ? ' page' : ' pages')));
        if (it.default_for.length) a.appendChild(el('span', 'tag', it.default_for.join(', ')));
        ul.appendChild(a);
      }
      s.appendChild(ul);
    }
    return s;
  }
  function usedOn(p) {
    const name = String(p.fm.name || M.plainName(p.name).replace(/^(Section|Fact)\s+-\s+/, '')).toLowerCase();
    const list = [...W.pages.values()].filter(q => !q.onShelf && (p.shelf === 'fact' ? q.facts.some(f => f.name.toLowerCase() === name) : q.secs.some(x => x.head.toLowerCase() === name)));
    const s = el('section', 'sec used'); s.appendChild(el('h2', '', 'Used on ' + list.length + (list.length === 1 ? ' page' : ' pages')));
    const cs = el('div', 'chips'); list.sort((a, b) => a.title.localeCompare(b.title)).forEach(q => cs.appendChild(chip({ target: q.name, label: q.title }))); s.appendChild(cs);
    return s;
  }

  if (!M || !API) { page.textContent = 'The wiki could not start (its bridge is missing).'; return; }
  API.onChanged(() => load(true));
  load(false);
  window.__wiki = { show, state: () => ({ view, layers, pages: W ? W.pages.size : 0 }) };   // for the checks
  window.__wikiCore = { M, API, el, status, load, show, goBack, layers, page,
    get W() { return W; }, get view() { return view; }, get media() { return media; }, currentPage, folderOf, buildRight, go, dot, crumbs, md, openVault, hydratePictures, chip, pchip, kindGroup };
})();
