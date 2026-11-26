'use strict';
// The wiki on the phone: back (top left), search (top right), the drawer (bottom left), edit (bottom right). Nothing else on the screen.
(function () {
  const $ = (id) => document.getElementById(id);
  const C = window.__wikiCore, Ph = window.Phone, U = Ph && Ph.ui;
  if (!C || !U) return;
  const IC = U.icon, M = C.M, el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const editing = () => !!(window.__wikiEdit && window.__wikiEdit.editing()) || !!C.page.querySelector('.editor');

  // ---------- drawer: actions, folders, layers ----------
  const drawer = el('aside', 'wdrawer'); drawer.setAttribute('aria-label', 'Folders and tools');
  const acts = el('div', 'dr-acts');
  const scrim = $('scrim');
  drawer.appendChild(el('div', 'dr-h', 'The wiki'));
  drawer.appendChild(acts);
  drawer.appendChild(el('div', 'dr-h', 'Folders'));
  drawer.appendChild($('s-left'));
  drawer.appendChild(el('div', 'dr-h', 'Layers'));
  drawer.appendChild($('s-right'));
  document.body.appendChild(drawer);
  function act(icon, label, fn) { const b = el('button', 'dr-act', '<span class="ic">' + IC(icon, 20) + '</span><span>' + label + '</span>'); b.type = 'button'; b.addEventListener('click', () => { set(false); fn(); }); acts.appendChild(b); return b; }
  const aNew = act('plus', 'New page', () => $('t-new') && $('t-new').click());
  const aPic = act('folder', 'Add a picture', () => pickPicture());
  const aMedia = act('book', 'Media', () => C.go({ kind: 'media', id: 'all' }));
  const aUndo = act('undo', 'Undo', () => $('t-undo') && $('t-undo').click());
  let open = false;
  function set(on) {
    open = !!on;
    document.body.classList.toggle('dr-open', open);
    scrim.hidden = !open;
    if (open) syncActs();
  }
  scrim.addEventListener('click', () => set(false));
  drawer.addEventListener('click', (e) => { if (e.target.closest('#s-left button, #s-left a, #s-right [data-go], #s-right a')) setTimeout(() => set(false), 0); });
  function syncActs() {
    const u = $('t-undo'), n = $('t-new');
    aUndo.hidden = !u || u.hidden; aUndo.disabled = !!(u && u.disabled);
    aNew.disabled = !!(n && n.disabled);
    aPic.disabled = !(C.view.kind === 'page' && C.currentPage()) || editing();
  }

  // ---------- search (top right) ----------
  const sbox = el('div', 'wsearch'); sbox.hidden = true;
  const shead = el('div', 'ws-head');
  const find = $('find'), list = $('find-list');
  const close = el('button', 'corner', IC('close', 20)); close.type = 'button'; close.setAttribute('aria-label', 'Close search');
  const fl = el('label', 'ws-field', '<span class="ic">' + IC('search', 18) + '</span>'); fl.appendChild(find);
  shead.append(fl, close);
  const hint = el('p', 'ws-hint', 'A name, a place, a kind. Pages appear as you type.');
  sbox.append(shead, hint, list);
  document.body.appendChild(sbox);
  find.placeholder = 'Search the wiki';
  function search(on) {
    sbox.hidden = !on; document.body.classList.toggle('searching', !!on);
    if (on) { find.value = ''; list.hidden = true; setTimeout(() => find.focus(), 30); }
    else find.blur();
  }
  close.addEventListener('click', () => search(false));
  find.addEventListener('input', () => { hint.hidden = !!find.value.trim(); });
  // a hit was picked: the page re-renders, so the search closes itself
  new MutationObserver(() => { if (!sbox.hidden && !find.value) search(false); }).observe(C.page, { childList: true });
  find.addEventListener('blur', () => { /* keep the overlay open; the list hides itself in wiki-ui */ });

  // ---------- corners ----------
  U.corner('tr', { icon: 'search', label: 'Search the wiki', fn: () => search(true) });
  U.onBack(() => {
    if (!sbox.hidden) { search(false); return true; }
    if (open) { set(false); return true; }
    if (editing()) { const c = C.page.querySelector('.ed-bar .bl-btn:not(.gold)'); if (c) { c.click(); return true; } }
    const before = C.view; C.goBack();
    return C.view !== before;
  });
  function corners() {
    const ed = editing();
    document.body.classList.toggle('w-editing', ed);
    if (ed) { U.corner('bl', null); U.corner('br', null); return; }
    U.corner('bl', { icon: 'menu', label: 'Folders, new page, pictures, layers', fn: () => set(!open) });
    const e = $('t-edit'), canEdit = e && !e.disabled;
    if (canEdit) U.corner('br', { icon: 'pen', label: 'Edit this page', gold: true, fn: () => $('t-edit').click() });
    else U.corner('br', { icon: 'plus', label: 'New page', gold: true, fn: () => $('t-new') && $('t-new').click() });
  }
  if (window.__wikiEdit) window.__wikiEdit.onTools(() => { corners(); syncActs(); });

  // ---------- tidy what the shared wiki draws ----------
  function tidy() {
    C.page.querySelectorAll('.crumbs a, .crumbs span:not(.sep)').forEach((x) => { const t = x.textContent.replace(/^\d\d\s+/, ''); if (t !== x.textContent) x.textContent = t; });
    C.page.querySelectorAll('.pic-empty').forEach((x) => { if (/^Pictures stay on Alaric/.test(x.textContent)) x.textContent = 'This picture is not on the phone yet. Tap the dot at the top to sync.'; });
    const p = C.view.kind === 'page' ? C.currentPage() : null;
    U.title('Wiki', p ? '' : '');
    corners();
  }
  new MutationObserver(tidy).observe(C.page, { childList: true, subtree: true });
  tidy();

  // ---------- add a picture from the phone ----------
  const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true; document.body.appendChild(input);
  function pickPicture() { const p = C.currentPage(); if (!p || C.view.kind !== 'page') { C.status('Open a page first.'); return; } input.value = ''; input.click(); }
  input.addEventListener('change', () => { const f = input.files && input.files[0]; if (f) shrink(f).then((x) => askPicture(x)).catch((e) => C.status(e.message || String(e), true)); });
  // Phone photos are large: keep at most 1600 px on the long side, as JPEG (a GIF stays as it is).
  async function shrink(file) {
    const ext0 = (file.name.split('.').pop() || '').toLowerCase();
    if (!/^image\//.test(file.type)) throw new Error('That is not a picture.');
    if (ext0 === 'gif') { if (file.size > 8 * 1024 * 1024) throw new Error('That picture is bigger than 8 MB.'); return { ext: 'gif', b64: await b64(file), url: URL.createObjectURL(file) }; }
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened here.')); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
    const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.86));
    URL.revokeObjectURL(url);
    return { ext: 'jpg', b64: await b64(blob), url: URL.createObjectURL(blob) };
  }
  function b64(blob) { return blob.arrayBuffer().then((buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }); }
  function askPicture(pic) {
    const p = C.currentPage(); if (!p) return;
    const body = el('div', 'pic-sheet');
    body.appendChild(el('div', 'ps-img', '<img alt="" src="' + pic.url + '">'));
    const seg = el('div', 'ps-seg'); let kind = 'canon';
    const kinds = [['canon', 'Canon', 'Shows on the page'], ['inspiration', 'Inspiration', 'Behind the scenes'], ['sketch', 'Sketch', 'Behind the scenes and the Sketchbook']];
    const note = el('p', 'ps-note', kinds[0][2]);
    for (const [k, l, n] of kinds) {
      const b = el('button', k === kind ? 'on' : '', l); b.type = 'button';
      b.addEventListener('click', () => { kind = k; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); note.textContent = n; });
      seg.appendChild(b);
    }
    const cap = el('input', 'ps-cap'); cap.type = 'text'; cap.placeholder = 'Caption (optional)'; cap.maxLength = 80;
    const go = el('button', 'bl-btn gold wide', 'Save picture on ' + Ph.esc(p.title)); go.type = 'button';
    body.append(seg, note, cap, go);
    const sh = U.sheet({ title: 'A picture for ' + p.title, body });
    go.addEventListener('click', async () => {
      const caption = cap.value.trim();
      const WE = window.__wikiEdit;
      const name = WE.fileName(p.name, caption || 'picture', pic.ext);
      const text = M.addPicture(p.raw, kind === 'canon' ? 'what' : 'behind', kind, name, caption);
      go.disabled = true; go.textContent = 'Saving';
      try {
        const r = await WE.ask('wiki_save', { rel: 'Evrynthing/' + p.rel, text, expect: p.raw, label: 'Picture on ' + p.title, picture: { rel: 'Evrynthing/Media/' + name, name: p.name, caption, ext: pic.ext, b64: pic.b64 } }, 60000);
        if (!r.ok) throw new Error(r.error || 'It was not saved.');
        sh.close(); URL.revokeObjectURL(pic.url);
        C.status(kind === 'canon' ? 'Saved on the page and in Media. It goes to GitHub at the next sync.' : 'Saved Behind the scenes and in Media.');
        await C.load(true);
      } catch (err) { C.status(err.message, true); go.disabled = false; go.textContent = 'Save picture'; }
    });
  }
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.id !== 'find' && !t.closest('.sh-card')))) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
  window.__wikiPhone = { set, open: () => open, search };
})();
