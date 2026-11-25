'use strict';
(function () {
  const C = window.__wikiCore;
  if (!C) return;
  const { M, el, status } = C;
  const $ = (id) => document.getElementById(id);
  const IC = (n, s) => (window.BladesIcon ? window.BladesIcon(n, s || 14) : '');

  let ws = null, live = false, nextId = 0;
  const waiting = new Map();
  const brain = { undo: 0, tied: false, trash: 0 };
  function b64(str) {
    const bytes = new TextEncoder().encode(str);
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  const PHONE = !!(window.wikiAPI && window.wikiAPI.phone);
  function heard(o) {
    if (typeof o.undo === 'number') brain.undo = o.undo;
    if (typeof o.tied === 'boolean') brain.tied = o.tied;
    if (typeof o.trash === 'number') brain.trash = o.trash;
  }
  function connect() {
    if (PHONE) { live = true; tools(); ask('wiki_status').catch(() => {}); return; }
    try { ws = new WebSocket('ws://127.0.0.1:8777'); } catch (e) { setTimeout(connect, 2500); return; }
    ws.onopen = () => { live = true; tools(); ask('wiki_status').catch(() => {}); };
    ws.onmessage = (m) => {
      const raw = String(m.data || '');
      if (raw.indexOf('wiki:') !== 0) return;
      let o; try { o = JSON.parse(unb64(raw.slice(5))); } catch (e) { return; }
      heard(o);
      const w = waiting.get(o.id);
      if (w) { waiting.delete(o.id); clearTimeout(w.t); w.resolve(o); }
      tools();
    };
    ws.onclose = () => { live = false; ws = null; tools(); for (const [id, w] of waiting) { clearTimeout(w.t); w.reject(new Error('Memphis stopped answering.')); waiting.delete(id); } setTimeout(connect, 2500); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* closing */ } };
  }
  function ask(action, payload, ms) {
    if (PHONE) {
      const id = 'p' + Date.now().toString(36) + (++nextId);
      return Promise.resolve(window.wikiAPI.ask(Object.assign({ action, id }, payload || {})))
        .then((o) => { o = o || { ok: false, error: 'No answer.' }; heard(o); tools(); return o; });
    }
    return new Promise((resolve, reject) => {
      if (!live || !ws || ws.readyState !== 1) { reject(new Error('Memphis is not running, so nothing can be saved right now.')); return; }
      const id = 'w' + Date.now().toString(36) + (++nextId);
      const t = setTimeout(() => { waiting.delete(id); reject(new Error('Memphis did not answer. He may be busy talking; try again in a moment.')); }, ms || 25000);
      waiting.set(id, { resolve, reject, t });
      ws.send('savenote:' + b64(JSON.stringify(Object.assign({ action, id }, payload || {}))));
    });
  }

  const box = document.querySelector('#s-bottom .tools');
  function btn(id, cls, icon, label) {
    const b = el('button', 'bl-btn sm ' + cls); b.type = 'button'; b.id = id;
    b.innerHTML = IC(icon, 13); b.appendChild(el('span', '', label)); box.appendChild(b); return b;
  }
  const bPic = btn('t-pic', 'bone', 'plus', 'Picture section');
  const bEdit = btn('t-edit', 'gold', 'pen', 'Edit page');
  const bUndo = btn('t-undo', 'ghost', 'undo', 'Undo last save');
  const bTrash = btn('t-trash', 'coal', 'trash', 'Empty trash');
  if (PHONE) { bPic.remove(); bTrash.remove(); }   // pictures and the vault trash stay on Alaric for now
  let editing = null;   // { p, edits }
  const toolHooks = [];
  let editor = null;    // v5 (wiki-pages.js): the editor for pages with parents
  function tools() {
    const p = C.currentPage();
    const why = !live ? 'Memphis is not running' : brain.tied ? "Memphis's Hands are tied (Control Room)" : '';
    bEdit.disabled = !p || !!why || !!editing;
    bEdit.title = why || (p ? 'Edit this page (all three layers)' : 'This folder has no landing note to edit');
    const onPage = C.view.kind === 'page' && p;
    bPic.disabled = !onPage || !!why || !!editing;
    bPic.title = why || (onPage ? 'Place a picture frame on this page' : 'Open a page to add a picture');
    bUndo.hidden = !brain.undo; bUndo.disabled = !live || brain.tied || !!editing;
    for (const f of toolHooks) { try { f(); } catch (e) { console.error(e); } }   // v5: New page, Rename everywhere
    bUndo.lastChild.textContent = brain.undo > 1 ? 'Undo last save (' + brain.undo + ')' : 'Undo last save';
    bTrash.disabled = !live; bTrash.title = live ? 'See what is in the vault trash and empty it (asks first)' : 'Memphis is not running';
    bTrash.lastChild.textContent = brain.trash ? 'Empty trash (' + brain.trash + ')' : 'Empty trash';
  }
  window.__wikiAfterShow = () => { tools(); };

  bUndo.addEventListener('click', async () => {
    bUndo.disabled = true;
    try {
      const r = await ask('wiki_undo');
      if (r.ok) { status('Undone: ' + M.plainName(String(r.page || '').split('/').pop().replace(/\.md$/, '')) + ' is back as it was.'); C.load(true); }
      else status(r.error || ('Some of it was left alone: ' + (r.left || []).join('; ')), true);
    } catch (e) { status(e.message, true); }
    tools();
  });
  bTrash.addEventListener('click', async () => {
    try { const r = await ask('wiki_trash', null, 40000); status(r.ok ? 'The Sandbox shows what would go. Nothing is deleted until you approve it there.' : (r.error || 'It did not work.'), !r.ok); }
    catch (e) { status(e.message, true); }
  });

  const PARTS = [
    { tab: 'The page', parts: [['what', 'I  What it is'], ['story', 'II  Its story'], ['threads', 'III  Its threads']] },
    { tab: "Mentor's margin", parts: [['margin', "Mentor's margin (belief: his journal, in his hand)"]] },
    { tab: 'Behind the scenes', parts: [['behind', 'Behind the scenes (your notes: ### Open, ### In the book, ### History)']] },
  ];
  bEdit.addEventListener('click', () => { const p = C.currentPage(); if (p) (editor || openEditor)(p); });
  function openEditor(p) {
    editing = { p, from: C.view };
    tools();
    const pageEl = C.page; pageEl.innerHTML = ''; pageEl.scrollTop = 0;
    const art = el('article', 'pg editor suit-' + p.suit);
    const top = el('div', 'ed-top');
    top.appendChild(el('div', 'kicker', 'Editing'));
    top.appendChild(el('h1', '', p.title));
    art.appendChild(top);
    const tabs = el('div', 'bl-tabs ed-tabs'); art.appendChild(tabs);
    const panes = [];
    const areas = {};
    PARTS.forEach((g, i) => {
      const t = el('button', 'bl-tab' + (i ? '' : ' on'), g.tab); t.type = 'button'; tabs.appendChild(t);
      const pane = el('div', 'ed-pane'); pane.hidden = !!i; panes.push(pane); art.appendChild(pane);
      t.addEventListener('click', () => { tabs.querySelectorAll('.bl-tab').forEach(x => x.classList.toggle('on', x === t)); panes.forEach((x, j) => { x.hidden = j !== i; }); const a = pane.querySelector('textarea'); if (a) a.focus(); });
      for (const [k, label] of g.parts) {
        pane.appendChild(el('label', 'ed-lbl', label));
        const ta = el('textarea', 'ed-ta ed-' + k); ta.spellcheck = true; ta.value = M.bodyOf(p.raw, k);
        const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(k === 'threads' ? 90 : 160, ta.scrollHeight + 4) + 'px'; };
        ta.addEventListener('input', grow); setTimeout(grow, 0);
        pane.appendChild(ta); areas[k] = ta;
      }
    });
    const hint = el('p', 'ed-hint', 'Links: [[eV - Page name]]. A belief: a line "> [!belief] Who" with "> what they believe" under it. An open question: "- ? ..." under ### Open. Nothing is written until you save, and every save can be undone.');
    art.appendChild(hint);
    const bar = el('div', 'ed-bar');
    const cancel = el('button', 'bl-btn coal', 'Cancel'); cancel.type = 'button';
    const save = el('button', 'bl-btn gold', 'Save'); save.type = 'button';
    bar.append(cancel, save); art.appendChild(bar);
    pageEl.appendChild(art);
    areas.what.focus();
    const edits = () => { const o = {}; for (const k of Object.keys(areas)) if (areas[k].value !== M.bodyOf(p.raw, k)) o[k] = areas[k].value; return o; };
    const dirty = () => Object.keys(edits()).length > 0;
    window.__wikiLeave = () => { if (!editing) return true; if (dirty() && !confirm('Leave without saving? Your changes here are lost.')) return false; editing = null; document.removeEventListener('keydown', keys, true); return true; };
    cancel.addEventListener('click', () => { if (!window.__wikiLeave()) return; C.show(viewOf(p), { noHistory: true }); });
    async function doSave() {
      const e = edits();
      if (!Object.keys(e).length) { status('Nothing changed.'); return; }
      const text = M.compose(p.raw, e);
      save.disabled = true; save.textContent = 'Saving';
      try {
        const r = await ask('wiki_save', { rel: 'Evrynthing/' + p.rel, text, expect: p.raw, label: 'Edit ' + p.title });
        if (!r.ok) throw new Error(r.error || 'It was not saved.');
        editing = null; document.removeEventListener('keydown', keys, true);
        status('Saved. Undo last save puts it back.');
        await C.load(false);   // the watcher would too; this shows it at once
        C.show(viewOf(p), { noHistory: true });
      } catch (err) { status(err.message, true); save.disabled = false; save.textContent = 'Save'; }
    }
    save.addEventListener('click', doSave);
    function keys(ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); doSave(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancel.click(); }
    }
    document.addEventListener('keydown', keys, true);
  }
  function viewOf(p) {
    if (p.name === M.PREFIX + 'Index') return { kind: 'index' };
    if (p.landing) return { kind: 'folder', id: p.folder };
    return { kind: 'page', id: p.name };
  }

  const menu = el('div', 'pic-menu'); menu.hidden = true; document.body.appendChild(menu);
  [['what', 'In the box, beside the title'], ['story', 'In the Story'], ['behind', 'Behind the scenes (inspiration or sketch)']].forEach(([k, lab]) => {
    const b = el('button', 'pm-item', lab); b.type = 'button'; b.addEventListener('click', () => { menu.hidden = true; placeFrame(k); }); menu.appendChild(b);
  });
  bPic.addEventListener('click', () => {
    if (!menu.hidden) { menu.hidden = true; return; }
    const r = bPic.getBoundingClientRect();
    menu.style.left = Math.max(8, r.left) + 'px'; menu.style.bottom = (innerHeight - r.top + 8) + 'px'; menu.hidden = false;
    $('s-bottom').classList.add('pin');
  });
  document.addEventListener('mousedown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== bPic && !bPic.contains(e.target)) { menu.hidden = true; $('s-bottom').classList.remove('pin'); } });

  const MAX = 8 * 1024 * 1024;
  function placeFrame(where) {
    $('s-bottom').classList.remove('pin');
    const p = C.currentPage(); if (!p) return;
    let host = C.page.querySelector('[data-part="' + where + '"]');
    if (where === 'behind') { if (!C.layers.behind) { status('Turn on the Behind the scenes layer to place an inspiration frame.'); return; } if (host) host.open = true; }
    if (!host) host = C.page.querySelector('.cols .main') || C.page.querySelector('article');
    const fr = el('figure', 'pic drop' + (where === 'behind' ? ' inspiration' : ''));
    const frame = el('div', 'pic-frame');
    frame.appendChild(el('span', 'pic-empty', 'Drop a picture here, or click to choose one'));
    const input = el('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp,image/gif'; input.hidden = true;
    fr.append(frame, input);
    const x = el('button', 'pic-x', ''); x.type = 'button'; x.title = 'Remove this empty frame'; x.innerHTML = IC('close', 12); fr.appendChild(x);
    x.addEventListener('click', () => fr.remove());
    host.appendChild(fr);
    fr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    frame.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files[0]) take(input.files[0]); });
    ['dragenter', 'dragover'].forEach(ev => fr.addEventListener(ev, (e) => { e.preventDefault(); fr.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => fr.addEventListener(ev, (e) => { e.preventDefault(); fr.classList.remove('over'); }));
    fr.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f); });
    function take(file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!/^(png|jpe?g|webp|gif)$/.test(ext) || !/^image\//.test(file.type)) { status('That is not a picture (png, jpg, webp or gif).', true); return; }
      if (file.size > MAX) { status('That picture is bigger than 8 MB. Make it smaller and try again.', true); return; }
      const url = URL.createObjectURL(file);
      frame.innerHTML = ''; const im = el('img'); im.src = url; frame.appendChild(im);
      const form = el('div', 'pic-form');
      const seg = el('div', 'seg pic-kind');
      const bc = el('button', '', 'Canon'), bi = el('button', '', 'Inspiration'), bs = el('button', '', 'Sketch'); bc.type = bi.type = bs.type = 'button';
      let kind = where === 'behind' ? 'inspiration' : 'canon';
      const setKind = (k) => { kind = k; bc.classList.toggle('on', k === 'canon'); bi.classList.toggle('on', k === 'inspiration'); bs.classList.toggle('on', k === 'sketch'); };
      bc.addEventListener('click', () => { if (where !== 'behind') setKind('canon'); });
      bi.addEventListener('click', () => setKind('inspiration'));
      bs.addEventListener('click', () => setKind('sketch'));
      bs.title = 'Your own drawing or work in progress: it goes Behind the scenes and into the Sketchbook';
      if (where === 'behind') { bc.disabled = true; bc.title = 'Behind the scenes holds inspiration and sketches only'; }
      setKind(kind); seg.append(bc, bi, bs);
      const cap = el('input', 'pic-cap'); cap.type = 'text'; cap.placeholder = 'Caption'; cap.maxLength = 80;
      const note = el('div', 'pic-note', 'Canon shows in the page. Inspiration and sketches live only Behind the scenes.');
      const go = el('button', 'bl-btn gold sm', 'Save picture'); go.type = 'button';
      form.append(el('div', 'pic-q', 'Canon, inspiration or sketch?'), seg, cap, note, go);
      fr.appendChild(form); cap.focus();
      cap.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
      go.addEventListener('click', async () => {
        const caption = cap.value.trim();
        const name = fileName(p.name, caption || 'picture', ext === 'jpeg' ? 'jpg' : ext);
        const text = M.addPicture(p.raw, where, kind, name, caption);
        go.disabled = true; go.textContent = 'Saving';
        try {
          const data = await fileB64(file);
          const r = await ask('wiki_save', { rel: 'Evrynthing/' + p.rel, text, expect: p.raw, label: 'Picture on ' + p.title,
            picture: { rel: 'Evrynthing/Media/' + name, name: p.name, caption, ext, b64: data } }, 60000);
          if (!r.ok) throw new Error(r.error || 'It was not saved.');
          URL.revokeObjectURL(url);
          status(kind === 'sketch' ? 'Saved as a sketch, Behind the scenes, and in the Sketchbook.' : kind === 'inspiration' ? 'Saved as inspiration, Behind the scenes, and in Media.' : 'Saved in the page and in Media.');
          await C.load(true);
        } catch (err) { status(err.message, true); go.disabled = false; go.textContent = 'Save picture'; }
      });
    }
  }
  function clean(s) { return String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 80).trim(); }
  function fileName(page, caption, ext) {
    const stem = clean(page) + ' - ' + (clean(caption) || 'picture');
    const have = new Set((C.media || []).map(n => n.toLowerCase()));
    let n = stem + '.' + ext, i = 2;
    while (have.has(n.toLowerCase())) n = stem + ' (' + (i++) + ').' + ext;
    return n;
  }
  function fileB64(file) {
    return file.arrayBuffer().then(buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
  }

  const why = () => (!live ? 'Memphis is not running' : brain.tied ? "Memphis's Hands are tied (Control Room)" : '');
  window.__wikiEdit = { brain, fileName, clean, ask: (a, p, ms) => ask(a, p, ms),
    why, canWrite: () => !why(), editing: () => !!editing,
    setEditing: (on) => { editing = on ? { v5: true } : null; tools(); },
    useEditor: (fn) => { editor = fn; }, onTools: (fn) => { toolHooks.push(fn); } };
  connect();
  tools();
})();
