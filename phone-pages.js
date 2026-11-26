'use strict';
// Canon and Change sets in the shared shell: back (top left), one action (top right).
(function () {
  const U = window.Phone && window.Phone.ui; if (!U) return;
  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.page;
  if (page === 'canon') {
    const home = $('b-home'), crumb = $('crumb');
    U.onBack(() => { if (home && !home.hidden) { home.click(); return true; } return false; });
    U.corner('tr', { icon: 'document', label: 'Decision log', fn: () => $('b-log').click() });
    const sync = () => { const d = crumb.querySelector('.dm'), c = crumb.querySelector('.cnt'); U.title('Canon', d ? d.textContent + (c ? ' · ' + c.textContent : '') : crumb.textContent !== 'Canon' ? crumb.textContent : ''); };
    new MutationObserver(sync).observe(crumb, { childList: true, subtree: true, characterData: true }); sync();
  }
  if (page === 'changes') {
    U.onBack(() => { const b = document.querySelector('.cs-back'); if (b) { b.click(); return true; } return false; });
  }
})();
