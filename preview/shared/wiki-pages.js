'use strict';
(function () {
  const C = window.__wikiCore, E = window.__wikiEdit;
  if (!C || !E) return;
  const { M, el, status } = C;
  const $ = (id) => document.getElementById(id);
  const IC = (n, s) => (window.BladesIcon ? window.BladesIcon(n, s || 14) : '');
  const W = () => C.W;
  const ask = (a, p, ms) => E.ask(a, p, ms);
  const P = M.PREFIX;
  function itemFm(it) { return it.top ? it.top : '[[' + it.name + ']]'; }
  function itemsFrom(list) {
    return (list || []).map(l => {
      if (l.top) return { top: l.top, label: l.top };
      const r = M.resolve(W(), l.target) || { kind: 'missing', name: l.target };
      return { name: r.kind === 'page' ? r.name : l.target, label: l.label || M.plainName(l.target), missing: r.kind !== 'page' };
    });
  }
  function kindItems(q) {
    const n = M.norm(q);
    return M.kinds(W()).filter(k => !n || M.norm(k.title).includes(n) || (k.synonyms || []).some(s => M.norm(s).includes(n)))
      .sort((a, b) => (a.isTop === b.isTop ? a.title.localeCompare(b.title) : a.isTop ? 1 : -1)).slice(0, 10)
      .map(k => k.isTop ? { top: k.top, label: k.top, hint: 'top' } : { name: k.name, label: k.title, hint: 'kind · ' + (k.top || '') });
  }
  function pageItems(q, filter) {
    return M.find(W(), q, 8, filter).map(h => ({ name: h.name, label: h.title, hint: C.folderOf(h.folder).name }));
  }
  function picker(label, values, opts) {
    opts = opts || {};
    const wrap = el('div', 'pk-field');
    wrap.appendChild(el('span', 'pk-lbl', label));
    const box = el('div', 'pk-box'); wrap.appendChild(box);
    const input = el('input', 'pk-in'); input.type = 'text'; input.placeholder = opts.placeholder || 'Search'; input.spellcheck = false;
    const list = el('div', 'pk-list'); list.hidden = true;
    let vals = (values || []).slice(), hits = [], hi = 0;
    const changed = () => { if (opts.onChange) opts.onChange(vals); };
    function draw() {
      box.innerHTML = '';
      vals.forEach((v, i) => {
        const c = el('span', 'chip pk-chip' + (v.isNew ? ' new' : '') + (v.top ? ' top' : '') + (v.missing ? ' dashed' : ''));
        c.appendChild(el('span', '', v.label)); if (v.isNew) c.appendChild(el('span', 'bw', 'new'));
        const x = el('button', 'pk-x'); x.type = 'button'; x.innerHTML = IC('close', 10); x.title = 'Take it away';
        x.addEventListener('click', () => { vals.splice(i, 1); draw(); changed(); });
        c.appendChild(x); box.appendChild(c);
      });
      if (!opts.max || vals.length < opts.max) box.appendChild(input);
    }
    function drawList() {
      list.innerHTML = ''; list.hidden = !hits.length;
      hits.forEach((h, i) => {
        const b = el('button', 'hit' + (i === hi ? ' on' : '')); b.type = 'button';
        b.append(el('span', 'nm', h.isNew ? 'Make "' + h.label + '"' : h.label), el('span', 'fd', h.hint || ''));
        b.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
        list.appendChild(b);
      });
    }
    async function pick(i) {
      const h = hits[i]; if (!h) return;
      let v = h;
      if (h.isNew && opts.confirmNew) { v = await opts.confirmNew(h.label); if (!v) return; }
      if (!vals.some(x => (x.name || x.top || x.label) === (v.name || v.top || v.label))) vals.push(v);
      input.value = ''; hits = []; drawList(); draw(); changed(); input.focus();
    }
    input.addEventListener('input', () => {
      const q = input.value.trim();
      hits = q ? opts.search(q) : [];
      if (q && opts.allowNew && !hits.some(h => h.label.toLowerCase() === q.toLowerCase())) hits.push({ isNew: true, label: M.cleanTitle(q), name: P + M.cleanTitle(q), hint: opts.newHint || 'a new page' });
      hi = 0; drawList();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hits.length - 1, hi + 1); drawList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); drawList(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hits.length) pick(hi); }
      else if (e.key === 'Backspace' && !input.value && vals.length) { vals.pop(); draw(); changed(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { hits = []; drawList(); }, 150));
    wrap.appendChild(list);
    draw();
    return { el: wrap, get: () => vals.slice(), set: (v) => { vals = v.slice(); draw(); }, focus: () => input.focus() };
  }
  function twinNote(holder, items, name, onUse, onNew, what) {
    holder.innerHTML = '';
    const t = M.twin(items, name);
    if (!t || t.item.name === name) return null;
    const uses = t.item.uses != null ? ', on ' + t.item.uses + (t.item.uses === 1 ? ' page' : ' pages') : '';
    holder.appendChild(el('span', 'tw-t', 'You already have ' + t.item.name + uses + (t.why === 'synonym' ? ' (also called ' + t.as + ')' : '') + '.'));
    const u = el('button', 'bl-btn sm bone', 'Use ' + t.item.name); u.type = 'button'; u.addEventListener('click', () => onUse(t.item));
    const n = el('button', 'bl-btn sm ghost', 'Make a new ' + (what || 'one')); n.type = 'button'; n.addEventListener('click', () => onNew(name));
    holder.append(u, n);
    return t;
  }
  function dialog(title) {
    const back = el('div', 'wk-back'), d = el('div', 'wk-dlg'); back.appendChild(d);
    d.appendChild(el('div', 'kicker', title));
    document.body.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener('keydown', esc, true); };
    function esc(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', esc, true);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    return { d, close };
  }
  function shelfChoose(kind, page) {
    return new Promise((resolve) => {
      const sh = M.shelf(W());
      const items = kind === 'fact' ? sh.facts : sh.sections;
      const { d, close } = dialog(kind === 'fact' ? '+ fact line' : '+ section');
      const done = (v) => { close(); resolve(v); };
      const input = el('input', 'pk-in wide'); input.type = 'text'; input.placeholder = kind === 'fact' ? 'Born, Ruled by...' : 'Personality, Powers...';
      d.appendChild(input);
      const tw = el('div', 'twin'); d.appendChild(tw);
      const list = el('div', 'pk-list open'); d.appendChild(list);
      const have = new Set(kind === 'fact' ? page.facts.map(f => f.name.toLowerCase()) : page.secs.map(s => s.head.toLowerCase()));
      const sug = kind === 'fact' ? [] : M.suggestSections(W(), page);
      function draw() {
        const q = input.value.trim(), n = M.norm(q);
        list.innerHTML = '';
        const rows = [];
        if (!q && sug.length) rows.push({ head: 'Used by their other members' }, ...sug.map(s => ({ name: s.name, hint: s.count + ' of them' })));
        const shown = items.filter(it => !have.has(it.name.toLowerCase()) && (!n || M.norm(it.name).includes(n) || it.synonyms.some(s => M.norm(s).includes(n))));
        if (shown.length) rows.push({ head: 'On the shelf' }, ...shown.map(it => ({ name: it.name, hint: (it.uses || 0) + (it.uses === 1 ? ' page' : ' pages') })));
        for (const r of rows) {
          if (r.head) { list.appendChild(el('div', 'pk-h', r.head)); continue; }
          const b = el('button', 'hit'); b.type = 'button'; b.append(el('span', 'nm', r.name), el('span', 'fd', r.hint || ''));
          b.addEventListener('click', () => done({ name: r.name, isNew: false })); list.appendChild(b);
        }
        tw.innerHTML = '';
        if (q && !items.some(it => it.name.toLowerCase() === q.toLowerCase())) {
          const t = twinNote(tw, items, q, (it) => done({ name: it.name, isNew: false }), (nm) => done({ name: M.cleanTitle(nm), isNew: true }));
          if (!t) { const b = el('button', 'bl-btn sm bone', 'Make the ' + (kind === 'fact' ? 'fact line' : 'section') + ' ' + M.cleanTitle(q)); b.type = 'button'; b.addEventListener('click', () => done({ name: M.cleanTitle(q), isNew: true })); tw.appendChild(b); }
        }
      }
      input.addEventListener('input', draw);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const q = input.value.trim(); const ex = items.find(it => it.name.toLowerCase() === q.toLowerCase()); if (ex) done({ name: ex.name, isNew: false }); } });
      const cancel = el('button', 'bl-btn sm coal', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => done(null));
      const bar = el('div', 'ed-bar'); bar.appendChild(cancel); d.appendChild(bar);
      draw(); input.focus();
    });
  }
  function newKind(name) {
    return new Promise((resolve) => {
      const { d, close } = dialog('A new kind');
      const done = (v) => { close(); resolve(v); };
      const tw = el('div', 'twin'); d.appendChild(tw);
      const items = M.kinds(W()).map(k => ({ name: k.title, page: k.name, top: k.top, isTop: k.isTop, synonyms: k.synonyms || [] }));
      const t = twinNote(tw, items, name, (it) => done(it.isTop ? { top: it.top, label: it.top } : { name: it.page, label: it.name }), () => { tw.innerHTML = ''; }, 'kind');
      d.appendChild(el('p', 'ed-hint', (t ? 'Or make ' : '') + name + ' a new kind. A kind has exactly one What: another kind or one of the nine tops. What is a ' + name + '?'));
      let what = null;
      const pk = picker('What', [], { search: kindItems, max: 1, placeholder: 'Planet, Place, Species...', onChange: (v) => { what = v[0] || null; go.disabled = !what; } });
      d.appendChild(pk.el);
      const bar = el('div', 'ed-bar');
      const cancel = el('button', 'bl-btn sm coal', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => done(null));
      const go = el('button', 'bl-btn sm gold', 'Make the kind ' + name); go.type = 'button'; go.disabled = true;
      go.addEventListener('click', () => done({ name: P + name, label: name, isNew: true, newKind: true, what }));
      bar.append(cancel, go); d.appendChild(bar);
      setTimeout(() => pk.focus(), 0);
    });
  }
  function topOfItem(it) {
    if (!it) return null;
    if (it.top) return it.top;
    if (it.newKind) return topOfItem(it.what);
    const q = W().pages.get(it.name); if (!q) return null;
    if (!q.kindPage && q.top === 'Group') return 'Being';
    return q.top;
  }
  function kindsOfItem(it) {
    if (!it || it.top) return [];
    if (it.newKind) return [M.plainName(it.name)].concat(kindsOfItem(it.what));
    const q = W().pages.get(it.name); if (!q || !q.kindPage) return [];
    return [q.title].concat(M.kindChain(W(), q));
  }
  function parentFiles(items, as, made) {
    const out = [];
    for (const it of items) {
      if (!it.isNew || made.has(it.name.toLowerCase())) continue;
      made.add(it.name.toLowerCase());
      const title = M.plainName(it.name);
      if (it.newKind) {
        const top = topOfItem(it.what);
        out.push({ rel: 'Evrynthing/' + M.topFolder(top) + '/' + P + M.cleanTitle(title) + '.md', expect: null,
          text: M.newPageText({ title, top, kindPage: true, what: [itemFm(it.what)], empty: true }) });
        if (it.what && it.what.isNew && !it.what.newKind) out.push(...parentFiles([it.what], 'what', made));
        continue;
      }
      const top = as === 'where' ? 'Place' : 'Group';
      out.push({ rel: 'Evrynthing/' + M.topFolder(top) + '/' + P + M.cleanTitle(title) + '.md', expect: null,
        text: M.newPageText({ title, top, what: as === 'with' ? ['Group'] : [], empty: true }) });
    }
    return out;
  }
  function relOf(p) { return 'Evrynthing/' + p.rel; }
  function inSet(files, rel) { return files.find(f => f.rel.toLowerCase() === rel.toLowerCase()); }
  function bondOnOther(files, otherName, back, me, remove) {
    const q = W().pages.get(otherName); if (!q) return;
    const rel = relOf(q); let f = inSet(files, rel);
    if (!f) { f = { rel, text: q.raw, expect: q.raw }; files.push(f); }
    if (remove) {
      const cur = M.sectionBody(f.text, 'Bonds') || '';
      const lines = cur.split('\n').filter(l => { const b = M.parseBonds(l)[0]; return !(b && (M.resolve(W(), b.target) || {}).name === me); });
      f.text = M.setSection(f.text, 'Bonds', lines.join('\n').trim() ? lines.join('\n') : null);
    } else f.text = M.setBond(f.text, me, back);
  }
  async function saveSet(files, label, page) {
    files = files.filter(f => f.expect == null || f.text !== f.expect);
    if (!files.length) { status('Nothing changed.'); return false; }
    const r = await ask('wiki_save_set', { files, label, page }, 40000);
    if (!r.ok) throw new Error(r.error || 'It was not saved.');
    return r;
  }
  function openEditor(p) {
    E.setEditing(true);
    const pageEl = C.page; pageEl.innerHTML = ''; pageEl.scrollTop = 0;
    const art = el('article', 'pg editor suit-' + p.suit);
    const top = el('div', 'ed-top'); top.appendChild(el('div', 'kicker', 'Editing')); top.appendChild(el('h1', '', p.title)); art.appendChild(top);
    const tabs = el('div', 'bl-tabs ed-tabs'); art.appendChild(tabs);
    const panes = [];
    const tab = (name, i) => {
      const t = el('button', 'bl-tab' + (i ? '' : ' on'), name); t.type = 'button'; tabs.appendChild(t);
      const pane = el('div', 'ed-pane'); pane.hidden = !!i; panes.push(pane); art.appendChild(pane);
      t.addEventListener('click', () => { tabs.querySelectorAll('.bl-tab').forEach(x => x.classList.toggle('on', x === t)); panes.forEach((x, j) => { x.hidden = j !== i; }); });
      return pane;
    };
    const pg = tab('The page', 0), mg = tab("Mentor's margin", 1), bh = tab('Behind the scenes', 2);
    const sp = M.sections(p.raw);
    const area = (val, min) => { const ta = el('textarea', 'ed-ta'); ta.spellcheck = true; ta.value = val || ''; const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(min || 110, ta.scrollHeight + 4) + 'px'; }; ta.addEventListener('input', grow); setTimeout(grow, 0); return ta; };
    pg.appendChild(el('label', 'ed-lbl', 'One line: what it is, in one sentence'));
    const line = el('input', 'ed-in'); line.type = 'text'; line.value = p.line || ''; pg.appendChild(line);
    pg.appendChild(el('label', 'ed-lbl', 'Parents'));
    const newParent = (as) => async (label) => ({ name: P + label, label, isNew: true, as });
    const kindNew = async (label) => newKind(label);
    const KEYS = ['what', 'where', 'with'];
    const pk = {
      what: picker('What (its kind)', itemsFrom(p.parents.what), { search: kindItems, allowNew: true, newHint: 'a new kind', confirmNew: kindNew, max: p.kindPage ? 1 : 0, placeholder: 'City, Species, Place...' }),
      where: picker('Where', itemsFrom(p.parents.where), { search: (q) => pageItems(q), allowNew: true, confirmNew: newParent('where') }),
      with: picker('With', itemsFrom(p.parents.with), { search: (q) => pageItems(q), allowNew: true, confirmNew: newParent('with') }),
    };
    const pbox = el('div', 'pk-grid'); Object.values(pk).forEach(x => pbox.appendChild(x.el)); pg.appendChild(pbox);
    pg.appendChild(el('label', 'ed-lbl', 'Facts'));
    const factBox = el('div', 'ed-facts'); pg.appendChild(factBox);
    const facts = p.facts.map(f => (f.group ? { name: f.name, value: f.value, group: f.group } : { name: f.name, value: f.value }));
    for (const n of M.layoutFor(W(), p.top, M.kindChain(W(), p)).facts) if (!facts.some(f => f.name.toLowerCase() === n.toLowerCase()) && !p.onShelf && !p.landing) facts.push({ name: n, value: '', offered: true });
    const newShelf = { section: new Set(), fact: new Set() };
    function drawFacts() {
      factBox.innerHTML = '';
      facts.forEach((f, i) => {
        const r = el('div', 'frow'); r.appendChild(el('span', 'fn', f.name));
        const v = el('input', 'ed-in'); v.type = 'text'; v.value = f.value; v.addEventListener('input', () => { f.value = v.value; });
        const x = el('button', 'pk-x'); x.type = 'button'; x.innerHTML = IC('close', 10); x.title = 'Take this fact line away';
        x.addEventListener('click', () => { facts.splice(i, 1); drawFacts(); });
        r.append(v, x); factBox.appendChild(r);
      });
      const add = el('button', 'bl-btn sm ghost', '+ fact line'); add.type = 'button';
      add.addEventListener('click', async () => {
        const c = await shelfChoose('fact', Object.assign({}, p, { facts })); if (!c) return;
        const at = facts.findIndex(f => f.name.toLowerCase() === c.name.toLowerCase());
        if (at >= 0) { status(facts[at].name + ' is on this page already.'); const ins = factBox.querySelectorAll('input'); if (ins[at]) ins[at].focus(); return; }
        if (c.isNew) newShelf.fact.add(c.name); facts.push({ name: c.name, value: '' }); drawFacts(); const ins = factBox.querySelectorAll('input'); if (ins.length) ins[ins.length - 1].focus();
      });
      factBox.appendChild(add);
    }
    drawFacts();
    pg.appendChild(el('label', 'ed-lbl', 'Sections'));
    const secBox = el('div', 'ed-secs'); pg.appendChild(secBox);
    const secs = sp.secs.filter(s => !['facts', 'bonds', 'margin', 'behind'].includes(s.kind)).map(s => ({ head: s.heading.replace(/^##\s+/, ''), body: s.body, orig: true }));
    function drawSecs() {
      secBox.innerHTML = '';
      secs.forEach((s, i) => {
        const r = el('div', 'srow'); const hh = el('div', 'sh'); hh.appendChild(el('span', 'snm', s.head));
        const up = el('button', 'pk-x up'); up.type = 'button'; up.innerHTML = IC('chevron-down', 11); up.title = 'Move up'; up.disabled = !i;
        up.addEventListener('click', () => { secs.splice(i - 1, 0, secs.splice(i, 1)[0]); drawSecs(); });
        const x = el('button', 'pk-x'); x.type = 'button'; x.innerHTML = IC('close', 10); x.title = 'Take this section away';
        x.addEventListener('click', () => { if (s.body.trim() && !confirm('Take away ' + s.head + ' and its text?')) return; secs.splice(i, 1); drawSecs(); });
        hh.append(up, x); r.appendChild(hh);
        const ta = area(s.body, s.head === 'Story' ? 150 : 90); ta.addEventListener('input', () => { s.body = ta.value; }); r.appendChild(ta);
        secBox.appendChild(r);
      });
      const add = el('button', 'bl-btn sm ghost', '+ section'); add.type = 'button';
      add.addEventListener('click', async () => {
        const fake = Object.assign({}, p, { secs: secs.map(s => ({ head: s.head })) });
        const c = await shelfChoose('section', fake); if (!c) return;
        if (c.name.toLowerCase() === 'bonds') { status('Bonds have their own place below.'); return; }
        const at = secs.findIndex(s => s.head.toLowerCase() === c.name.toLowerCase());
        if (at >= 0) { status(secs[at].head + ' is on this page already.'); const tas = secBox.querySelectorAll('textarea'); if (tas[at]) tas[at].focus(); return; }
        if (c.isNew) newShelf.section.add(c.name);
        secs.push({ head: c.name, body: '' }); drawSecs();
        const tas = secBox.querySelectorAll('textarea'); if (tas.length) tas[tas.length - 1].focus();
      });
      secBox.appendChild(add);
    }
    drawSecs();
    pg.appendChild(el('label', 'ed-lbl', 'Bonds'));
    const bondBox = el('div', 'ed-bonds'); pg.appendChild(bondBox);
    const bonds0 = p.bonds.map(b => ({ name: (M.resolve(W(), b.target) || {}).name || b.target, label: b.label, word: b.word }));
    const bonds = bonds0.map(b => Object.assign({}, b));
    function drawBonds() {
      bondBox.innerHTML = '';
      bonds.forEach((b, i) => {
        const r = el('div', 'frow'); r.appendChild(el('span', 'fn', b.label));
        const w = el('input', 'ed-in'); w.type = 'text'; w.placeholder = 'one word: teacher'; w.value = b.word || '';
        const back = el('input', 'ed-in'); back.type = 'text'; back.placeholder = 'their word for ' + p.title;
        back.value = b.back != null ? b.back : '';
        w.addEventListener('input', () => { b.word = w.value; if (!b.backTouched) { b.back = M.backWord(W(), w.value); back.value = b.back; } });
        back.addEventListener('input', () => { b.back = back.value; b.backTouched = true; });
        const x = el('button', 'pk-x'); x.type = 'button'; x.innerHTML = IC('close', 10); x.title = 'Take this bond away (from both pages)';
        x.addEventListener('click', () => { bonds.splice(i, 1); drawBonds(); });
        r.append(w, el('span', 'arrow', 'and on their page'), back, x); bondBox.appendChild(r);
      });
      const add = picker('+ bond', [], { search: (q) => pageItems(q, x => x.name !== p.name), max: 1, placeholder: 'Find a page', onChange: (v) => { if (!v[0]) return; if (!bonds.some(b => b.name === v[0].name)) bonds.push({ name: v[0].name, label: v[0].label, word: '', back: '', isNew: true }); drawBonds(); const ins = bondBox.querySelectorAll('.frow input'); if (ins.length) ins[ins.length - 2].focus(); } });
      bondBox.appendChild(add.el);
    }
    drawBonds();
    mg.appendChild(el('label', 'ed-lbl', "Mentor's margin (belief: his journal, in his hand)"));
    const taM = area(M.bodyOf(p.raw, 'margin'), 160); mg.appendChild(taM);
    bh.appendChild(el('label', 'ed-lbl', 'Behind the scenes (your notes: ### Open, ### In the book, ### History)'));
    const taB = area(M.bodyOf(p.raw, 'behind'), 160); bh.appendChild(taB);
    art.appendChild(el('p', 'ed-hint', 'Links: [[eV - Page name]]. A belief: "> [!belief] Who". An open question: "- ? ..." under ### Open. Nothing is written until you save, and every save can be undone in one move.'));
    const bar = el('div', 'ed-bar');
    let asDefault = null;
    const topNow = () => topOfItem(pk.what.get()[0]) || p.top || M.FOLDER_TOP[p.folder] || null;
    if (!p.onShelf && !p.landing && p.name !== P + 'Index') {
      const lab = el('label', 'tog'); asDefault = el('input'); asDefault.type = 'checkbox';
      const txt = el('span', '', ''); const upd = () => { const t = topNow(); txt.textContent = t ? 'Save as the default for ' + t : 'No top yet, so no default to save'; asDefault.disabled = !t; };
      upd(); pk.what.el.addEventListener('click', () => setTimeout(upd, 0)); pk.what.el.addEventListener('keyup', () => setTimeout(upd, 0));
      lab.append(asDefault, txt); bar.appendChild(lab);
      lab.addEventListener('mouseenter', upd);
    }
    const cancel = el('button', 'bl-btn coal', 'Cancel'); cancel.type = 'button';
    const save = el('button', 'bl-btn gold', 'Save'); save.type = 'button';
    bar.append(cancel, save); art.appendChild(bar);
    pageEl.appendChild(art);
    line.focus();
    function compose() {
      let t = p.raw.replace(/\r\n/g, '\n');
      t = M.setLead(t, line.value);
      const par = {}; for (const k of KEYS) par[k] = pk[k].get().map(itemFm);
      const same = KEYS.every(k => JSON.stringify(par[k]) === JSON.stringify(M.parentStrings(p.parents[k])));
      if (!same || M.PARENT_KEYS.some(k => Object.prototype.hasOwnProperty.call(p.fm, k))) t = M.setParents(t, Object.assign(par, { book: [] }));
      const keep = new Set(secs.map(s => s.head.toLowerCase()));
      for (const s of M.sections(t).secs) { const h = s.heading.replace(/^##\s+/, ''); if (!['facts', 'bonds', 'margin', 'behind'].includes(s.kind) && !keep.has(h.toLowerCase())) t = M.setSection(t, h, null); }
      for (const s of secs) t = M.setSection(t, s.head, s.body);
      const st = M.sections(t);
      const order = secs.map(s => s.head.toLowerCase());
      const mov = st.secs.filter(s => order.includes(s.heading.replace(/^##\s+/, '').toLowerCase()));
      mov.sort((a, b) => order.indexOf(a.heading.replace(/^##\s+/, '').toLowerCase()) - order.indexOf(b.heading.replace(/^##\s+/, '').toLowerCase()));
      let k = 0; st.secs = st.secs.map(s => order.includes(s.heading.replace(/^##\s+/, '').toLowerCase()) ? mov[k++] : s);
      t = M.assemble(st);
      t = M.setFacts(t, facts.filter(f => !(f.offered && !String(f.value).trim())));
      t = M.setSection(t, 'Bonds', bonds.length ? bonds.map(b => '- [[' + b.name + ']]' + (b.word.trim() ? ' · ' + b.word.trim() : '')).join('\n') : (p.bonds.length || M.sectionBody(t, 'Bonds') != null ? '' : null));
      if (taM.value !== M.bodyOf(p.raw, 'margin')) t = M.compose(t, { margin: taM.value });
      if (taB.value !== M.bodyOf(p.raw, 'behind')) t = M.compose(t, { behind: taB.value });
      return { t, par };
    }
    const dirty = () => compose().t !== p.raw.replace(/\r\n/g, '\n') || !!(asDefault && asDefault.checked);
    window.__wikiLeave = () => { if (!E.editing()) return true; if (dirty() && !confirm('Leave without saving? Your changes here are lost.')) return false; E.setEditing(false); document.removeEventListener('keydown', keys, true); return true; };
    cancel.addEventListener('click', () => { if (!window.__wikiLeave()) return; C.show(viewOf(p), { noHistory: true }); });
    async function doSave() {
      let files;
      try {
        const { t, par } = compose();
        files = [{ rel: relOf(p), text: t, expect: p.raw }];
        const made = new Set();
        for (const k of KEYS) files.push(...parentFiles(pk[k].get(), k, made));
        for (const b of bonds) {
          const was = bonds0.find(x => x.name === b.name);
          if (b.back != null && b.back.trim() !== '' && (!was || b.backTouched || b.word !== was.word)) bondOnOther(files, b.name, b.back.trim(), p.name);
          else if (!was && b.word.trim()) bondOnOther(files, b.name, M.backWord(W(), b.word), p.name);
        }
        for (const was of bonds0) if (!bonds.some(b => b.name === was.name)) bondOnOther(files, was.name, '', p.name, true);
        const top = topNow();
        const sh = M.shelf(W());
        const shelfFile = (kind, name, extra) => {
          const rel = 'Evrynthing/' + M.shelfRel(kind, name);
          if (inSet(files, rel)) return inSet(files, rel);
          const it = (kind === 'fact' ? sh.facts : sh.sections).find(x => x.name.toLowerCase() === name.toLowerCase());
          if (it && it.page) { const q = W().pages.get(it.page); const f = { rel: relOf(q), text: q.raw, expect: q.raw }; files.push(f); return f; }
          const f = { rel, expect: null, text: M.shelfPageText(Object.assign({ kind, name, form: kind === 'section' ? M.BUILTIN_FORMS[name] || 'text' : undefined, default_for: it ? it.default_for.slice() : [], order: it ? it.order : 0 }, extra || {})) };
          files.push(f); return f;
        };
        newShelf.section.forEach(n => { if (secs.some(s => s.head === n)) shelfFile('section', n); });
        newShelf.fact.forEach(n => { if (facts.some(f => f.name === n)) shelfFile('fact', n); });
        if (asDefault && asDefault.checked && top) {
          const lower = top.toLowerCase();
          const onPage = { section: ['Story'].concat(secs.map(s => s.head).filter(h => h !== 'Story' && !/^(i|ii|iii)\s/i.test(h))).concat(bonds.length ? ['Bonds'] : []), fact: facts.map(f => f.name) };
          for (const kind of ['section', 'fact']) {
            const all = kind === 'fact' ? sh.facts : sh.sections;
            const names = onPage[kind].map(x => x.toLowerCase());
            for (const nm of new Set(all.map(it => it.name.toLowerCase()).concat(names))) {
              const it = all.find(x => x.name.toLowerCase() === nm);
              const want = names.includes(nm), has = !!it && it.default_for.some(x => x.toLowerCase() === lower);
              if (!want && !has) continue;
              const f = shelfFile(kind, it ? it.name : onPage[kind][names.indexOf(nm)]);
              const cur = [].concat(M.parseFrontmatter(f.text).fm.default_for || []).map(String).filter(x => x && x.toLowerCase() !== lower);
              if (want) cur.push(top);
              f.text = M.setFmRaw(f.text, 'default_for', M.fmList(cur) || '[]');
              if (want) f.text = M.setFmRaw(f.text, 'order', String(nm === 'story' ? 10 : 20 + names.indexOf(nm) * 10));
            }
          }
        }
      } catch (err) { status(err.message, true); return; }
      save.disabled = true; save.textContent = 'Saving';
      try {
        const r = await saveSet(files, 'Edit ' + p.title, relOf(p));
        E.setEditing(false); document.removeEventListener('keydown', keys, true);
        if (r) status(r.rels.length > 1 ? 'Saved ' + r.rels.length + ' pages in one save. Undo last save puts them all back.' : 'Saved. Undo last save puts it back.');
        await C.load(false);
        C.show(viewOf(p), { noHistory: true });
      } catch (err) { status(err.message, true); save.disabled = false; save.textContent = 'Save'; }
    }
    save.addEventListener('click', doSave);
    function keys(ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); doSave(); }
      else if (ev.key === 'Escape' && !document.querySelector('.wk-back')) { ev.preventDefault(); cancel.click(); }
    }
    document.addEventListener('keydown', keys, true);
  }
  function viewOf(p) {
    if (p.name === P + 'Index') return { kind: 'index' };
    if (p.landing) return { kind: 'folder', id: p.folder };
    return { kind: 'page', id: p.name };
  }
  E.useEditor(openEditor);
  function newPage(prefill) {
    if (!E.canWrite()) { status(E.why() || 'Memphis cannot save right now.', true); return; }
    const { d, close } = dialog('New page');
    const f = el('div', 'np');
    f.appendChild(el('label', 'ed-lbl', 'Name'));
    const name = el('input', 'ed-in'); name.type = 'text'; name.placeholder = 'Dozche'; f.appendChild(name);
    const nameNote = el('div', 'twin'); f.appendChild(nameNote);
    const kind = picker('Kind', [], { search: kindItems, allowNew: true, newHint: 'a new kind', confirmNew: (l) => newKind(l), max: 1, placeholder: 'City, Species, Place...', onChange: upd });
    const where = picker('Where', (prefill && prefill.where) || [], { search: (q) => pageItems(q), allowNew: true, confirmNew: async (l) => ({ name: P + l, label: l, isNew: true }) });
    const withp = picker('With', (prefill && prefill.with) || [], { search: (q) => pageItems(q), allowNew: true, confirmNew: async (l) => ({ name: P + l, label: l, isNew: true }) });
    f.append(kind.el, where.el, withp.el);
    const aspect = el('div', 'seg np-aspect'); aspect.hidden = true;
    const asp = '08 Aura';
    f.appendChild(aspect);
    f.appendChild(el('label', 'ed-lbl', 'One line (optional)'));
    const one = el('input', 'ed-in'); one.type = 'text'; one.placeholder = 'What it is, in one sentence'; f.appendChild(one);
    const lands = el('p', 'ed-hint np-lands', ''); f.appendChild(lands);
    d.appendChild(f);
    const bar = el('div', 'ed-bar');
    const cancel = el('button', 'bl-btn coal', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', close);
    const go = el('button', 'bl-btn gold', 'Make the page'); go.type = 'button';
    bar.append(cancel, go); d.appendChild(bar);
    function upd() {
      const top = topOfItem(kind.get()[0]);
      aspect.hidden = true;
      const folder = top ? M.topFolder(top, asp) : null;
      const suit = top ? M.TOP_BY_NAME[top.toLowerCase()].suit : null;
      const lay = top ? M.layoutFor(W(), top, kindsOfItem(kind.get()[0])) : null;
      lands.textContent = top ? 'It lands in ' + C.folderOf(folder).num + ' ' + C.folderOf(folder).name + ', in ' + ({ domina: 'Domina', aura: 'Aura', magia: 'Magia' })[suit] + ', laid out as a ' + top + ': ' + lay.sections.join(', ') + (lay.facts.length ? '; facts ' + lay.facts.join(', ') : '') + '.' : 'Pick its kind: the kind decides the folder, the layout and the colour.';
      go.disabled = !name.value.trim() || !top;
    }
    name.addEventListener('input', () => {
      nameNote.innerHTML = '';
      const n = M.cleanTitle(name.value);
      const ex = n && (M.resolve(W(), P + n) || {}).kind === 'page';
      if (ex) {
        nameNote.appendChild(el('span', 'tw-t', 'There is already a page called ' + n + '.'));
        const o = el('button', 'bl-btn sm bone', 'Open it'); o.type = 'button'; o.addEventListener('click', () => { close(); C.go({ kind: 'page', id: M.resolve(W(), P + n).name }); });
        nameNote.appendChild(o);
      }
      upd(); go.disabled = go.disabled || ex;
    });
    go.addEventListener('click', async () => {
      const title = M.cleanTitle(name.value), k = kind.get()[0], top = topOfItem(k);
      if (!title || !top) return;
      const folder = M.topFolder(top, asp);
      const lay = M.layoutFor(W(), top, kindsOfItem(k));
      const files = [{ rel: 'Evrynthing/' + folder + '/' + P + title + '.md', expect: null,
        text: M.newPageText({ title, top, folder, what: [itemFm(k)], where: where.get().map(itemFm), with: withp.get().map(itemFm), line: one.value, sections: lay.sections, facts: lay.facts }) }];
      const made = new Set([(P + title).toLowerCase()]);
      files.push(...parentFiles([k], 'what', made), ...parentFiles(where.get(), 'where', made), ...parentFiles(withp.get(), 'with', made));
      go.disabled = true; go.textContent = 'Making it';
      try {
        const r = await saveSet(files, 'New page ' + title, files[0].rel);
        close();
        status(files.length > 1 ? 'Made ' + title + ' and ' + (files.length - 1) + ' more (one save, one undo).' : 'Made ' + title + '. Undo last save takes it away.');
        await C.load(false);
        if (r) C.go({ kind: 'page', id: P + title });
      } catch (err) { status(err.message, true); go.disabled = false; go.textContent = 'Make the page'; }
    });
    upd(); name.focus();
  }
  window.__wikiMakeMinor = async (parent, x) => {
    if (!E.canWrite()) { status(E.why() || 'Memphis cannot save right now.', true); return; }
    const title = M.cleanTitle(x.name); if (!title) return;
    if ((M.resolve(W(), P + title) || {}).kind === 'page') { status('There is already a page called ' + title + '.', true); return; }
    const rel = parent.kindPage ? 'what' : parent.top === 'Place' ? 'where' : 'with';
    const pr = { what: [], where: [], with: [] }; pr[rel] = ['[[' + parent.name + ']]'];
    const top = parent.kindPage ? parent.top : rel === 'with' && parent.top === 'Group' ? 'Being' : 'Being';
    const folder = M.topFolder(top);
    const lay = M.layoutFor(W(), top);
    const files = [
      { rel: 'Evrynthing/' + folder + '/' + P + title + '.md', expect: null, text: M.newPageText({ title, top, folder, what: pr.what, where: pr.where, with: pr.with, line: x.note, sections: lay.sections, facts: lay.facts }) },
      { rel: relOf(parent), expect: parent.raw, text: M.linkMinor(parent.raw.replace(/\r\n/g, '\n'), x.line, title) },
    ];
    try {
      await saveSet(files, 'Make a page for ' + title, files[0].rel);
      status(title + ' has its own page now, and the line is a link. Undo last save puts it back.');
      await C.load(true);
    } catch (err) { status(err.message, true); }
  };
  function rename(p) {
    const old = String(p.fm.name || M.plainName(p.name).replace(/^(Section|Fact)\s+-\s+/, ''));
    const { d, close } = dialog('Rename ' + old);
    d.appendChild(el('p', 'ed-hint', 'Every page that uses ' + old + ' is renamed in one change set: one card in the Sandbox, one approval, one undo.'));
    const input = el('input', 'ed-in'); input.type = 'text'; input.value = old; d.appendChild(input);
    const tw = el('div', 'twin'); d.appendChild(tw);
    const sh = M.shelf(W()); const items = (p.shelf === 'fact' ? sh.facts : sh.sections).filter(it => it.name !== old);
    input.addEventListener('input', () => { twinNote(tw, items, input.value.trim(), () => { status('Pick another name, or rename it to that one in Obsidian.'); }, () => { tw.innerHTML = ''; }); });
    const bar = el('div', 'ed-bar');
    const cancel = el('button', 'bl-btn coal', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', close);
    const go = el('button', 'bl-btn gold', 'Make the change set'); go.type = 'button';
    go.addEventListener('click', async () => {
      const nn = M.cleanTitle(input.value); if (!nn || nn === old) { close(); return; }
      go.disabled = true;
      try {
        const r = await ask('wiki_rename', { kind: p.shelf, old, new: nn }, 40000);
        if (!r.ok) throw new Error(r.error || 'No change set was made.');
        close(); status('Change set ' + r.id + ' is in the Sandbox: ' + r.pages + (r.pages === 1 ? ' page' : ' pages') + '. Nothing changes until you approve it.');
      } catch (err) { status(err.message, true); go.disabled = false; }
    });
    bar.append(cancel, go); d.appendChild(bar);
    input.focus(); input.select();
  }
  const tbox = document.querySelector('#s-bottom .tools');
  const bNew = el('button', 'bl-btn sm bone', ''); bNew.type = 'button'; bNew.id = 't-new'; bNew.innerHTML = IC('plus', 13); bNew.appendChild(el('span', '', 'New page'));
  const bRen = el('button', 'bl-btn sm ghost', ''); bRen.type = 'button'; bRen.id = 't-rename'; bRen.innerHTML = IC('pen', 13); bRen.appendChild(el('span', '', 'Rename everywhere'));
  const edit = $('t-edit');
  tbox.insertBefore(bNew, edit); tbox.insertBefore(bRen, edit);
  bNew.addEventListener('click', () => newPage());
  bRen.addEventListener('click', () => { const p = C.currentPage(); if (p && p.shelf) rename(p); });
  function tools() {
    const why = E.why();
    bNew.disabled = !!why || E.editing(); bNew.title = why || 'Make a new page: name, kind, where and with';
    const p = C.currentPage();
    bRen.hidden = !(p && p.shelf); bRen.disabled = !!why || E.editing();
    bRen.title = why || 'Rename this on every page that uses it (a change set in the Sandbox)';
  }
  E.onTools(tools);
  window.__wikiPages = { newPage, openEditor, rename, picker, topOfItem, parentFiles };
  tools();
})();
