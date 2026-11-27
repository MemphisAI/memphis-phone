'use strict';
(function () {
  const API = window.homeAPI, HM = window.HomeModel;
  const PH = window.Phone && window.Phone.ui ? window.Phone : null;
  const $ = (id) => document.getElementById(id);
  const IC = (n, s) => (window.BladesIcon ? window.BladesIcon(n, s || 18) : '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function button(cls, html, fn) { const b = el('button', cls, html); b.type = 'button'; b.addEventListener('click', fn); return b; }
  const view = $('view'), crumb = $('crumb'), bBack = $('b-back'), bAdd = $('b-add');
  let toastT = null;
  function toast(t, ms) {
    if (PH) return PH.toast(t, ms);
    const x = $('toast'); if (!x) return; x.textContent = t; x.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove('on'), ms || 3200);
  }
  const lower = (s) => String(s || '').toLowerCase();
  const find = (name) => items.find((x) => lower(x.name) === lower(name)) || null;
  let items = [], screen = { k: 'list' }, trail = [], urls = new Map(), seq = 0;
  let mode = 'place'; try { if (localStorage.getItem('home.view') === 'all') mode = 'all'; } catch (e) {   }
  async function photoUrl(file) {
    if (!file) return null;
    if (urls.has(file)) return urls.get(file);
    const u = await API.photo(file).catch(() => null);
    if (u) urls.set(file, u);
    return u;
  }
  function fillPhoto(box, file) {
    if (!file) { box.classList.add('none'); box.innerHTML = IC('tool-home', 30); return; }
    photoUrl(file).then((u) => {
      if (!u) { box.classList.add('none'); box.innerHTML = IC('tool-home', 30); return; }
      const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = u;
      [...box.children].forEach((c) => { if (!c.classList.contains('holds')) c.remove(); });
      box.prepend(img);
    });
  }
  function chrome(title, sub, back, add) {
    if (PH) {
      PH.ui.title(title, sub || '');
      PH.ui.corner('br', add ? { icon: 'plus', label: add.label, gold: true, fn: () => go({ k: 'add', where: add.where || null }) } : null);
      return;
    }
    crumb.innerHTML = esc(title) + (sub ? '<span class="cnt">' + esc(sub) + '</span>' : '');
    bBack.hidden = !back;
    bAdd.hidden = !add;
    if (add) { bAdd.innerHTML = IC('plus', 14) + '<span>' + esc(add.label) + '</span>'; bAdd.onclick = () => go({ k: 'add', where: add.where || null }); }
  }
  if (bBack) { bBack.textContent = 'Back'; bBack.addEventListener('click', () => back()); }
  if (PH) PH.ui.onBack(() => { if (screen.k !== 'list') { back(); return true; } return false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !PH) { if (chooserOpen()) closeChooser(); else if (screen.k !== 'list') back(); } });
  async function go(s, opts) {
    await leave(s);
    if (!(opts && opts.replace) && !(screen.k === 'list' && s.k === 'list')) trail.push(screen);
    if (s.k === 'list') trail = [];
    screen = s; draw(); top();
  }
  async function back() {
    let s = trail.pop() || { k: 'list' };
    while (s.k === 'item' && !find(s.name) && trail.length) s = trail.pop();
    await leave(s);
    screen = s.k === 'item' && !find(s.name) ? { k: 'list' } : s;
    draw(); top();
  }
  async function leave(next) {
    if (screen.k === 'add' && next.k !== 'add') kept = dirtyAdd() ? { small: draft.small, original: draft.original, url: draft.url, name: draft.nameEl.value, words: draft.wordsEl.value, where: draft.where, what: draft.what.slice() } : null;
    if (screen.k === 'item' && editing()) await saveWords(true);
    if (screen.k === 'books') { camStop(); booksUi = null; }
    closeChooser();
  }
  function top() { try { view.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {   } }
  function draw() {
    if (screen.k === 'add') return drawAdd();
    if (screen.k === 'books') return drawBooks();
    if (screen.k === 'item') { const it = find(screen.name); if (it) return drawItem(it); screen = { k: 'list' }; }
    drawList();
  }
  async function load(redraw) {
    const my = ++seq;
    const r = await API.list().catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (my !== seq) return;
    if (!r || !r.ok) { view.innerHTML = ''; view.appendChild(el('div', 'empty', '<h1>The Home could not open</h1><p>' + esc(r && r.error || 'Unknown') + '</p>')); return; }
    items = r.items || [];
    if (screen.k === 'books') return;
    if (redraw !== true && (screen.k === 'add' || (screen.k === 'item' && editing()) || chooserOpen())) return;
    draw();
  }
  function card(it, opts) {
    const c = button('thing', '', () => go({ k: 'item', name: it.name }));
    const ph = el('span', 'ph'); fillPhoto(ph, it.photo);
    const n = HM.countInside(items, it.name);
    if (n) ph.appendChild(el('span', 'holds', n + ' inside'));
    const line = opts && opts.where && it.where ? 'In ' + it.where : HM.firstLine(it.words, 70);
    const tx = el('span', 'tx', '<span class="nm">' + esc(it.name) + '</span>' + (line ? '<span class="ln">' + esc(line) + '</span>' : ''));
    c.append(ph, tx);
    return c;
  }
  function grid(list, opts) { const g = el('div', 'things'); for (const it of list) g.appendChild(card(it, opts)); return g; }
  function drawList() {
    chrome('Home', items.length ? items.length + (items.length === 1 ? ' thing' : ' things') : '', false, { label: 'Add a thing' });
    view.innerHTML = '';
    if (!items.length) {
      const e = el('div', 'empty');
      e.innerHTML = '<div class="mark">' + IC('tool-home', 34) + '</div><h1>Nothing in the Home yet</h1><p>Take a photo of something you own, give it a name and a few words. It is kept as a note in the Home folder of your vault.</p>';
      e.appendChild(button('bl-btn gold lg', IC('plus', 16) + '<span>Add your first thing</span>', () => go({ k: 'add' })));
      view.appendChild(e);
      return;
    }
    const wrap = el('div', 'list');
    const seg = el('div', 'seg'); seg.setAttribute('role', 'tablist');
    for (const [k, label] of [['place', 'By place'], ['all', 'Everything']]) {
      const b = button('sg' + (mode === k ? ' on' : ''), esc(label), () => { mode = k; try { localStorage.setItem('home.view', k); } catch (e) {   } drawList(); });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', mode === k ? 'true' : 'false');
      seg.appendChild(b);
    }
    wrap.appendChild(seg);
    if (mode === 'all') wrap.appendChild(grid(items, { where: true }));
    else {
      const topl = HM.topLevel(items);
      const places = topl.filter((it) => HM.countInside(items, it.name)), loose = topl.filter((it) => !HM.countInside(items, it.name));
      if (places.length) { wrap.appendChild(el('h2', 'sec', 'Places')); wrap.appendChild(grid(places)); }
      if (loose.length) { wrap.appendChild(el('h2', 'sec', places.length ? 'In no place yet' : 'Your things')); wrap.appendChild(grid(loose)); }
      if (!places.length) wrap.appendChild(el('p', 'hint', 'Open a thing and choose Where it is to put it in a place: the wardrobe, a shelf, the bedroom. Any thing can hold other things.'));
    }
    view.appendChild(wrap);
  }
  let chooser = null;
  const chooserOpen = () => !!(chooser && chooser.isConnected);
  function closeChooser() { if (chooser) { chooser.remove(); chooser = null; } }
  function choose(o) {
    closeChooser();
    const box = el('div', 'chooser'), panel = el('div', 'ch-panel');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', o.title);
    const head = el('div', 'ch-head', '<span class="ch-t">' + esc(o.title) + '</span>');
    head.appendChild(button('bl-btn ghost sm', 'Cancel', closeChooser));
    const q = el('input'); Object.assign(q, { type: 'search', placeholder: o.allowNew ? 'Find, or type a new place' : 'Find', autocomplete: 'off' }); q.className = 'ch-q';
    const ul = el('div', 'ch-list');
    function row(label, sub, fn, cls) { const b = button('ch-row' + (cls ? ' ' + cls : ''), '<span class="nm">' + esc(label) + '</span>' + (sub ? '<span class="sb">' + esc(sub) + '</span>' : ''), fn); ul.appendChild(b); }
    function fill() {
      ul.innerHTML = '';
      const t = q.value.trim(), tl = lower(t);
      if (o.none && !t) row(o.none, '', () => { closeChooser(); o.done(null); }, 'none');
      const hits = o.list.filter((n) => !tl || lower(n).includes(tl));
      for (const n of hits.slice(0, 80)) {
        const it = find(n), path = HM.pathOf(items, n).slice().reverse().join(' › ');
        const on = (o.current || []).some((c) => lower(c) === lower(n));
        row(n, (on ? 'Chosen' : '') + (on && path ? ' · ' : '') + (path || (it && HM.countInside(items, n) ? HM.countInside(items, n) + ' inside' : '')), () => { closeChooser(); o.done([n], false); }, on ? 'on' : '');
      }
      const exact = items.some((x) => lower(x.name) === tl);
      if (o.allowNew && t && !exact && HM.cleanName(t)) row('New place: ' + HM.cleanName(t), 'Added to the Home as a thing that holds things', () => { closeChooser(); o.done([HM.cleanName(t)], true); }, 'new');
      if (!ul.children.length) ul.appendChild(el('p', 'ch-empty', o.allowNew ? 'Type a name to make a new place.' : 'Nothing to choose yet.'));
    }
    q.addEventListener('input', fill);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const f = ul.querySelector('.ch-row:not(.none)'); if (f) f.click(); } });
    box.addEventListener('click', (e) => { if (e.target === box) closeChooser(); });
    panel.append(head, q, ul); box.appendChild(panel);
    document.body.appendChild(box); chooser = box;
    fill(); setTimeout(() => { if (!API.phone) q.focus(); }, 30);
  }
  const placesFor = (name) => items.map((x) => x.name).filter((n) => !name || HM.canPlace(items, name, n)).sort((a, b) => a.localeCompare(b));
  async function ensurePlace(name, isNew) {
    if (!isNew) return name;
    const r = await API.add({ name }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (!r || !r.ok) { toast((r && r.error) || 'The place could not be made.', 5000); return null; }
    await load(true);
    return r.name;
  }
  let draft = null, kept = null;
  const dirtyAdd = () => !!(draft && (draft.small || (draft.nameEl && draft.nameEl.value.trim()) || (draft.wordsEl && draft.wordsEl.value.trim())));
  function drawAdd() {
    const into = screen.where && find(screen.where) ? find(screen.where).name : null;
    chrome(into ? 'Add to ' + into : 'Add a thing', '', true, null);
    draft = { small: null, original: null, url: null, where: into, what: [] };
    if (kept && !into) { draft.where = kept.where || null; }
    view.innerHTML = '';
    const f = el('form', 'add'); f.noValidate = true;
    const pick = el('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true;
    const shot = button('shot', '', () => pick.click());
    const showEmpty = () => { shot.classList.remove('has'); shot.innerHTML = '<span class="si">' + IC('plus', 26) + '</span><span class="sl">' + (API.phone ? 'Take a photo or choose one' : 'Choose a photo, or drop one here') + '</span>'; };
    showEmpty();
    const putPhoto = (url) => { shot.classList.add('has'); shot.innerHTML = ''; const img = new Image(); img.alt = ''; img.src = url; shot.appendChild(img); shot.appendChild(el('span', 'again', 'Change photo')); };
    pick.addEventListener('change', () => { const file = pick.files && pick.files[0]; pick.value = ''; if (file) takePhoto(file); });
    async function takePhoto(file) {
      shot.classList.add('busy');
      try {
        const small = await shrink(file);
        draft.small = small.b64;
        draft.original = API.keepsOriginal ? await originalOf(file) : null;
        draft.url = small.url; putPhoto(small.url);
        if (!name.value.trim()) name.focus();
      } catch (e) { toast(e && e.message ? e.message : 'That photo could not be read.', 5000); }
      shot.classList.remove('busy');
    }
    if (!API.phone) {
      shot.addEventListener('dragover', (e) => { e.preventDefault(); shot.classList.add('over'); });
      shot.addEventListener('dragleave', () => shot.classList.remove('over'));
      shot.addEventListener('drop', (e) => { e.preventDefault(); shot.classList.remove('over'); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) takePhoto(file); });
    }
    const nl = el('label', 'field', '<span>Name</span>'), name = el('input');
    Object.assign(name, { type: 'text', maxLength: HM.MAX_NAME, placeholder: 'The little garbage can', autocomplete: 'off', enterKeyHint: 'next' });
    name.setAttribute('autocapitalize', 'sentences');
    nl.appendChild(name);
    const pw = el('div', 'field', '<span>Where</span>'), whereRow = el('div', 'chips');
    const drawWhere = () => {
      whereRow.innerHTML = '';
      if (draft.where) whereRow.appendChild(chip(draft.where, null, () => { draft.where = null; drawWhere(); }));
      whereRow.appendChild(button('bl-btn coal sm', IC(draft.where ? 'split' : 'plus', 13) + '<span>' + (draft.where ? 'Somewhere else' : 'Choose a place') + '</span>', () => choose({
        title: 'Where is it?', list: placesFor(null), current: draft.where ? [draft.where] : [], none: 'In no place', allowNew: true,
        done: async (n, isNew) => { const p = n ? await ensurePlace(n[0], isNew) : null; if (n && !p) return; draft.where = p; drawWhere(); },
      })));
    };
    pw.appendChild(whereRow); drawWhere();
    const kw = el('div', 'field', '<span>What it is</span>'), kinds = kindEditor(draft.what, (list) => { draft.what = list; });
    kw.appendChild(kinds);
    const wl = el('label', 'field', '<span>A few words</span>'), words = el('textarea');
    Object.assign(words, { rows: 4, maxLength: HM.MAX_WORDS, placeholder: 'What it is, where it came from, anything worth remembering.' });
    wl.appendChild(words);
    draft.nameEl = name; draft.wordsEl = words;
    if (kept) {
      name.value = kept.name || ''; words.value = kept.words || '';
      if (kept.small) { draft.small = kept.small; draft.original = kept.original; draft.url = kept.url; putPhoto(kept.url); }
      if (kept.what && kept.what.length) { draft.what = kept.what; kinds.replaceWith(kindEditor(draft.what, (list) => { draft.what = list; })); }
      if (!into) drawWhere();
      kept = null;
    }
    const save = button('bl-btn gold lg wide', '<span>Save</span>', async () => {
      const n = HM.cleanName(name.value);
      if (!n) { toast('Give it a name.'); name.focus(); return; }
      save.disabled = true;
      const r = await API.add({ name: n, words: words.value, small: draft.small, original: draft.original, where: draft.where, what: draft.what }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
      save.disabled = false;
      if (!r || !r.ok) { toast((r && r.error) || 'It could not be saved.', 5000); return; }
      const where = draft.where;
      draft = null; kept = null;
      toast(r.name === n ? n + ' is in ' + (where || 'the Home') + '.' : 'Saved as ' + r.name + ' (one by that name was there already).', 4000);
      await load(true);
      const prev = trail.pop();
      screen = prev && prev.k === 'item' && find(prev.name) ? prev : { k: 'list' };
      draw(); top();
    });
    f.addEventListener('submit', (e) => e.preventDefault());
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); words.focus(); } });
    const scan = button('bl-btn coal wide booksbtn', IC('book', 16) + '<span>Books: scan their barcodes instead</span>', () => go({ k: 'books', where: draft.where }));
    f.append(scan, pick, shot, nl, pw, kw, wl, save);
    view.appendChild(f);
  }
  function chip(label, open, remove) {
    const c = el('span', 'chip' + (open ? ' link' : ''));
    const t = open ? button('ct', esc(label), open) : el('span', 'ct', esc(label));
    c.appendChild(t);
    if (remove) { const x = button('cx', IC('close', 12), remove); x.setAttribute('aria-label', 'Take away ' + label); c.appendChild(x); }
    return c;
  }
  let kindListN = 0;
  function kindEditor(list, changed) {
    const box = el('div', 'chips kinds');
    const id = 'home-kinds-' + (++kindListN);
    const inp = el('input'); Object.assign(inp, { type: 'text', placeholder: 'Shirt, Book, Lamp...', autocomplete: 'off', maxLength: 40, enterKeyHint: 'done' }); inp.className = 'kin';
    inp.setAttribute('list', id); inp.setAttribute('autocapitalize', 'words');
    const dl = el('datalist'); dl.id = id;
    function drawK() {
      box.querySelectorAll('.chip').forEach((c) => c.remove());
      list.forEach((k, i) => box.insertBefore(chip(k, null, () => { list.splice(i, 1); changed(list.slice()); drawK(); }), inp));
      dl.innerHTML = HM.kinds(items).filter((k) => !list.some((x) => lower(x) === lower(k))).map((k) => '<option value="' + esc(k) + '">').join('');
    }
    function addK() {
      for (const part of inp.value.split(',')) { const k = HM.cleanKind(part); if (k && !list.some((x) => lower(x) === lower(k))) list.push(k); }
      if (!inp.value.trim()) return false;
      inp.value = ''; changed(list.slice()); drawK(); return true;
    }
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addK(); } });
    inp.addEventListener('change', () => { if (HM.kinds(items).some((k) => lower(k) === lower(inp.value.trim()))) addK(); });
    inp.addEventListener('blur', () => addK());
    box.append(inp, dl); drawK();
    return box;
  }
  async function shrink(file) {
    if (file.size > 60 * 1024 * 1024) throw new Error('That photo is bigger than 60 MB.');
    const src = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = src;
      try { await img.decode(); } catch (e) { throw new Error(/heic|heif/i.test(file.type + file.name) ? 'HEIC photos cannot be read here: save it as JPEG first.' : 'That file is not a photo this can read.'); }
      const w0 = img.naturalWidth, h0 = img.naturalHeight; if (!w0 || !h0) throw new Error('That photo is empty.');
      const k = Math.min(1, HM.PHOTO_MAX / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      const url = c.toDataURL('image/jpeg', HM.PHOTO_Q);
      return { url, b64: url.slice(url.indexOf(',') + 1) };
    } finally { URL.revokeObjectURL(src); }
  }
  function originalOf(file) {
    const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(file.name || '') || [])[1] || (file.type.split('/')[1] || 'jpg');
    return new Promise((res) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res({ b64: s.slice(s.indexOf(',') + 1), ext: ext.toLowerCase() }); }; r.onerror = () => res(null); r.readAsDataURL(file); });
  }
  const HB = window.HomeBooks;
  let cam = null;
  function camStop() {
    if (!cam) return;
    clearTimeout(cam.timer);
    try { cam.stream.getTracks().forEach((t) => t.stop()); } catch (e) {   }
    try { cam.video.srcObject = null; } catch (e) {   }
    cam = null;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') camStop(); else if (screen.k === 'books' && booksUi && booksUi.wantCam) camStart(); });
  let booksUi = null;
  async function camStart() {
    const ui = booksUi; if (!ui || cam) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { ui.status('No camera here: type the ISBN, or take a photo of the barcode.'); ui.box.classList.add('off'); return; }
    ui.status('Starting the camera...');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
    catch (e) { ui.box.classList.add('off'); ui.status(e && e.name === 'NotAllowedError' ? 'The camera is not allowed. Allow it for Memphis in Settings, or type the ISBN.' : 'No camera found: type the ISBN, or take a photo of the barcode.'); return; }
    if (booksUi !== ui || screen.k !== 'books') { stream.getTracks().forEach((t) => t.stop()); return; }
    ui.box.classList.remove('off');
    const video = ui.video; video.srcObject = stream; video.muted = true; video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
    try { await video.play(); } catch (e) {   }
    cam = { stream, video, canvas: document.createElement('canvas'), timer: null };
    ui.status('Hold a barcode across the gold line.');
    const tick = () => {
      if (!cam || cam.video !== video) return;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        const k = Math.min(1, 1280 / vw), cw = Math.round(vw * k), bandH = Math.round(vh * 0.36), ch = Math.round(bandH * k);
        const c = cam.canvas; if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(video, 0, Math.round((vh - bandH) / 2), vw, bandH, 0, 0, cw, ch);
        const code = HB.decodeImage(g.getImageData(0, 0, cw, ch), { need: 2, rows: 14 });
        if (code) seen(code);
      }
      cam.timer = setTimeout(tick, 140);
    };
    tick();
  }
  let lastCode = null, lastAt = 0;
  const rest = new Map();
  function seen(code) {
    const isbn = HB.isbnFrom(code); if (!isbn) return;
    const now = Date.now();
    if ((rest.get(isbn) || 0) > now) return;
    if (lastCode !== isbn || now - lastAt > 1500) { lastCode = isbn; lastAt = now; return; }
    rest.set(isbn, now + 5000); lastCode = null;
    if (PH) PH.ui.haptic();
    handleBook(isbn);
  }
  function drawBooks() {
    const into = screen.where && find(screen.where) ? find(screen.where).name : null;
    screen.where = into;
    chrome('Scan books', into ? 'Into ' + into : '', true, null);
    view.innerHTML = '';
    const wrap = el('div', 'books');
    const fw = el('div', 'field', '<span>Where they go</span>'), wr = el('div', 'chips');
    const drawWhere = () => {
      wr.innerHTML = '';
      if (screen.where) wr.appendChild(chip(screen.where, null, () => { screen.where = null; drawWhere(); chrome('Scan books', '', true, null); }));
      wr.appendChild(button('bl-btn coal sm', IC(screen.where ? 'split' : 'plus', 13) + '<span>' + (screen.where ? 'Somewhere else' : 'Choose a place') + '</span>', () => choose({
        title: 'Where do these books go?', list: placesFor(null), current: screen.where ? [screen.where] : [], none: 'In no place', allowNew: true,
        done: async (n, isNew) => { const p = n ? await ensurePlace(n[0], isNew) : null; if (n && !p) return; screen.where = p; drawWhere(); chrome('Scan books', p ? 'Into ' + p : '', true, null); },
      })));
    };
    drawWhere(); fw.appendChild(wr);
    const box = el('div', 'cam off');
    const video = el('video'); video.setAttribute('playsinline', ''); video.muted = true; video.autoplay = true;
    box.append(video, el('div', 'aim'));
    const status = el('p', 'camline', '');
    const row = el('div', 'isbnrow');
    const inp = el('input'); Object.assign(inp, { type: 'text', inputMode: 'numeric', placeholder: 'ISBN, e.g. 978-82-03-19353-8', autocomplete: 'off', enterKeyHint: 'go' }); inp.className = 'isbn';
    const look = () => { const isbn = HB.isbnFrom(inp.value); if (!isbn) { toast('That is not a book\'s ISBN: 13 digits starting 978 or 979, or 10 digits.'); return; } inp.value = ''; handleBook(isbn); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); look(); } });
    const pick = el('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true;
    pick.addEventListener('change', async () => { const file = pick.files && pick.files[0]; pick.value = ''; if (file) photoBarcode(file); });
    row.append(inp, button('bl-btn coal', '<span>Look up</span>', look), button('bl-btn coal', IC('plus', 14) + '<span>Photo of a barcode</span>', () => pick.click()), pick);
    const list = el('div', 'found');
    wrap.append(fw, box, status, row, list);
    view.appendChild(wrap);
    booksUi = { box, video, list, wantCam: true, status: (t) => { status.textContent = t; }, rows: new Map() };
    camStart();
  }
  async function photoBarcode(file) {
    const src = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = src; await img.decode();
      let code = null;
      for (const wid of [1600, 1100, 700]) {
        const k = Math.min(1, wid / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
        code = HB.decodeImage(g.getImageData(0, 0, w, h), { need: 1, rows: 60 });
        if (code) break;
      }
      const isbn = code && HB.isbnFrom(code);
      if (isbn) handleBook(isbn); else toast('No book barcode found in that photo. Hold it closer and level, or type the ISBN.', 5000);
    } catch (e) { toast('That photo could not be read.'); }
    finally { URL.revokeObjectURL(src); }
  }
  async function handleBook(isbn) {
    const ui = booksUi; if (!ui) return;
    let r = ui.rows.get(isbn);
    if (r) { ui.list.prepend(r.el); r.el.classList.remove('flash'); void r.el.offsetWidth; r.el.classList.add('flash'); if (!r.retry) return; }
    if (!r) { r = { el: el('div', 'brow') }; ui.rows.set(isbn, r); ui.list.prepend(r.el); }
    r.retry = false;
    const show = (cls, cover, title, sub, extra) => {
      r.el.className = 'brow ' + cls;
      r.el.innerHTML = '';
      const ph = el('span', 'bc'); if (cover) { const im = new Image(); im.alt = ''; im.src = cover; ph.appendChild(im); } else ph.innerHTML = IC('book', 20);
      const tx = el('span', 'bt', '<span class="nm">' + esc(title) + '</span>' + (sub ? '<span class="sb">' + esc(sub) + '</span>' : ''));
      r.el.append(ph, tx); if (extra) r.el.appendChild(extra);
    };
    const there = items.find((x) => x.isbn === isbn);
    if (there) { show('have', null, there.name, 'Already in the Home' + (there.where ? ', in ' + there.where : ''), button('bl-btn ghost sm', 'Open', () => go({ k: 'item', name: there.name }))); return; }
    show('wait', null, 'Looking up ' + isbn, 'Asking the book databases...');
    const res = await API.book(isbn).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (booksUi !== ui) return;
    if (!res || !res.ok) { r.retry = true; show('bad', null, isbn, (res && res.error) || 'The book databases could not be reached.', button('bl-btn coal sm', 'Try again', () => handleBook(isbn))); return; }
    const where = screen.where || null;
    if (!res.book) {
      const form = el('span', 'bname');
      const t = el('input'); Object.assign(t, { type: 'text', placeholder: 'Type the title', maxLength: HM.MAX_NAME, autocomplete: 'off', enterKeyHint: 'done' });
      t.setAttribute('autocapitalize', 'sentences');
      const addIt = async () => {
        const n = HM.cleanName(t.value); if (!n) { t.focus(); return; }
        const a = await API.add({ name: n, what: ['Book'], where, book: { isbn } }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
        if (!a || !a.ok) { toast((a && a.error) || 'It could not be saved.', 5000); return; }
        await itemsNow();
        show('done', null, a.name, 'Added' + (where ? ' to ' + where : '') + ' · typed by you', button('bl-btn ghost sm', 'Open', () => go({ k: 'item', name: a.name })));
      };
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });
      form.append(t, button('bl-btn gold sm', 'Add', addIt));
      show('unknown', null, 'Not in the book databases', isbn + ': type its title', form);
      if (!PH) t.focus();
      return;
    }
    const b = res.book, cover = res.cover ? 'data:image/jpeg;base64,' + res.cover : null;
    const by = b.authors && b.authors.length ? b.authors.join(', ') : '';
    show('wait', cover, b.title, (by ? by + ' · ' : '') + 'adding...');
    const a = await API.add({ name: b.title, words: HB.bookWords(b), small: res.cover || null, what: ['Book'], where, book: { isbn, authors: b.authors, year: b.year } }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (booksUi !== ui) return;
    if (!a || !a.ok) {
      if (a && a.exists) { show('have', cover, a.exists, 'Already in the Home', button('bl-btn ghost sm', 'Open', () => go({ k: 'item', name: a.exists }))); return; }
      r.retry = true; show('bad', cover, b.title, (a && a.error) || 'It could not be saved.', button('bl-btn coal sm', 'Try again', () => handleBook(isbn))); return;
    }
    await itemsNow();
    show('done', cover, a.name, [by, b.year].filter(Boolean).join(', ') + (where ? ' · added to ' + where : ' · added'), button('bl-btn ghost sm', 'Open', () => go({ k: 'item', name: a.name })));
  }
  async function itemsNow() { const r = await API.list().catch(() => null); if (r && r.ok) items = r.items || []; }
  let edit = null;
  const editing = () => !!(edit && edit.ta && edit.ta.isConnected && edit.ta.value !== edit.base);
  async function setParents(it, p, msg) {
    if (editing()) await saveWords(true);
    const r = await API.parents(it.name, p).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (!r || !r.ok) { toast((r && r.error) || 'It could not be saved.', 5000); return false; }
    await load(true);
    if (msg) toast(msg);
    return true;
  }
  function drawItem(it) {
    const path = HM.pathOf(items, it.name).slice().reverse();
    chrome(it.name, path.length ? path.join(' › ') : it.added ? 'Added ' + niceDay(it.added) : '', true, { label: 'Add a thing here', where: it.name });
    view.innerHTML = '';
    const box = el('article', 'one');
    const ph = el('div', 'big'); fillPhoto(ph, it.photo);
    const side = el('div', 'side');
    if (path.length) {
      const pth = el('nav', 'path'); pth.setAttribute('aria-label', 'Where it is');
      path.forEach((p, i) => { if (i) pth.appendChild(el('span', 'sep', '›')); pth.appendChild(find(p) ? button('pl', esc(p), () => go({ k: 'item', name: find(p).name })) : el('span', 'pl', esc(p))); });
      side.appendChild(pth);
    }
    side.appendChild(el('h1', '', esc(it.name)));
    const fw = el('div', 'field', '<span>Where</span>'), wr = el('div', 'chips');
    if (it.where) wr.appendChild(chip(it.where, find(it.where) ? () => go({ k: 'item', name: find(it.where).name }) : null, () => setParents(it, { where: null }, it.name + ' is in no place now.')));
    wr.appendChild(button('bl-btn coal sm', IC(it.where ? 'split' : 'plus', 13) + '<span>' + (it.where ? 'Move' : 'Choose a place') + '</span>', () => choose({
      title: 'Where is ' + it.name + '?', list: placesFor(it.name), current: it.where ? [it.where] : [], none: 'In no place', allowNew: true,
      done: async (n, isNew) => {
        const p = n ? await ensurePlace(n[0], isNew) : null; if (n && !p) return;
        await setParents(it, { where: p }, p ? it.name + ' is in ' + p + ' now.' : it.name + ' is in no place now.');
      },
    })));
    fw.appendChild(wr);
    const fk = el('div', 'field', '<span>What it is</span>');
    fk.appendChild(kindEditor((it.what || []).slice(), (list) => setParents(it, { what: list })));
    const fwi = el('div', 'field', '<span>Goes with</span>'), wi = el('div', 'chips');
    for (const n of HM.together(items, it.name)) {
      const other = find(n);
      wi.appendChild(chip(n, other ? () => go({ k: 'item', name: other.name }) : null, async () => {
        if ((it.with || []).some((x) => lower(x) === lower(n))) await setParents(it, { with: it.with.filter((x) => lower(x) !== lower(n)) });
        if (other && (other.with || []).some((x) => lower(x) === lower(it.name))) {
          const r = await API.parents(other.name, { with: other.with.filter((x) => lower(x) !== lower(it.name)) }).catch(() => null);
          if (!r || !r.ok) toast((r && r.error) || 'It could not be saved.', 5000); else await load(true);
        }
      }));
    }
    const togetherNow = HM.together(items, it.name);
    wi.appendChild(button('bl-btn coal sm', IC('plus', 13) + '<span>Add</span>', () => choose({
      title: 'What does ' + it.name + ' go with?', list: items.map((x) => x.name).filter((n) => lower(n) !== lower(it.name) && !togetherNow.some((t) => lower(t) === lower(n))).sort((a, b) => a.localeCompare(b)), current: [], allowNew: false,
      done: (n) => { if (n) setParents(it, { with: (it.with || []).concat(n) }); },
    })));
    fwi.appendChild(wi);
    const wl = el('label', 'field', '<span>A few words</span>'), ta = el('textarea');
    Object.assign(ta, { rows: 5, maxLength: HM.MAX_WORDS, value: it.words || '', placeholder: 'Nothing written yet.' });
    wl.appendChild(ta);
    edit = { ta, base: it.words || '', it, btn: null };
    const row = el('div', 'row');
    const save = button('bl-btn gold', '<span>Save words</span>', () => saveWords(false));
    save.hidden = true; edit.btn = save;
    ta.addEventListener('input', () => { save.hidden = ta.value === edit.base; save.disabled = false; });
    ta.addEventListener('blur', () => saveWords(true));
    row.appendChild(save);
    if (API.openNote) row.appendChild(button('bl-btn coal', IC('document', 14) + '<span>Open in Obsidian</span>', () => API.openNote(it.name)));
    side.append(fw, fk, fwi, wl, row);
    box.append(ph, side);
    view.appendChild(box);
    const ins = HM.inside(items, it.name);
    const sec = el('section', 'inhere');
    sec.appendChild(el('h2', 'sec', ins.length ? 'In ' + esc(it.name) + ' <span class="cnt">' + ins.length + '</span>' : 'Nothing in ' + esc(it.name) + ' yet'));
    if (ins.length) sec.appendChild(grid(ins));
    else sec.appendChild(el('p', 'hint', 'Add a thing here, or open another thing and choose ' + it.name + ' as its place.'));
    view.appendChild(sec);
  }
  async function saveWords(quiet) {
    const e = edit; if (!e || !e.ta || e.ta.value === e.base) return;
    if (e.btn) e.btn.disabled = true;
    const r = await API.save(e.it.name, e.ta.value, e.base).catch((x) => ({ ok: false, error: String(x && x.message || x) }));
    if (!r || !r.ok) { if (e.btn) e.btn.disabled = false; toast((r && r.error) || 'It could not be saved.', 5000); return; }
    e.it.words = r.words; e.base = r.words;
    if (e === edit && e.ta.isConnected) { e.ta.value = r.words; if (e.btn) e.btn.hidden = true; }
    if (!quiet) toast('Saved.');
  }
  function niceDay(d) { const t = Date.parse(d + 'T12:00:00'); return isNaN(t) ? d : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  if (API.onChanged) API.onChanged(() => load());
  window.addEventListener('pagehide', () => { if (editing()) saveWords(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && editing()) saveWords(true); });
  chrome('Home', '', false, { label: 'Add a thing' });
  load();
  window.HomeRoom = { reload: load, go, back, _screen: () => screen, _trail: () => trail.slice() };
})();
