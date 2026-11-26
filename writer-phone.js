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
  const KEYS = [['split', 'Split'], ['merge', 'Merge'], ['note', 'Note'], ['dialogue', 'Dialogue'], ['break', 'Break']];
  const bar = document.createElement('div');
  bar.id = 'kbBar'; bar.className = 'kbbar'; bar.hidden = true;
  bar.innerHTML = KEYS.map(([k, t]) => '<button type="button" class="kb-btn" data-k="' + k + '">' + t + '</button>').join('');
  document.body.appendChild(bar);
  const key = (k) => bar.querySelector('[data-k="' + k + '"]');
  function showBar() {
    const p = plates(), h = here();
    const on = !!(p && h && root.classList.contains('kb') && !p.overview);
    bar.hidden = !on;
    root.classList.toggle('kbbar', on);
    if (!on) return;
    key('merge').disabled = h.i >= p.plates.length - 1;
    key('note').textContent = h.inNote ? 'Text' : 'Note';
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
})();
