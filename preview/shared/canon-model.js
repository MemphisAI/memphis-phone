'use strict';
(function (root) {
  const STRIP = /[\u2600-\u27BF\uFE0F\u200D]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g;
  const clean = (s) => String(s || '').replace(STRIP, '').replace(/\s+/g, ' ').trim();
  const RX = {
    title: /^#\s+(.+)$/,
    section: /^##\s+(.*)$/,
    question: /^###\s+(\d+)[.)]\s+(.+)$/,
    option: /^\s*-\s+\[( |x|X)\]\s+\*\*([A-Z])\s*:?\*\*\s*:?\s*(.*)$/,
    other: /^\s*-\s+\[( |x|X)\]\s+(?:\*\*)?Something else(?:\*\*)?\s*:?\s*(.*)$/i,
    item: /^\s*-\s+\[( |x|X)\]\s+(.+)$/,
    quote: /^\s*>\s?(.*)$/,
    link: /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g,
  };
  function splitMeta(s) {
    const i = s.lastIndexOf(' — *');
    if (i < 0) return { text: s.trim(), meta: '' };
    let meta = s.slice(i + 4).trim();
    if (meta.endsWith('*')) meta = meta.slice(0, -1);
    return { text: s.slice(0, i).trim(), meta: meta.trim() };
  }
  function linksOf(s) {
    const out = []; let m; RX.link.lastIndex = 0;
    while ((m = RX.link.exec(String(s || '')))) out.push(m[1].trim());
    return out;
  }
  function parseNote(rel, text) {
    rel = String(rel || '').replace(/\\/g, '/');
    const parts = rel.split('/');
    const file = parts[parts.length - 1] || '';
    const domain = parts.length > 1 ? parts[0] : '';
    const note = { rel, domain, subject: file.replace(/\.md$/i, ''), summary: '', questions: [] };
    if (!domain || /^(_|00 )/.test(file)) return note;
    let lines = String(text || '').replace(/\r/g, '').split('\n');
    if (lines[0] === '---') { const end = lines.indexOf('---', 1); if (end > 0) lines = lines.slice(end + 1); }
    let inDecide = false, q = null, beforeSections = true, summary = [];
    const finish = () => { if (q && (q.options.length || q.items.length || q.other)) note.questions.push(q); q = null; };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      let m;
      if ((m = line.match(RX.title)) && beforeSections && !note._titled) { note.subject = clean(m[1]) || note.subject; note._titled = true; continue; }
      if ((m = line.match(RX.section))) { finish(); beforeSections = false; inDecide = /decide/i.test(m[1]); continue; }
      if (beforeSections) { const qm = line.match(RX.quote); if (qm && qm[1].trim()) summary.push(qm[1].trim()); continue; }
      if (!inDecide) continue;
      if ((m = line.match(RX.question))) {
        finish();
        q = { n: Number(m[1]), text: clean(m[2]), options: [], items: [], other: null, hint: '' };
        continue;
      }
      if (!q) continue;
      if ((m = line.match(RX.other))) { q.other = { ticked: m[1] !== ' ', text: clean(m[2]) }; continue; }
      if ((m = line.match(RX.option))) {
        const sm = splitMeta(m[3]);
        q.options.push({ letter: m[2], text: clean(sm.text), meta: clean(sm.meta), links: linksOf(sm.meta), ticked: m[1] !== ' ' });
        continue;
      }
      if ((m = line.match(RX.item))) { const sm = splitMeta(m[2]); q.items.push({ text: clean(sm.text), meta: clean(sm.meta), links: linksOf(sm.meta) }); continue; }
      if ((m = line.match(RX.quote)) && m[1].trim()) q.hint = clean((q.hint ? q.hint + ' ' : '') + m[1]);
    }
    finish();
    delete note._titled;
    note.summary = clean(summary.join(' '));
    note.questions.forEach((x) => {
      x.key = rel + '#' + x.n + ':' + x.text;
      x.rel = rel; x.domain = domain; x.subject = note.subject; x.summary = note.summary;
    });
    return note;
  }
  const domainName = (d) => String(d || '').replace(/^\d+\s+/, '');
  function build(files) {
    const notes = (files || []).map((f) => parseNote(f.rel, f.text)).filter((n) => n.questions.length);
    const by = new Map();
    for (const n of notes) { if (!by.has(n.domain)) by.set(n.domain, []); by.get(n.domain).push(n); }
    const domains = [...by.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((id) => {
      const ns = by.get(id).sort((a, b) => a.subject.localeCompare(b.subject, 'en'));
      return { id, name: domainName(id), questions: ns.reduce((acc, n) => acc.concat(n.questions), []) };
    });
    const byKey = {};
    for (const d of domains) for (const q of d.questions) byKey[q.key] = q;
    return { domains, byKey };
  }
  function emptyState() { return { schema: 1, decisions: {}, skipped: {}, imported: {}, suggest: {}, checked: {} }; }
  function normState(s) {
    const o = emptyState();
    if (!s || typeof s !== 'object') return o;
    for (const k of ['decisions', 'skipped', 'imported', 'suggest', 'checked']) if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) o[k] = Object.assign({}, s[k]);
    return o;
  }
  const iso = (now) => new Date(now == null ? Date.now() : now).toISOString();
  function record(q, answer, at, from) {
    return { kind: answer.kind, letters: (answer.letters || []).slice(), text: String(answer.text || '').trim(), at, from: from || 'canon',
      domain: q.domain, subject: q.subject, rel: q.rel, question: q.text };
  }
  function importTicks(model, state, now) {
    const s = normState(state); let added = 0;
    for (const d of model.domains) for (const q of d.questions) {
      if (s.decisions[q.key] || s.imported[q.key]) continue;
      const picked = q.options.filter((o) => o.ticked);
      let answer = null;
      if (q.other && q.other.ticked && q.other.text) answer = { kind: 'own', letters: [], text: q.other.text };
      else if (picked.length === 1) answer = { kind: 'pick', letters: [picked[0].letter], text: picked[0].text };
      else if (picked.length > 1) answer = { kind: 'merge', letters: picked.map((o) => o.letter), text: picked.map((o) => o.text).join(' / ') };
      if (!answer) continue;
      s.decisions[q.key] = record(q, answer, iso(now), 'obsidian');
      s.imported[q.key] = true; delete s.skipped[q.key]; added++;
    }
    return { state: s, added };
  }
  function decide(state, q, answer, now) {
    const s = normState(state);
    if (!q || !answer) throw new Error('nothing to decide');
    const letters = (answer.letters || []).filter((l) => q.options.some((o) => o.letter === l));
    let a;
    if (answer.kind === 'pick') {
      if (letters.length !== 1) throw new Error('pick one version');
      a = { kind: 'pick', letters, text: q.options.find((o) => o.letter === letters[0]).text };
    } else if (answer.kind === 'merge') {
      if (letters.length < 2) throw new Error('choose two versions to merge');
      const text = String(answer.text || '').trim();
      if (!text) throw new Error('the merged version is empty');
      a = { kind: 'merge', letters, text };
    } else if (answer.kind === 'own') {
      const text = String(answer.text || '').trim();
      if (!text) throw new Error('your version is empty');
      a = { kind: 'own', letters: [], text };
    } else throw new Error('unknown answer');
    s.decisions[q.key] = record(q, a, iso(now));
    delete s.skipped[q.key];
    return s;
  }
  function reopen(state, key) {
    const s = normState(state);
    delete s.decisions[key]; delete s.skipped[key]; s.imported[key] = true;
    s.suggest[key] = { dismissed: true, at: iso() };
    return s;
  }
  function skip(state, key, now) { const s = normState(state); s.skipped[key] = now == null ? Date.now() : now; return s; }
  const plain = (s) => String(s || '').replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, n, l) => (l || n).trim()).replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\s+([;,.])/g, '$1').trim();
  function mergeDraft(q, letters) {
    return q.options.filter((o) => (letters || []).includes(o.letter)).map((o) => plain(o.text)).join('\n\n');
  }
  function queue(model, state, domainId) {
    const s = normState(state);
    const d = model.domains.find((x) => x.id === domainId);
    if (!d) return [];
    const open = d.questions.filter((q) => !s.decisions[q.key] && !isSuggested(s, q.key));
    const fresh = open.filter((q) => s.skipped[q.key] == null);
    const later = open.filter((q) => s.skipped[q.key] != null).sort((a, b) => s.skipped[a.key] - s.skipped[b.key]);
    return fresh.concat(later);
  }
  function progress(model, state) {
    const s = normState(state); let total = 0, left = 0;
    const domains = model.domains.map((d) => {
      const t = d.questions.length, l = d.questions.filter((q) => !s.decisions[q.key]).length;
      total += t; left += l;
      return { id: d.id, name: d.name, total: t, left: l };
    });
    return { total, left, domains };
  }
  function log(model, state) {
    const s = normState(state);
    return Object.keys(s.decisions).map((key) => Object.assign({ key, live: !!model.byKey[key] }, s.decisions[key]))
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }
  const PLACED = ['page', 'copy', 'proposed', 'ask', 'already', 'waiting'];
  function setPlaced(state, key, placed, now) {
    const s = normState(state);
    if (!s.decisions[key]) return s;
    const d = Object.assign({}, s.decisions[key]);
    if (placed && PLACED.indexOf(placed.kind) >= 0) d.placed = Object.assign({}, placed, { at: iso(now) });
    else delete d.placed;
    s.decisions[key] = d;
    return s;
  }
  function asking(state) {
    const s = normState(state);
    return Object.keys(s.decisions).filter((k) => s.decisions[k].placed && s.decisions[k].placed.kind === 'ask')
      .map((k) => Object.assign({ key: k }, s.decisions[k])).sort((a, b) => (a.at < b.at ? 1 : -1));
  }
  function placeRequest(q, dec) {
    return { domain: dec.domain || (q && q.domain) || '', subject: dec.subject || (q && q.subject) || '', question: dec.question || (q && q.text) || '',
      text: dec.text, kind: dec.kind, summary: (q && q.summary) || '' };
  }
  function proposedTitles(state, exceptKey) {
    const s = normState(state), out = [];
    for (const k of Object.keys(s.decisions)) { const p = s.decisions[k].placed; if (k !== exceptKey && p && p.kind === 'proposed' && p.title && out.indexOf(p.title) < 0) out.push(p.title); }
    return out;
  }
  function placeLabel(p) {
    if (!p) return '';
    if (p.kind === 'page') return 'On ' + p.page + "'s page, under " + p.section;
    if (p.kind === 'copy') return 'For ' + p.label + ': ready to copy';
    if (p.kind === 'proposed') return 'New page ' + p.title + ': a card in the Sandbox';
    if (p.kind === 'ask') return 'Memphis asks where this goes';
    if (p.kind === 'waiting') return 'Waits for the new page ' + p.title + ': save its card in the Sandbox, then Place again';
    if (p.kind === 'already') return 'Already settled' + (p.why ? ' (' + p.why + ')' : '') + ': nothing new written';
    return '';
  }
  function optionLabel(o) {
    if (o.where === 'page') return o.page + ' › ' + o.section;
    if (o.where === 'copy') return o.label + ' (copy by hand)';
    if (o.where === 'new') return 'A new page: ' + o.title;
    return '';
  }
  const stale = (v) => !!(v && !v.dismissed && !v.quote);
  const isSuggested = (s, key) => !!(s.suggest[key] && !s.suggest[key].dismissed && !stale(s.suggest[key]));
  const inDomain = (key, domainId) => key.slice(0, domainId.length + 1) === domainId + '/';
  function needsCheck(state, domainId) {
    const s = normState(state);
    return !s.checked[domainId] || Object.keys(s.suggest).some((k) => inDomain(k, domainId) && stale(s.suggest[k]) && !s.decisions[k]);
  }
  function setSuggestions(state, domainId, found, now) {
    const s = normState(state);
    for (const k of Object.keys(s.suggest)) if (inDomain(k, domainId) && stale(s.suggest[k])) delete s.suggest[k];
    for (const f of found || []) {
      if (!f || !f.key || !f.quote || s.decisions[f.key] || (s.suggest[f.key] && s.suggest[f.key].dismissed)) continue;
      s.suggest[f.key] = { letter: String(f.letter || ''), text: String(f.text || ''), why: String(f.why || ''),
        quote: String(f.quote).slice(0, 300), page: String(f.page || ''), at: iso(now) };
    }
    s.checked[domainId] = iso(now);
    return s;
  }
  function suggestions(model, state, domainId) {
    const s = normState(state), out = [];
    for (const d of model.domains) {
      if (domainId && d.id !== domainId) continue;
      for (const q of d.questions) if (isSuggested(s, q.key) && !s.decisions[q.key]) out.push(Object.assign({ key: q.key, q }, s.suggest[q.key]));
    }
    return out;
  }
  function confirm(state, q, sug, now) {
    const a = sug.letter && q.options.some((o) => o.letter === sug.letter) ? { kind: 'pick', letters: [sug.letter] } : { kind: 'own', text: sug.text };
    const s = decide(state, q, a, now);
    s.decisions[q.key].from = 'settled';
    s.decisions[q.key].placed = { kind: 'already', why: String(sug.why || ''), quote: String(sug.quote || ''), at: iso(now) };
    delete s.suggest[q.key];
    return s;
  }
  function dismiss(state, key, now) { const s = normState(state); s.suggest[key] = { dismissed: true, at: iso(now) }; return s; }
  function settledRequest(model, state, domainId) {
    const s = normState(state);
    const d = model.domains.find((x) => x.id === domainId);
    const questions = (d ? d.questions : []).filter((q) => !s.decisions[q.key] && (!s.suggest[q.key] || stale(s.suggest[q.key])))
      .map((q) => ({ key: q.key, subject: q.subject, question: q.text, options: q.options.map((o) => ({ letter: o.letter, text: plain(o.text) })) }));
    const decided = Object.keys(s.decisions).map((k) => ({ subject: s.decisions[k].subject, question: s.decisions[k].question, text: plain(s.decisions[k].text) }));
    return { domain: domainId, questions, decided };
  }
  const api = { proposedTitles, needsCheck, setSuggestions, suggestions, confirm, dismiss, settledRequest, setPlaced, asking, placeRequest, placeLabel, optionLabel, parseNote, build, domainName, emptyState, normState, importTicks, decide, reopen, skip, mergeDraft, queue, progress, log, splitMeta, linksOf, clean, plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CanonModel = api;
})(typeof window !== 'undefined' ? window : this);
