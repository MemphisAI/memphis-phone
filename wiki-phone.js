'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const C = window.__wikiCore;
  if (!C) return;
  const scrim = $('scrim'), left = $('s-left'), right = $('s-right'), bL = $('b-left'), bR = $('b-right');
  let open = null;
  function set(which) {
    open = which === open ? null : which;
    document.body.classList.toggle('dr-left', open === 'left');
    document.body.classList.toggle('dr-right', open === 'right');
    bL.setAttribute('aria-expanded', open === 'left' ? 'true' : 'false');
    bR.setAttribute('aria-expanded', open === 'right' ? 'true' : 'false');
    bL.classList.toggle('on', open === 'left'); bR.classList.toggle('on', open === 'right');
    scrim.hidden = !open;
    if (document.activeElement && (left.contains(document.activeElement) || right.contains(document.activeElement)) && !open) document.activeElement.blur();
  }
  bL.addEventListener('click', () => set('left'));
  bR.addEventListener('click', () => set('right'));
  scrim.addEventListener('click', () => set(null));
  left.addEventListener('click', (e) => { if (e.target.closest('button, a')) setTimeout(() => set(null), 0); });
  right.addEventListener('click', (e) => { if (e.target.closest('[data-go], a')) setTimeout(() => set(null), 0); });
  C.page.addEventListener('click', () => { if (open) set(null); });
  $('b-back').addEventListener('click', () => { set(null); C.goBack(); });
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.id !== 'find'))) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
  window.__wikiPhone = { set, open: () => open };
})();
