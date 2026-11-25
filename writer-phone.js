'use strict';
(function () {
  const Ph = window.Phone, E = Ph.engine, SM = window.SyncModel, W = window.WriterPhone;
  const $ = (id) => document.getElementById(id);
  const REOPEN = 'writer-reopen';
  for (const id of ['timelineBtn', 'parablesBtn', 'exportBtn', 'aiZone']) { const b = $(id); if (b) b.hidden = true; }
  const orr = $('orrery');
  if (orr) orr.addEventListener('click', (e) => {
    if (e.target.closest('.cell-o:not(.ghost), .sq81') && orr.classList.contains('open')) setTimeout(() => {
      orr.classList.remove('open');
      if (typeof collapseMap === 'function') collapseMap();
    }, 0);
  });
  const copiesBtn = $('t-copies');
  async function copies() { return (await E.list(W.DIR)).filter((p) => SM.isCopy(p)); }
  async function drawCopies() {
    const n = (await copies()).length;
    copiesBtn.hidden = !n;
    copiesBtn.textContent = n + ' kept beside';
  }
  function chapterOf(p) {
    if (/\/book\.from-phone/.test(p)) return 'The book\'s structure and settings';
    const m = /Ch-(\d+)/.exec(p);
    return m ? 'Chapter ' + parseInt(m[1], 10) : p.split('/').pop().replace(/\.from-phone(-\d+)?/, '');
  }
  async function showCopies() {
    const list = await copies();
    const box = Ph.el('div', 'noteview wr-copies');
    const head = Ph.el('div', 'nv-head', '<b>Kept beside</b>');
    head.appendChild(Ph.btn('coal', 'Close', () => box.remove()));
    box.appendChild(head);
    const body = Ph.el('div', 'nv-text');
    body.appendChild(Ph.el('p', 'wr-c-help', 'These changed on both Alaric and this phone. The chapter shows Alaric\'s version; what was written here is kept beside it, word for word. Copy what you need into the chapter, then remove the copy on Alaric.'));
    for (const p of list) {
      const b = Ph.btn('coal wide', chapterOf(p) + ': ' + p.split('/').pop(), () => openCopy(p, box));
      body.appendChild(b);
    }
    box.appendChild(body);
    document.body.appendChild(box);
  }
  async function openCopy(p, listBox) {
    const text = (await E.read(p)) || '';
    const prose = text.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/^<!-- plate(?:: .*?)? -->[ \t]*\r?\n?/gm, '');
    const box = Ph.el('div', 'noteview');
    const head = Ph.el('div', 'nv-head', '<b>' + Ph.esc(chapterOf(p)) + ', written here</b>');
    head.appendChild(Ph.btn('gold sm', 'Copy text', async () => {
      try { await navigator.clipboard.writeText(prose); Ph.toast('Copied. Paste it into the chapter where it belongs.'); }
      catch (e) { Ph.toast('Could not copy here: select the text instead.'); }
    }));
    head.appendChild(Ph.btn('coal sm', 'Close', () => box.remove()));
    box.appendChild(head);
    box.appendChild(Ph.el('pre', 'nv-text', Ph.esc(prose)));
    document.body.appendChild(box);
    if (listBox) listBox.remove();
  }
  copiesBtn.addEventListener('click', showCopies);
  document.addEventListener('writer-copy', (e) => {
    Ph.toast(chapterOf(e.detail.rel) + ' changed on Alaric meanwhile: what you wrote is kept beside it. Showing Alaric\'s version now.', 6000);
    drawCopies();
    setTimeout(takeAlaric, 1500);
  });
  let taking = false;
  async function takeAlaric() {
    if (taking) return; taking = true;
    try {
      await W.saveAll(5000);
      const open = (typeof current !== 'undefined' && current) ? current.n : null;
      sessionStorage.setItem(REOPEN, JSON.stringify({ n: open, at: Date.now() }));
      location.reload();
    } catch (e) { taking = false; }
  }
  document.addEventListener('phone-synced', async () => {
    drawCopies();
    if ((await W.stale()).length) takeAlaric();
  });
  (function reopen() {
    let r = null; try { r = JSON.parse(sessionStorage.getItem(REOPEN) || 'null'); } catch (e) { r = null; }
    sessionStorage.removeItem(REOPEN);
    if (!r || r.n == null || Date.now() - r.at > 60000) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const books = (typeof STRUCT !== 'undefined' && STRUCT.books) || [];
      let ch = null;
      books.forEach((b) => (b.acts || []).forEach((a) => (a.eps || []).forEach((e) => (e.ch || []).forEach((c) => { if (c.n === r.n) ch = c; }))));
      if (ch && ch._parent && typeof openChapter === 'function') { clearInterval(t); openChapter(ch); Ph.toast('Alaric\'s changes are in.'); }
      else if (tries > 50) clearInterval(t);
    }, 100);
  })();
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
  drawCopies();
  window.__writerPhone = { drawCopies, takeAlaric, copies };
})();
