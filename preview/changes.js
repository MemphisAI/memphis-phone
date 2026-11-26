'use strict';
(function () {
  const P = window.Phone, E = P.engine, SM = window.SyncModel;
  const DIR = SM.CANON_DIR + '/changesets';
  const view = document.getElementById('view');
  const esc = P.esc, el = P.el;
  const safe = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '-');
  let sets = [], mine = {}, openId = null, sureT = null;
  async function load() {
    const paths = await E.list(DIR);
    const got = [], v = {};
    for (const p of paths) {
      const name = p.slice(DIR.length + 1);
      if (name.indexOf('/') >= 0 || !/\.json$/i.test(name) || SM.isCopy(name)) continue;
      let o = null; try { o = JSON.parse(await E.read(p)); } catch (e) { continue; }
      if (!o || !o.id) continue;
      if (/\.verdict\.json$/i.test(name)) v[o.id] = o; else got.push(o);
    }
    got.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    sets = got; mine = v;
  }
  function standing(x) {
    const m = mine[x.id], ph = x.phone || null;
    const heard = m && ph && ph.at === m.at && ph.sig === m.sig && ph.verdict === m.verdict;
    if (m && !heard) return { kind: 'sent', line: (m.verdict === 'approve' ? 'Approved here.' : 'Rejected here.') + ' Alaric takes it at the next sync.' };
    if (ph && ph.line) return { kind: ph.outcome || '', line: ph.line };
    return null;
  }
  function group(x) {
    const s = standing(x);
    if (x.state === 'applied') return 'done';
    if (s && s.kind === 'rejected') return 'rejected';
    return 'waiting';
  }
  function counts(x) {
    if (x.state === 'applied') {
      const s = x.summary || {};
      return 'Applied: ' + [s.pages ? s.pages + ' pages reshaped' : '', s.created ? s.created + ' new' : '', s.moved ? s.moved + ' notes moved' : '', (s.links || 0) + ' links fixed'].filter(Boolean).join(', ') + '.';
    }
    if (x.outside) return 'It touches notes outside the book.';
    const a = [];
    if ((x.moves || []).length) a.push(x.moves.length + (x.moves.length === 1 ? ' note moves' : ' notes move'));
    if ((x.pages || []).length) a.push(x.pages.length + (x.pages.length === 1 ? ' page changes' : ' pages change'));
    if ((x.creates || []).length) a.push(x.creates.length + ' new');
    if ((x.trash || []).length) a.push(x.trash.length + ' fold into another page');
    a.push((x.links || 0) + ' links fixed');
    return a.join(', ') + '.';
  }
  function drawList() {
    openId = null;
    view.innerHTML = '';
    view.appendChild(el('h1', '', 'Change sets'));
    view.appendChild(el('p', 'sub', 'What Memphis proposes for the notes. Read it, then approve or reject. Alaric applies an approval all at once, and Undo there takes it all back.'));
    if (!sets.length) {
      view.appendChild(el('p', 'card line', 'No change sets are here. When Memphis proposes one, it shows here after Alaric syncs.'));
      return;
    }
    for (const [g, head] of [['waiting', 'Waiting for you'], ['rejected', 'Rejected'], ['done', 'Applied']]) {
      const xs = sets.filter((x) => group(x) === g);
      if (!xs.length) continue;
      view.appendChild(el('div', 'cs-head', esc(head)));
      for (const x of g === 'done' ? xs.slice(-10).reverse() : xs) {
        const s = standing(x);
        const a = el('button', 'cs-item' + (g === 'waiting' ? '' : ' quiet'),
          '<span class="cs-id">' + esc(x.id) + '</span><span class="cs-t">' + esc(x.title || '') + '</span><span class="cs-c">' + esc(counts(x)) + '</span>'
          + (s ? '<span class="cs-s ' + esc(s.kind) + '">' + esc(s.line) + '</span>' : ''));
        a.type = 'button';
        a.addEventListener('click', () => drawOne(x.id));
        view.appendChild(a);
      }
    }
  }
  function para(cls, html) { return el('p', 'cs-p' + (cls ? ' ' + cls : ''), html); }
  function diffBox(lines) {
    const box = el('div', 'diff');
    box.innerHTML = (lines || []).map(([t, s]) => '<div class="dl ' + (t === '+' ? 'add' : t === '-' ? 'del' : t === '~' ? 'skip' : 'ctx') + '">' + esc(s === '' ? ' ' : s) + '</div>').join('');
    return box;
  }
  function fold(summary, body, open) {
    const d = el('details', 'cs-page'); if (open) d.open = true;
    d.appendChild(el('summary', '', summary));
    let made = false;
    const make = () => { if (made) return; made = true; d.appendChild(body()); };
    d.addEventListener('toggle', () => { if (d.open) make(); });
    if (open) make();
    return d;
  }
  const plain = (p) => String(p || '').split('/').pop().replace(/\.md$/i, '');
  function drawOne(id) {
    const x = sets.find((s) => s.id === id);
    if (!x) { drawList(); return; }
    openId = id;
    view.innerHTML = '';
    const back = P.btn('ghost sm', 'All change sets', () => drawList()); back.classList.add('cs-back');
    view.appendChild(back);
    view.appendChild(el('div', 'cs-tag', 'Change set ' + esc(x.id)));
    view.appendChild(el('h1', '', esc(x.title || '')));
    if (x.about) view.appendChild(para('', esc(x.about)));
    const s = standing(x);
    if (s) view.appendChild(para('cs-s ' + esc(s.kind), esc(s.line)));
    if (x.state === 'applied') { view.appendChild(para('', esc(counts(x)) + ' Undo is on Alaric: say "change set" there.')); window.scrollTo(0, 0); return; }
    if (x.state === 'undone') view.appendChild(para('', 'It was applied once and undone on Alaric. Approve it again to have it applied again.'));
    if (x.alaric_only) view.appendChild(para('cs-bad', esc(x.alaric_only)));
    for (const p of x.problems || []) view.appendChild(para('cs-bad', 'Blocked: ' + esc(p)));
    for (const w of x.warnings || []) view.appendChild(para('', esc(w)));
    if (!x.outside) {
      const asks = (x.moves || []).concat(x.pages || [], x.creates || []).filter((m) => m.question);
      if (asks.length) view.appendChild(para('', asks.length + (asks.length === 1 ? ' question' : ' questions') + ' for you below. Approving takes the answer Memphis suggests; to answer differently, approve it on Alaric.'));
      if ((x.moves || []).length) {
        view.appendChild(el('div', 'cs-head', esc(x.moves.length + (x.moves.length === 1 ? ' note moves' : ' notes move'))));
        const ul = el('div', 'cs-moves');
        for (const m of x.moves) ul.appendChild(el('div', 'mv' + (m.question ? ' ask' : ''), '<span class="from">' + esc(m.title) + '</span><span class="to">to ' + esc(m.folder) + ' / ' + esc(m.name) + '</span>' + (m.question ? '<span class="q">' + esc(m.question) + '</span>' : '')));
        view.appendChild(ul);
      }
      if ((x.pages || []).length) {
        view.appendChild(el('div', 'cs-head', esc(x.pages.length + (x.pages.length === 1 ? ' page changes' : ' pages change'))));
        view.appendChild(para('fine', 'Green is added, red is taken out, compared with the page as it is now. Tap a page to see it.'));
        for (const pg of x.pages) {
          view.appendChild(fold(esc(plain(pg.path) || pg.title), () => {
            const w = el('div', '');
            if (pg.question) w.appendChild(para('ask', esc(pg.question)));
            const nw = (x.novel || {})[pg.path];
            if (nw && nw.length) w.appendChild(para('fine', 'Words that are in none of your pages now: ' + nw.map(esc).join(', ') + '.'));
            w.appendChild(diffBox(pg.diff));
            return w;
          }, pg.first));
        }
      }
      for (const c of x.creates || []) {
        view.appendChild(fold('New: ' + esc(plain(c.path) || c.title), () => {
          const w = el('div', '');
          if (c.question) w.appendChild(para('ask', esc(c.question)));
          const nw = (x.novel || {})[c.path];
          if (nw && nw.length) w.appendChild(para('fine', 'Words that are in none of your pages now: ' + nw.map(esc).join(', ') + '.'));
          w.appendChild(diffBox(String(c.text || '').split('\n').map((l) => ['+', l])));
          return w;
        }));
      }
      if ((x.trash || []).length) view.appendChild(para('', 'Folded into another page, then moved to the trash (nothing is deleted): ' + x.trash.map((t) => esc(t.title) + ' into ' + esc(t.into)).join(', ') + '.'));
      if ((x.new_folders || []).length) view.appendChild(para('', 'New folders: ' + x.new_folders.map(esc).join(', ') + '.'));
      if ((x.remove_empty || []).length) view.appendChild(para('', 'Removed because they are empty: ' + x.remove_empty.map(esc).join(', ') + '.'));
      const ne = (x.edits || []).length, nl = x.links || 0;
    view.appendChild(fold(esc(nl + (nl === 1 ? ' link' : ' links') + ' rewritten in ' + ne + (ne === 1 ? ' note' : ' notes')), () => el('div', 'cs-moves', (x.edits || []).map((e) => '<div class="mv"><span class="from">' + esc(plain(e.path)) + '</span><span class="to">' + esc(e.links) + '</span></div>').join(''))));
      if ((x.left || []).length) view.appendChild(para('', 'Left as they are (your canon), still pointing at old names: ' + x.left.map((e) => esc(plain(e.path)) + ' (' + esc(e.links) + ')').join(', ') + '.'));
    }
    const can = !x.alaric_only && !(x.problems || []).length && x.sig;
    const bar = el('div', 'cs-bar');
    const no = P.btn('coal', 'Reject', () => twice(no, 'Tap again to reject it', 'Reject', () => decide(x, 'reject')));
    const yes = P.btn('gold', 'Approve change set', () => twice(yes, 'Tap again to approve it all', 'Approve change set', () => decide(x, 'approve')), { disabled: !can });
    bar.append(no, yes);
    view.appendChild(bar);
    if (!can && !x.alaric_only) view.appendChild(para('fine', 'It cannot be approved until what blocks it is fixed.'));
    window.scrollTo(0, 0);
  }
  function twice(b, sure, label, go) {
    if (!b.classList.contains('sure')) {
      b.classList.add('sure'); b.textContent = sure;
      clearTimeout(sureT); sureT = setTimeout(() => { b.classList.remove('sure'); b.textContent = label; }, 6000);
      return;
    }
    clearTimeout(sureT); b.classList.remove('sure'); b.textContent = label; go();
  }
  async function decide(x, verdict) {
    const v = { schema: 1, id: x.id, verdict, sig: x.sig || '', at: new Date().toISOString() };
    try { await E.write(DIR + '/' + safe(x.id) + '.verdict.json', JSON.stringify(v, null, 1) + '\n'); }
    catch (e) { P.toast(String(e.message || e), 5000); return; }
    mine[x.id] = v;
    P.toast(verdict === 'approve' ? 'Approved. Alaric applies it at the next sync, if his Hands are untied.' : 'Rejected. It stays unapplied.', 4500);
    drawOne(x.id);
  }
  async function refresh() { await load(); if (openId) drawOne(openId); else drawList(); }
  document.addEventListener('phone-synced', () => { refresh(); });
  E.signedIn().then((s) => { if (s) refresh(); });
  window.__changes = { refresh, standing, group };
})();
