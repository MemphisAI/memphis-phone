'use strict';
(function () {
  const W = window.WriterPhone;
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const plates = () => (typeof P !== 'undefined' && P) ? P : null;
  for (const id of ['timelineBtn', 'parablesBtn', 'exportBtn', 'aiZone']) { const b = $(id); if (b) b.hidden = true; }
  const orr = $('orrery');
  if (orr) orr.addEventListener('click', (e) => {
    if (e.target.closest('.cell-o:not(.ghost), .sq81') && orr.classList.contains('open')) setTimeout(() => {
      orr.classList.remove('open');
      if (typeof collapseMap === 'function') collapseMap();
    }, 0);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') W.saveAll(3000); });
  window.addEventListener('pagehide', () => { W.saveAll(3000); });
  function here() {
    const a = document.activeElement;
    const row = a && a.closest && a.closest('#plates .plate-row');
    if (!row || !plates()) return null;
    return { i: Number(row.dataset.i), tx: row.querySelector('.ptext'), note: row.querySelector('.pnote'), inNote: a.classList.contains('pnote') };
  }
  const KEYS = [['split', 'Split the plate here', 'split'], ['merge', 'Merge with the next plate', 'merge'], ['note', 'Note', 'document'], ['dialogue', 'Dialogue', 'quote'], ['break', 'Scene break', 'minus']];
  const IC = (n, z) => (window.BladesIcon ? window.BladesIcon(n, z || 20) : '');
  const bar = document.createElement('div');
  bar.id = 'kbBar'; bar.className = 'kbbar'; bar.hidden = true;
  bar.innerHTML = KEYS.map(([k, t, i]) => '<button type="button" class="kb-btn" data-k="' + k + '" aria-label="' + t + '" title="' + t + '">' + IC(i) + '</button>').join('');
  document.body.appendChild(bar);
  const key = (k) => bar.querySelector('[data-k="' + k + '"]');
  function showBar() {
    const p = plates(), h = here();
    const on = !!(p && h && root.classList.contains('kb') && !p.overview);
    bar.hidden = !on;
    root.classList.toggle('kbbar', on);
    if (!on) return;
    key('merge').disabled = h.i >= p.plates.length - 1;
    key('note').classList.toggle('on', h.inNote); key('note').setAttribute('aria-label', h.inNote ? 'Back to the text' : 'Note');
    for (const k of ['dialogue', 'break']) key(k).disabled = h.inNote;
  }
  function press(k) {
    const h = here(), p = plates(); if (!h || !p) return;
    if (k === 'split') plateAction('split', h.i, h.tx);
    else if (k === 'merge') { if (h.i < p.plates.length - 1) plateAction('merge', h.i, h.tx); }
    else if (k === 'note') { const to = h.inNote ? h.tx : h.note; to.focus(); placeCaret(to, true); }
    else if (INSERTS[k] && !h.inNote) insertAtCaret(INSERTS[k].before, INSERTS[k].after);
    showBar();
  }
  let downOn = null;
  bar.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const b = e.target.closest('.kb-btn');
    downOn = b && !b.disabled ? b : null;
    if (downOn) downOn.classList.add('down');
  }, { passive: false });
  bar.addEventListener('touchend', (e) => {
    e.preventDefault();
    const b = downOn; downOn = null;
    if (!b) return;
    b.classList.remove('down');
    const t = e.changedTouches[0], r = b.getBoundingClientRect();
    if (t.clientX >= r.left - 8 && t.clientX <= r.right + 8 && t.clientY >= r.top - 12 && t.clientY <= r.bottom + 12) press(b.dataset.k);
  }, { passive: false });
  bar.addEventListener('touchcancel', () => { if (downOn) downOn.classList.remove('down'); downOn = null; });
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  bar.addEventListener('click', (e) => { const b = e.target.closest('.kb-btn'); if (b && !b.disabled) press(b.dataset.k); });
  document.addEventListener('focusin', showBar);
  document.addEventListener('focusout', () => setTimeout(showBar, 0));
  const HOLD_MS = 350, SLOP = 10;
  document.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest && e.target.closest('#plates .pgrip');
    if (!grip || e.pointerType === 'mouse') return;
    e.stopPropagation();
    const p = plates(); if (!p || p.plates.length < 2) return;
    const i = Number(grip.closest('.plate-row').dataset.i);
    const x0 = e.clientX, y0 = e.clientY;
    let y = y0, timer = null;
    const stop = () => {
      clearTimeout(timer); grip.classList.remove('holding');
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', stop, true);
      window.removeEventListener('pointercancel', stop, true);
    };
    const move = (ev) => { y = ev.clientY; if (Math.abs(ev.clientX - x0) > SLOP || Math.abs(ev.clientY - y0) > SLOP) stop(); };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', stop, true);
    window.addEventListener('pointercancel', stop, true);
    grip.classList.add('holding');
    timer = setTimeout(() => { stop(); carry(grip, i, y); }, HOLD_MS);
  }, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('#plates .pgrip')) e.preventDefault(); });
  function carry(grip, i, y) {
    let lastY = y, started = false, done = false;
    const pass = (type) => (ev) => {
      const t = ev.changedTouches && ev.changedTouches[0]; if (!t) return;
      if (ev.cancelable) ev.preventDefault();
      lastY = t.clientY;
      if (type !== 'pointermove') { grip.removeEventListener('touchmove', onMove); grip.removeEventListener('touchend', onEnd); grip.removeEventListener('touchcancel', onEnd); }
      if (started) window.dispatchEvent(new PointerEvent(type, { clientX: t.clientX, clientY: t.clientY, pointerType: 'touch', isPrimary: true, bubbles: true }));
      else if (type !== 'pointermove') done = true;
    };
    const onMove = pass('pointermove'), onEnd = pass('pointerup');
    grip.addEventListener('touchmove', onMove, { passive: false });
    grip.addEventListener('touchend', onEnd, { passive: false });
    grip.addEventListener('touchcancel', onEnd, { passive: false });
    const go = () => { if (done) return; started = true; startPlateDrag({ button: 0, clientY: lastY, preventDefault() {} }, i); };
    if (root.classList.contains('kb') && document.activeElement && document.activeElement.blur) { document.activeElement.blur(); setTimeout(go, 400); }
    else go();
  }
  const vv = window.visualViewport;
  function fit() {
    if (!vv) return;
    root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    root.style.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    root.classList.toggle('kb', vv.height < window.innerHeight - 120);
    showBar();
    const a = document.activeElement;
    if (a && a.isContentEditable && typeof revealInField === 'function') setTimeout(() => revealInField(a, false), 60);
  }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit(); }

  // ---------- the shell: back (top left), the menu (top right), nothing at the bottom ----------
  const Ph = window.Phone, U = Ph && Ph.ui;
  if (U) {
    const onDash = () => typeof current === 'undefined' || !current;
    U.onBack(() => {
      if (!onDash()) { W.saveAll(3000); document.getElementById('homeBtn').click(); return true; }
      return false;
    });
    const words = () => { const g = (id) => { const e = $(id); return e ? e.textContent : ''; }; return g('sbWords') + ' words in this chapter' + (g('sbSession') && g('sbSession') !== '0' ? ' · ' + g('sbSession') + ' this session' : '') + ' · ' + g('sbRead') + ' min read'; };
    function chapters() {
      const body = document.createElement('div'); body.className = 'chlist';
      const R = (n) => (typeof roman === 'function' ? roman(n) : n);
      try {
        STRUCT.books.forEach((b) => {
          const h = document.createElement('div'); h.className = 'chl-book'; h.textContent = 'Book ' + R(b.n) + (typeof bookTitleOf === 'function' ? ' · ' + bookTitleOf(b.n) : ''); body.appendChild(h);
          b.acts.forEach((a) => (a.eps || []).forEach((e) => {
            const eh = document.createElement('div'); eh.className = 'chl-ep'; eh.textContent = e.t || ''; body.appendChild(eh);
            (e.ch || []).forEach((c) => {
              const r = document.createElement('button'); r.type = 'button'; r.className = 'chl-row' + (current === c ? ' on' : '') + ' ' + (c.state || 'blank');
              r.innerHTML = '<span class="n">' + R(c.n) + '</span><span class="t"></span><span class="d"></span>';
              r.querySelector('.t').textContent = c.t || 'Untitled';
              r.addEventListener('click', () => { U.closeSheet(); W.saveAll(3000).then(() => openChapter(c)); });
              body.appendChild(r);
            });
          }));
        });
      } catch (e) { console.error(e); }
      const sh = U.sheet({ title: 'Chapters', body });
      const on = sh.card.querySelector('.chl-row.on'); if (on) setTimeout(() => on.scrollIntoView({ block: 'center' }), 260);
    }
    function menu() {
      const ed = !onDash(), ov = $('pOverview');
      const body = document.createElement('div'); body.className = 'sh-body';
      if (ed) { const p = document.createElement('p'); p.className = 'sh-fine'; p.textContent = words(); body.appendChild(p); }
      U.sheet({ title: ed ? 'This chapter' : 'The book', body: ed ? body : null, items: [
        { icon: 'book', label: 'Chapters', sub: 'Every chapter in the trilogy', fn: chapters, gold: true },
        ed && ov ? { icon: 'overview', label: P && P.overview ? 'Back to writing' : 'Overview', sub: 'Fold every plate to two lines, to see and move the chapter', fn: () => ov.click() } : null,
        { icon: 'document', label: 'Read as a book', fn: () => $('readBookBtn').click() },
        ed ? { icon: 'search', label: 'The desk', sub: 'Synonyms, rhymes, search your chapters, where was I?', fn: () => $('helpBtn').click() } : null,
        { icon: 'settings', label: 'Book settings', fn: () => openBookSettings() },
      ] });
    }
    U.corner('tr', { icon: 'menu', label: 'Chapters, overview, reading and settings', fn: menu });
    const lab = $('saveLabel');
    function head() {
      const ed = !onDash();
      U.title('Writer', ed ? ((current && current.t) || '') + (lab && lab.textContent && lab.textContent !== 'Saved' ? ' · ' + lab.textContent : '') : '');
      document.body.classList.toggle('w-dash', !ed);
    }
    new MutationObserver(head).observe($('sheet'), { childList: true });
    if (lab) new MutationObserver(head).observe(lab, { childList: true, characterData: true, subtree: true });
    head();
  }
})();
