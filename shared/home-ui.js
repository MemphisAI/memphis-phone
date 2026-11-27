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
  let items = [], screen = { k: 'list' }, urls = new Map(), seq = 0;
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
      const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = u; box.innerHTML = ''; box.appendChild(img);
    });
  }
  function chrome(title, sub, back, add) {
    if (PH) {
      PH.ui.title(title, sub || '');
      PH.ui.corner('br', add ? { icon: 'plus', label: 'Add a thing', gold: true, fn: () => go({ k: 'add' }) } : null);
      return;
    }
    crumb.innerHTML = esc(title) + (sub ? '<span class="cnt">' + esc(sub) + '</span>' : '');
    bBack.hidden = !back; bAdd.hidden = !add;
  }
  if (bBack) bBack.addEventListener('click', () => go({ k: 'list' }));
  if (bAdd) { bAdd.innerHTML = IC('plus', 14) + '<span>Add a thing</span>'; bAdd.addEventListener('click', () => go({ k: 'add' })); }
  if (PH) PH.ui.onBack(() => { if (screen.k !== 'list') { go({ k: 'list' }); return true; } return false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && screen.k !== 'list' && !PH) go({ k: 'list' }); });
  async function go(s) {
    if (screen.k === 'add' && s.k !== 'add') kept = dirtyAdd() ? { small: draft.small, original: draft.original, url: draft.url, name: draft.nameEl.value, words: draft.wordsEl.value } : null;
    if (screen.k === 'item' && editing()) await saveWords(true);
    screen = s; draw(); try { view.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {   } }
  function draw() {
    if (screen.k === 'add') return drawAdd();
    if (screen.k === 'item') { const it = items.find((x) => x.name === screen.name); if (it) return drawItem(it); screen = { k: 'list' }; }
    drawList();
  }
  async function load() {
    const my = ++seq;
    const r = await API.list().catch((e) => ({ ok: false, error: String(e && e.message || e) }));
    if (my !== seq) return;
    if (!r || !r.ok) { view.innerHTML = ''; view.appendChild(el('div', 'empty', '<h1>The Home could not open</h1><p>' + esc(r && r.error || 'Unknown') + '</p>')); return; }
    items = r.items || [];
    if (screen.k === 'add' || (screen.k === 'item' && editing())) return;
    draw();
  }
  function drawList() {
    chrome('Home', items.length ? items.length + (items.length === 1 ? ' thing' : ' things') : '', false, true);
    view.innerHTML = '';
    if (!items.length) {
      const e = el('div', 'empty');
      e.innerHTML = '<div class="mark">' + IC('tool-home', 34) + '</div><h1>Nothing in the Home yet</h1><p>Take a photo of something you own, give it a name and a few words. It is kept as a note in the Home folder of your vault.</p>';
      e.appendChild(button('bl-btn gold lg', IC('plus', 16) + '<span>Add your first thing</span>', () => go({ k: 'add' })));
      view.appendChild(e);
      return;
    }
    const grid = el('div', 'things');
    for (const it of items) {
      const c = button('thing', '', () => go({ k: 'item', name: it.name }));
      const ph = el('span', 'ph'); fillPhoto(ph, it.photo);
      const line = HM.firstLine(it.words, 70);
      const tx = el('span', 'tx', '<span class="nm">' + esc(it.name) + '</span>' + (line ? '<span class="ln">' + esc(line) + '</span>' : ''));
      c.append(ph, tx);
      grid.appendChild(c);
    }
    view.appendChild(grid);
  }
  let draft = null, kept = null;
  const dirtyAdd = () => !!(draft && (draft.small || (draft.nameEl && draft.nameEl.value.trim()) || (draft.wordsEl && draft.wordsEl.value.trim())));
  function drawAdd() {
    chrome('Add a thing', '', true, false);
    draft = { small: null, original: null, preview: null };
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
    const wl = el('label', 'field', '<span>A few words</span>'), words = el('textarea');
    Object.assign(words, { rows: 4, maxLength: HM.MAX_WORDS, placeholder: 'What it is, where it came from, anything worth remembering.' });
    wl.appendChild(words);
    draft.nameEl = name; draft.wordsEl = words;
    if (kept) { name.value = kept.name || ''; words.value = kept.words || ''; if (kept.small) { draft.small = kept.small; draft.original = kept.original; draft.url = kept.url; putPhoto(kept.url); } kept = null; }
    const save = button('bl-btn gold lg wide', '<span>Save</span>', async () => {
      const n = HM.cleanName(name.value);
      if (!n) { toast('Give it a name.'); name.focus(); return; }
      save.disabled = true;
      const r = await API.add({ name: n, words: words.value, small: draft.small, original: draft.original }).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
      save.disabled = false;
      if (!r || !r.ok) { toast((r && r.error) || 'It could not be saved.', 5000); return; }
      draft = null; kept = null;
      toast(r.name === n ? n + ' is in the Home.' : 'Saved as ' + r.name + ' (one by that name was there already).', 4000);
      screen = { k: 'list' }; await load(); draw();
    });
    f.addEventListener('submit', (e) => e.preventDefault());
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); words.focus(); } });
    f.append(pick, shot, nl, wl, save);
    view.appendChild(f);
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
  let edit = null;
  const editing = () => !!(edit && edit.ta && edit.ta.value !== edit.base);
  function drawItem(it) {
    chrome(it.name, it.added ? 'Added ' + niceDay(it.added) : '', true, false);
    view.innerHTML = '';
    const box = el('article', 'one');
    const ph = el('div', 'big'); fillPhoto(ph, it.photo);
    const side = el('div', 'side');
    side.appendChild(el('h1', '', esc(it.name)));
    const wl = el('label', 'field', '<span>A few words</span>'), ta = el('textarea');
    Object.assign(ta, { rows: 6, maxLength: HM.MAX_WORDS, value: it.words || '', placeholder: 'Nothing written yet.' });
    wl.appendChild(ta);
    edit = { ta, base: it.words || '', it, btn: null };
    const row = el('div', 'row');
    const save = button('bl-btn gold', '<span>Save words</span>', () => saveWords(false));
    save.hidden = true; edit.btn = save;
    ta.addEventListener('input', () => { save.hidden = ta.value === edit.base; save.disabled = false; });
    ta.addEventListener('blur', () => saveWords(true));
    row.appendChild(save);
    if (API.openNote) row.appendChild(button('bl-btn coal', IC('document', 14) + '<span>Open in Obsidian</span>', () => API.openNote(it.name)));
    side.append(wl, row);
    box.append(ph, side);
    view.appendChild(box);
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
  chrome('Home', '', false, true);
  load();
  window.HomeRoom = { reload: load, go, _screen: () => screen };
})();
