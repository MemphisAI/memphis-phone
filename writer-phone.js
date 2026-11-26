'use strict';
(function () {
  const W = window.WriterPhone;
  const $ = (id) => document.getElementById(id);
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
  const vv = window.visualViewport;
  function fit() {
    if (!vv) return;
    document.documentElement.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    document.documentElement.classList.toggle('kb', vv.height < window.innerHeight - 120);
    const a = document.activeElement;
    if (a && a.isContentEditable && typeof revealInField === 'function') setTimeout(() => revealInField(a, false), 60);
  }
  if (vv) { vv.addEventListener('resize', fit); fit(); }
})();
