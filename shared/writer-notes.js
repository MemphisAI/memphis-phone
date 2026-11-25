(function (root) {
  'use strict';
  const WL_RX = /\[\[([^\[\]\n]+?)\]\]/g;
  const STOP = new Set(['what', 'have', 'said', 'about', 'the', 'and', 'who', 'how', 'they', 'their', 'this', 'that',
    'are', 'was', 'were', 'does', 'did']);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function rxEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function parseLink(inner) {
    const s = String(inner || '');
    const bar = s.indexOf('|');
    const target = (bar === -1 ? s : s.slice(0, bar)).trim();
    const alias = bar === -1 ? '' : s.slice(bar + 1).trim();
    const hash = target.indexOf('#');
    const page = (hash === -1 ? target : target.slice(0, hash)).trim();
    const heading = hash === -1 ? '' : target.slice(hash + 1).trim();
    const title = page.split('/').pop();
    return { target, page, title, heading, alias, shown: alias || (heading && !page ? heading : title) || target };
  }
  function makeLink(target, alias) {
    const t = String(target || '').trim(), a = String(alias || '').trim();
    return '[[' + t + (a && a !== t ? '|' + a : '') + ']]';
  }
  function searchTerms(q) {
    const s = String(q || '').trim();
    if (s.length < 2) return [];
    const words = (s.toLowerCase().match(/[a-zà-ÿ0-9'-]{3,}/gi) || []).map(w => w.toLowerCase()).filter(w => !STOP.has(w));
    const out = [s.toLowerCase()];
    words.forEach(w => { if (!out.includes(w)) out.push(w); });
    return out;
  }
  function markRx(terms) {
    const t = (terms || []).filter(Boolean).slice().sort((a, b) => b.length - a.length);
    return t.length ? new RegExp('(' + t.map(rxEsc).join('|') + ')', 'ig') : null;
  }
  function markText(text, rx) {
    if (!rx) return esc(text);
    let out = '', last = 0; const s = String(text); let m;
    rx.lastIndex = 0;
    while ((m = rx.exec(s))) { if (!m[0]) { rx.lastIndex++; continue; } out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
    return out + esc(s.slice(last));
  }
  function segments(md) {
    const s = String(md || ''), out = []; let last = 0, m;
    WL_RX.lastIndex = 0;
    while ((m = WL_RX.exec(s))) {
      if (m.index > last) out.push({ text: s.slice(last, m.index) });
      out.push({ link: m[1], raw: m[0] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ text: s.slice(last) });
    return out;
  }
  function joinSegments(segs) {
    return (segs || []).map(g => g.text != null ? g.text : (g.raw != null ? g.raw : makeLink(g.target, g.alias))).join('');
  }
  function plain(md) {
    return String(md || '').replace(WL_RX, (_m, inner) => parseLink(inner).shown)
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '').replace(/^>\s?(\[![^\]]*\]\s*)?/gm, '');
  }
  function inline(line, rx) {
    return segments(line).map(g => {
      if (g.link != null) {
        const p = parseLink(g.link);
        return '<a class="wl" href="#" data-target="' + esc(p.target) + '" title="' + esc(p.page || p.target) + (p.heading ? ' › ' + esc(p.heading) : '') + '">' + markText(p.shown, rx) + '</a>';
      }
      let t = String(g.text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
      const marks = [];
      if (rx) { rx.lastIndex = 0; t = t.replace(rx, m0 => { marks.push(m0); return '\u0001' + (marks.length - 1) + '\u0002'; }); }
      let h = esc(t)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>')
        .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<i>$2</i>')
        .replace(/(^|\s)#([A-Za-zÀ-ÿ][\w\/-]*)/g, '$1<span class="ntag">#$2</span>');
      return h.replace(/\u0001(\d+)\u0002/g, (_m, i) => '<mark>' + esc(marks[+i]) + '</mark>');
    }).join('');
  }
  function stripHead(md) {
    let s = String(md || '').replace(/\r\n?/g, '\n');
    if (s.startsWith('---')) { const end = s.indexOf('\n---', 3); if (end !== -1) { const nl = s.indexOf('\n', end + 4); s = nl === -1 ? '' : s.slice(nl + 1); } }
    s = s.replace(/^\s*# [^\n]*\n?/, '');
    return s.replace(/^\n+/, '');
  }
  function renderNote(md, terms) {
    const rx = markRx(terms);
    const lines = stripHead(md).split('\n');
    let html = '', para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) { html += '<p>' + para.map(l => inline(l, rx)).join('<br>') + '</p>'; para = []; } };
    const flushList = () => { if (list) { html += '<' + list.tag + '>' + list.items.map(i => '<li>' + inline(i, rx) + '</li>').join('') + '</' + list.tag + '>'; list = null; } };
    const flushQuote = () => { if (quote.length) { html += '<blockquote>' + quote.map(l => inline(l, rx)).join('<br>') + '</blockquote>'; quote = []; } };
    const flush = () => { flushPara(); flushList(); flushQuote(); };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      let m;
      if (!line.trim()) { flush(); continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flush(); const n = Math.min(m[1].length, 4); html += '<div class="nh nh' + n + '">' + inline(m[2], rx) + '</div>'; continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flush(); html += '<hr>'; continue; }
      if ((m = /^\s*>\s?(.*)$/.exec(line))) {
        flushPara(); flushList();
        const t = m[1].replace(/^\[![^\]]*\][+-]?\s*/, '');
        if (t || quote.length) quote.push(t);
        continue;
      }
      if ((m = /^\s*(?:[-*+]|(\d+)[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line))) {
        flushPara(); flushQuote();
        const tag = m[1] ? 'ol' : 'ul';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push(m[2]);
        continue;
      }
      flushList(); flushQuote();
      para.push(line);
    }
    flush();
    return html || '<p class="nempty">(empty)</p>';
  }
  function chapterHits(chapters, q) {
    const terms = searchTerms(q);
    if (!terms.length) return [];
    const phrase = terms[0], keys = terms.slice(1).length ? terms.slice(1) : [phrase];
    const out = [];
    (chapters || []).forEach(x => {
      const prose = String(x.prose || '').trim(); if (!prose) return;
      const low = prose.toLowerCase();
      let count = 0;
      const rx = markRx(phrase.length >= 3 && low.includes(phrase) ? [phrase] : keys);
      rx.lastIndex = 0; while (rx.exec(low)) count++;
      if (!count) return;
      let best = null, bestScore = 0;
      prose.split(/\n{2,}/).forEach(p => {
        const lp = p.toLowerCase();
        let n = 0; rx.lastIndex = 0; while (rx.exec(lp)) n++;
        const sc = (lp.includes(phrase) ? 1000 : 0) + keys.reduce((s, k) => s + (lp.includes(k) ? 50 : 0), 0) + n;
        if (sc > bestScore) { bestScore = sc; best = p.trim(); }
      });
      out.push({ c: x.c, ch: x.ch, count, score: bestScore, text: best || '' });
    });
    out.sort((a, b) => b.score - a.score || b.count - a.count);
    return out;
  }
  function snippet(text, terms, len) {
    const s = String(text || ''), n = len || 220;
    if (s.length <= n) return s;
    const low = s.toLowerCase();
    let i = -1; for (const t of terms || []) { i = low.indexOf(t); if (i !== -1) break; }
    const st = Math.max(0, i - 80);
    return (st > 0 ? '…' : '') + s.slice(st, st + n - 20) + '…';
  }
  function paragraphs(text) {
    return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  }
  function replaceParagraph(text, k, next) {
    const parts = String(text || '').split(/(\n{2,})/);
    let n = -1, at = -1;
    for (let i = 0; i < parts.length; i += 2) { if (parts[i].trim()) { n++; if (n === k) { at = i; break; } } }
    if (at === -1) return null;
    const piece = parts[at], lead = piece.match(/^\s*/)[0], trail = piece.match(/\s*$/)[0];
    const body = String(next == null ? '' : next).replace(/\r\n?/g, '\n').trim();
    if (body) { parts[at] = lead + body + trail; return parts.join(''); }
    if (at + 1 < parts.length) parts.splice(at, 2); else if (at > 0) parts.splice(at - 1, 2); else parts[at] = '';
    return parts.join('');
  }
  const api = { esc, parseLink, makeLink, searchTerms, markRx, markText, segments, joinSegments, plain, inline, stripHead, renderNote, chapterHits, snippet, paragraphs, replaceParagraph };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WriterNotes = api;
})(typeof window !== 'undefined' ? window : this);
