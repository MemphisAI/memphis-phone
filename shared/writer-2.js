(function(){
  'use strict';
  const NOTE_HEAD_FALLBACK = '---\ntier: leaf\ncategory: Evrynthing\ntags: [\'evrynthing\', \'timeline\']\n---\n\n# Evrynthing - Timeline\n';
  const PALETTE = ['#6f9bd1','#b48ad6','#d9a52e','#5fb39a','#d9705a','#e8dfce','#c7b45a','#7fc4d6','#d68ab0','#9aa36b','#a3826b','#8a93d6'];
  const BOX_W = 196, BOX_H = 44, ROW_GAP = 8, LANE_PAD = 10, LANE_TOP = 28;
  const ROMAN = ['','I','II','III'];
  const KNOWN = /^(settings|calendars|eras|events|before the story|the story)$/i;
  const LS = {
    get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const S = {
    doc: null, zoom: 1, sel: null,
    hidden: new Set(), closed: new Set(),
    dirty: false, saving: false, failed: false, saveTimer: null, lock: false, saveChain: Promise.resolve(),
    noteTitles: [], storyX: 0,
    mode: LS.get('tl.cal', 'earth') === 'tst' ? 'tst' : 'earth',
    chapters: LS.get('tl.chapters', '0') === '1',
    erasOpen: LS.get('tl.eras.open', '0') === '1',
    editCal: null, editFolder: null, editEra: null, calsOpen: false, drag: null, trayOpen: false, laneH: {}, ovMap: null
  };
  try { JSON.parse(LS.get('tl.hidden', '[]')).forEach(n => S.hidden.add(n)); } catch (e) {}
  try { JSON.parse(LS.get('tl.folders.closed', '[]')).forEach(n => S.closed.add(n)); } catch (e) {}
  { const z = parseFloat(LS.get('tl.zoom', '1')); if (z > 0.2 && z < 6) S.zoom = z; }
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const icon = (name, size) => (window.BladesIcon ? window.BladesIcon(name, size || 16) : '');
  const clean = (s) => String(s == null ? '' : s).replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
  const TST_OFF = 3605990988633.022, TST_CYC = 108782775.7896, YEAR_S = 31556952;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON3 = MONTHS.map(m => m.slice(0, 3));
  const tstOf = (u) => (u + TST_OFF) / TST_CYC;
  const uOfTst = (t) => t * TST_CYC - TST_OFF;
  function daysFromCivil(y, m, d){
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor(y / 400), yoe = y - era * 400, mp = (m + 9) % 12;
    const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function civilFromDays(z){
    z += 719468;
    const era = Math.floor(z / 146097), doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
  }
  const uOf = (f) => daysFromCivil(f.y, f.m || 1, f.d || 1) * 86400 + (f.h || 0) * 3600 + (f.mi || 0) * 60;
  function fieldsOf(u){
    const days = Math.floor(u / 86400), sec = u - days * 86400, c = civilFromDays(days);
    return { y: c.y, m: c.m, d: c.d, h: Math.floor(sec / 3600), mi: Math.floor((sec % 3600) / 60) };
  }
  const PREC_RANK = { year: 0, month: 1, day: 2, minute: 3 };
  const decFor = (prec) => [1, 2, 4, 7][PREC_RANK[prec] || 0];
  const precFor = (dec) => dec <= 0 ? 'year' : dec <= 2 ? 'month' : dec <= 4 ? 'day' : 'minute';
  function monthNum(w){ const i = MON3.findIndex(m => m.toLowerCase() === String(w).slice(0, 3).toLowerCase()); return i < 0 ? 0 : i + 1; }
  const num = (x) => parseFloat(String(x).replace(/[, ]/g, ''));
  function parseEarth(t){
    let s = t.replace(/\s*utc$/i, '').trim(), h = null, mi = null, era = '';
    let m = s.match(/^(.*?)[,\s]+(\d{1,2}):(\d{2})$/);
    if (m){ s = m[1].trim(); h = +m[2]; mi = +m[3]; if (h > 23 || mi > 59) return null; }
    m = s.match(/^(ad|ce)\s+(.+)$/i); if (m){ era = 'ad'; s = m[2]; }
    let y = null, mo = 0, d = 0;
    if ((m = s.match(/^(\d{1,6})-(\d{1,2})(?:-(\d{1,2}))?(?:\s*(bce|bc|ad|ce))?$/i))){
      y = +m[1]; mo = +m[2]; d = m[3] ? +m[3] : 0; era = (m[4] || era).toLowerCase();
    } else if ((m = s.match(/^(?:(\d{1,2})\.?\s+)?(?:([a-z]{3,})\.?\s+)?(\d{1,3}(?:,\d{3})+|\d+)\s*(bce|bc|ad|ce)?$/i))){
      if (m[2]){ mo = monthNum(m[2]); if (!mo) return null; }
      if (m[1]){ if (!mo) return null; d = +m[1]; }
      y = num(m[3]); era = (m[4] || era).toLowerCase();
    } else return null;
    if (y == null || isNaN(y) || (mo && (mo < 1 || mo > 12)) || (d && (d < 1 || d > 31))) return null;
    if (h != null && !d) return null;
    const ay0 = (era === 'bc' || era === 'bce') ? 1 - y : y;
    if (d && civilFromDays(daysFromCivil(ay0, mo, d)).m !== mo) return null;
    const ay = (era === 'bc' || era === 'bce') ? 1 - y : y;
    const f = { y: ay, m: mo || 0, d: d || 0, h: h || 0, mi: mi || 0 };
    const prec = h != null ? 'minute' : d ? 'day' : mo ? 'month' : 'year';
    return { kind: 'time', cal: 'earth', prec, f, u: uOf(f) };
  }
  function parseTst(t){
    const m = t.match(/^(?:tst\s*)?(-?\d[\d,]*(?:\.(\d+))?)\s*(?:tst|cycles?)?$/i);
    if (!m || !/tst|cycle/i.test(t)) return null;
    const v = num(m[1]); if (isNaN(v)) return null;
    const dec = m[2] ? m[2].length : 0;
    return { kind: 'time', cal: 'tst', prec: precFor(dec), dec, tst: v, u: uOfTst(v) };
  }
  const grp = (n) => Math.abs(n) >= 10000 ? n.toLocaleString('en-GB') : String(n);
  function yearLabel(ay, withAd){ return ay <= 0 ? grp(1 - ay) + ' BC' : (withAd ? 'AD ' : '') + grp(ay); }
  const pad2 = (n) => String(n).padStart(2, '0');
  function earthText(f, prec, approx){
    let t;
    if (prec === 'year') t = yearLabel(f.y, true);
    else if (prec === 'month') t = MON3[f.m - 1] + ' ' + yearLabel(f.y, false);
    else t = f.d + ' ' + MON3[f.m - 1] + ' ' + yearLabel(f.y, false) + (prec === 'minute' ? ', ' + pad2(f.h) + ':' + pad2(f.mi) + ' UTC' : '');
    return (approx ? '~' : '') + t;
  }
  function tstText(v, dec, approx){
    return (approx ? '~' : '') + v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' TST';
  }
  function fmtPoint(pt, mode){
    if (pt.kind !== 'time') return null;
    if (mode === 'tst') return tstText(pt.cal === 'tst' ? pt.tst : tstOf(pt.u), pt.cal === 'tst' ? pt.dec : decFor(pt.prec), pt.approx);
    return earthText(pt.cal === 'earth' ? pt.f : fieldsOf(pt.u), pt.cal === 'earth' ? pt.prec : precFor(pt.dec), pt.approx);
  }
  function bookNum(s){ const m = s.match(/book\s+(iii|ii|i|[123])\b/i); if (!m) return 0; const v = m[1].toUpperCase(); return v === 'I' || v === '1' ? 1 : v === 'II' || v === '2' ? 2 : 3; }
  function parseStory(s){
    s = String(s || '').trim(); const b = s ? bookNum(s) : 0; if (!b) return null;
    let ch = null, ch2 = null;
    const m = s.match(/ch(?:apter)?\.?\s*(\d+)(?:\s*[–-]\s*(\d+))?/i);
    if (m){ ch = parseInt(m[1], 10); ch2 = m[2] ? parseInt(m[2], 10) : null; }
    let pos, known = true;
    const atEnd = /\bend\b/i.test(s);
    if (atEnd) pos = (b - 1) * 27 + 27;
    else if (ch != null) pos = (b - 1) * 27 + (ch2 ? (ch + ch2) / 2 : ch) - 0.5;
    else { pos = (b - 1) * 27 + 0.25; known = false; }
    if (/\bbefore\b/i.test(s)) pos -= 0.45;
    if (/\bafter\b/i.test(s)) pos += 0.45;
    return { kind: 'story', s: Math.max(-0.5, pos), chKnown: known || atEnd, book: b, atEnd, ch1: ch, ch2: ch2 || ch };
  }
  function parsePoint(raw){
    let s = String(raw || '').trim();
    if (!s || s === '?') return null;
    const st = parseStory(s); if (st) return st;
    const approx = /^(~|c\.|ca\.|about|around)/i.test(s);
    const t = s.replace(/^(~|c\.|ca\.|about|around)\s*/i, '');
    const pt = parseTst(t) || parseEarth(t);
    if (pt) pt.approx = approx;
    return pt;
  }
  const splitWhen = (when) => String(when || '').split(/\s*(?:→|->|–(?=\s))\s*/);
  function parseWhen(when){
    const parts = splitWhen(when);
    const a = parsePoint(parts[0]);
    const b = parts.length > 1 ? parsePoint(parts.slice(1).join(' ')) : null;
    return { start: a && a.kind === 'time' ? a : null, end: b, startRaw: parts[0].trim() };
  }
  function whenLabel(when){
    const parts = splitWhen(when);
    return parts.map(p => {
      const pt = parsePoint(p);
      if (!pt || pt.kind !== 'time') return p.trim();
      if (S.mode === 'earth' && pt.cal === 'earth') return p.trim();
      return fmtPoint(pt, S.mode);
    }).join(' → ');
  }
  function describe(pt){
    if (!pt) return '';
    if (pt.kind === 'time') return fmtPoint(pt, S.mode) + '  ·  ' + fmtPoint(pt, S.mode === 'tst' ? 'earth' : 'tst');
    if (pt.atEnd) return 'the end of Book ' + ROMAN[Math.min(3, pt.book)];
    const b = pt.book, ch = Math.round(pt.s - (b - 1) * 27 + 0.5);
    return 'Book ' + ROMAN[b] + (pt.chKnown ? ' · chapter ' + Math.min(27, Math.max(1, ch)) : ' · chapter not set');
  }
  function calFrom(t, folder, n){
    const p = t.split('|').map(x => x.trim());
    return { name: p[0], color: (p[1] && /^#[0-9a-f]{3,8}$/i.test(p[1])) ? p[1] : PALETTE[n % PALETTE.length], folder };
  }
  function blankEvent(){ return { when: '?', title: '', desc: '', chapter: '', sources: '', open: false, question: '', cals: [] }; }
  function parseEventLine(text){
    const p = text.split('|').map(x => x.trim());
    const e = blankEvent();
    if (p.length >= 5 && /^calendars?\s*:/i.test(p[p.length - 1])){
      e.when = p[0]; e.title = p.slice(1, p.length - 3).join(' / '); e.sources = p[p.length - 3];
      const om = p[p.length - 2].match(/^open\s*:?\s*(.*)$/i); if (om){ e.open = true; e.question = om[1].trim(); }
      e.cals = p[p.length - 1].replace(/^calendars?\s*:\s*/i, '').split(',').map(x => x.trim()).filter(Boolean);
    } else {
      e.when = p[0] || '?'; e.title = p[1] || '';
      const c = p.slice(2).find(x => /^calendars?\s*:/i.test(x));
      if (c) e.cals = c.replace(/^calendars?\s*:\s*/i, '').split(',').map(x => x.trim()).filter(Boolean);
    }
    const parts = splitWhen(e.when), st = parseStory(parts[0]);
    if (st && parts.length === 1){ e.chapter = parts[0].trim(); e.when = '?'; }
    return e;
  }
  function applySub(e, t){
    let m;
    if ((m = t.match(/^chapter\s*:\s*(.*)$/i))) e.chapter = m[1].trim();
    else if ((m = t.match(/^open(?:\s*:\s*(.*))?$/i))){ e.open = true; e.question = (m[1] || '').trim(); }
    else if ((m = t.match(/^sources?\s*:\s*(.*)$/i))) e.sources = m[1].trim();
    else e.desc = e.desc ? e.desc + ' ' + t : t;
  }
  function parseNote(md){
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const doc = { head: [], settings: {}, calendars: [], folders: [], eras: [], events: [], extra: [], footer: [] };
    let sec = null, low = '', folder = null, ev = null, order = 0;
    for (const raw of lines){
      const line = raw.replace(/\s+$/, '');
      const h = line.match(/^##\s+(.+)$/);
      if (h){ sec = h[1].trim(); low = sec.toLowerCase(); folder = null; ev = null; if (!KNOWN.test(low)) doc.extra.push({ name: sec, lines: [] }); continue; }
      if (sec === null){ doc.head.push(raw); continue; }
      if (/^Related:/.test(line)){ doc.footer.push(line); continue; }
      const m = line.match(/^(\s*)[-*]\s+(.*)$/), ind = m ? m[1].replace(/\t/g, '  ').length : 0;
      if (low === 'settings'){ if (m){ const p = m[2].split('|').map(x => x.trim()); if (p[0] && !/^story year$/i.test(p[0])) doc.settings[p[0]] = p.slice(1).join('|').trim(); } continue; }
      if (low === 'calendars'){
        if (!m) continue;
        const t = m[2].trim();
        if (ind === 0 && /\/$/.test(t)){ folder = t.replace(/\/\s*$/, '').trim(); if (folder && !doc.folders.includes(folder)) doc.folders.push(folder); continue; }
        if (ind === 0) folder = null;
        const c = calFrom(t, ind > 0 ? folder : null, doc.calendars.length);
        if (c.name && !doc.calendars.some(x => x.name === c.name)) doc.calendars.push(c);
        continue;
      }
      if (low === 'eras'){
        if (!m) continue;
        const p = m[2].split('|').map(x => x.trim()); if (!p[0]) continue;
        const col = p.slice(2).find(x => /^#[0-9a-f]{3,8}$/i.test(x)), bk = p.slice(2).find(x => /^book\s*:/i.test(x));
        doc.eras.push({ name: p[0], when: p[1] || '?', color: col || PALETTE[(doc.eras.length + 5) % PALETTE.length], book: bk ? bookNum('book ' + bk.replace(/^book\s*:\s*/i, '')) : 0 });
        continue;
      }
      if (low === 'events' || low === 'before the story' || low === 'the story'){
        if (!m) continue;
        if (ind === 0){ ev = parseEventLine(m[2]); ev.order = order++; doc.events.push(ev); }
        else if (ev) applySub(ev, m[2].trim());
        continue;
      }
      const x = doc.extra[doc.extra.length - 1]; if (x) x.lines.push(raw);
    }
    const known = new Set(doc.calendars.map(c => c.name));
    doc.events.forEach(e => e.cals.forEach(n => { if (!known.has(n)){ known.add(n); doc.calendars.push({ name: n, color: PALETTE[doc.calendars.length % PALETTE.length], folder: null }); } }));
    return doc;
  }
  function orderedCals(doc){
    doc = doc || S.doc;
    return doc.calendars.filter(c => !c.folder).concat(...doc.folders.map(f => doc.calendars.filter(c => c.folder === f)));
  }
  function serialize(doc){
    keyEvents(doc);
    const out = [];
    out.push(doc.head.length ? doc.head.join('\n').replace(/\s+$/, '') : NOTE_HEAD_FALLBACK.trim());
    const sk = Object.keys(doc.settings);
    if (sk.length){ out.push('', '## Settings'); sk.forEach(k => out.push('- ' + k + ' | ' + doc.settings[k])); }
    out.push('', '## Calendars');
    const calLine = (c, ind) => ind + '- ' + clean(c.name).replace(/,/g, ' ') + ' | ' + c.color;
    doc.calendars.filter(c => !c.folder).forEach(c => out.push(calLine(c, '')));
    doc.folders.forEach(f => { out.push('- ' + clean(f).replace(/\//g, ' ') + '/'); doc.calendars.filter(c => c.folder === f).forEach(c => out.push(calLine(c, '  '))); });
    if ((doc.eras || []).length){
      out.push('', '## Eras');
      doc.eras.forEach(er => out.push('- ' + [clean(er.name) || 'Era', clean(er.when) || '?', er.color].concat(er.book ? ['book: ' + ROMAN[er.book]] : []).join(' | ')));
    }
    out.push('', '## Events');
    doc.events.slice().sort((a, b) => a._key - b._key).forEach(e => {
      out.push('- ' + [clean(e.when) || '?', clean(e.title) || '(untitled)', 'calendars: ' + e.cals.map(clean).join(', ')].join(' | '));
      if (clean(e.desc)) out.push('  - ' + clean(e.desc));
      if (clean(e.chapter)) out.push('  - Chapter: ' + clean(e.chapter));
      if (e.open) out.push('  - Open' + (clean(e.question) ? ': ' + clean(e.question) : ''));
      if (clean(e.sources)) out.push('  - Sources: ' + clean(e.sources));
    });
    doc.extra.forEach(x => { out.push('', '## ' + x.name); x.lines.forEach(l => out.push(l)); });
    if (doc.footer.length){ out.push(''); doc.footer.forEach(l => out.push(l)); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
  }
  function keyEvents(doc){
    doc = doc || S.doc;
    let last = -1e300, lastStory = null;
    doc.events.forEach(e => {
      e._w = parseWhen(e.when);
      e._ch = parseStory(e.chapter);
      if (e._ch && !e._ch.chKnown){
        const b0 = (e._ch.book - 1) * 27;
        e._ch.s = (lastStory != null && lastStory >= b0 && lastStory < b0 + 27) ? Math.min(b0 + 26.9, lastStory + 0.4) : b0 + 0.25;
      }
      if (e._w.start) e._key = e._w.start.u;
      else if (e._ch) e._key = 1e18 + (e._ch.s + 1) * 1e9;
      else e._key = last + 1e-6 * Math.max(1, Math.abs(last));
      if (e._ch) lastStory = e._ch.s;
      last = e._key;
    });
  }
  const YR = 31556952, MO = YR / 12, DY = 86400, HR = 3600, TICK_GAP = 96, PAD = 24;
  const V = { time: null, ch: null };
  function endU(pt){
    if (pt.cal === 'tst') return pt.u + Math.pow(10, -(pt.dec || 0)) * TST_CYC;
    const f = pt.f;
    if (pt.prec === 'year') return uOf({ y: f.y + 1, m: 1, d: 1 });
    if (pt.prec === 'month') return f.m === 12 ? uOf({ y: f.y + 1, m: 1, d: 1 }) : uOf({ y: f.y, m: f.m + 1, d: 1 });
    if (pt.prec === 'day') return pt.u + DY;
    return pt.u + 60;
  }
  function rangePoint(txt){ const pt = parsePoint(txt); return pt && pt.kind === 'time' ? pt : null; }
  function spanOf(text){
    const parts = splitWhen(text);
    const a = rangePoint(parts[0]), b = parts.length > 1 ? rangePoint(parts.slice(1).join(' ')) : a;
    if (!a || !b) return null;
    const lo = a.u, hi = endU(b);
    return hi > lo ? { lo, hi } : null;
  }
  const eraSpan = (er) => spanOf(er.when);
  function bookEra(b){ return (S.doc.eras || []).find(er => er.book === b && eraSpan(er)) || null; }
  function chU(st){
    if (!st || st.kind !== 'story') return null;
    const er = bookEra(st.book); if (!er) return null;
    const r = eraSpan(er), local = st.s - (st.book - 1) * 27;
    const f = Math.max(0, Math.min(1, (local + 0.5) / 28));
    return r.lo + f * (r.hi - r.lo);
  }
  function homeRange(){
    const a = S.doc.settings['View from'] || '', b = S.doc.settings['View to'] || '';
    if (!a || !b) return null;
    return spanOf(a + ' → ' + b);
  }
  function domainOf(e){
    if (S.chapters) return e._ch ? e._ch.s : null;
    if (e._w.start) return e._w.start.u;
    return e._ch ? chU(e._ch) : null;
  }
  function endOf(e){
    const pt = e._w.end; if (!pt) return null;
    if (S.chapters) return pt.kind === 'story' ? pt.s : null;
    if (pt.kind === 'time') return pt.u;
    if (pt.kind === 'story'){ const u = chU(pt); return u == null ? Infinity : u; }
    return null;
  }
  function view(){ return S.chapters ? V.ch : V.time; }
  function canvasW(){ return Math.max(300, $('tlCanvas').clientWidth); }
  const MIN_SPP = () => S.chapters ? 0.005 : 20;
  const MAX_SPP = () => S.chapters ? 0.5 : 300 * YR;
  function allTimes(){
    const out = [];
    S.doc.events.forEach(e => { const a = S.chapters ? null : domainOf(e); if (a != null) out.push(a); const b = S.chapters ? null : endOf(e); if (b != null && b !== Infinity) out.push(b); });
    (S.doc.eras || []).forEach(er => { const r = eraSpan(er); if (r){ out.push(r.lo, r.hi); } });
    return out;
  }
  function setView(lo, hi){
    const W = canvasW();
    if (S.chapters){ V.ch = { t0: lo, spp: (hi - lo) / W }; return; }
    if (hi - lo < 60) { const m = (lo + hi) / 2; lo = m - 1800; hi = m + 1800; }
    const spp = Math.max(MIN_SPP(), Math.min(MAX_SPP(), (hi - lo) / Math.max(200, W - 2 * PAD)));
    V.time = { t0: (lo + hi) / 2 - spp * W / 2, spp };
    S.laneH = {};
  }
  function fitView(){
    if (S.chapters){ V.ch = { t0: -1.5, spp: 84 / canvasW() }; S.laneH = {}; return; }
    const r = homeRange(); if (r){ setView(r.lo, r.hi); return; }
    fitAll();
  }
  function fitAll(){
    const t = allTimes();
    if (!t.length){ const now = Date.now() / 1000; setView(now - 50 * YR, now); return; }
    let lo = Math.min(...t), hi = Math.max(...t);
    if (hi - lo < YR){ const m = (lo + hi) / 2; lo = m - YR / 2; hi = m + YR / 2; }
    setView(lo, hi);
  }
  const xOfV = (v) => (v - view().t0) / view().spp;
  function zoomToRange(lo, hi){
    const W = canvasW(), span = Math.max(hi - lo, MIN_SPP() * 200);
    const spp = Math.max(MIN_SPP(), span / (W * 0.7));
    view().spp = spp; view().t0 = (lo + hi) / 2 - spp * W / 2; S.laneH = {}; scheduleCanvas();
  }
  function focusOn(u, prec){
    const W = canvasW();
    const per = { year: 40 * YR, month: 2 * YR, day: 60 * DY, minute: 2 * DY }[prec || 'year'] || 40 * YR;
    const spp = Math.max(MIN_SPP(), per / W);
    view().spp = spp; view().t0 = u - spp * W / 2; S.laneH = {}; scheduleCanvas();
  }
  function zoomAt(factor, px){
    const vw = view(); const at = vw.t0 + px * vw.spp;
    const spp = Math.max(MIN_SPP(), Math.min(MAX_SPP(), vw.spp / factor));
    vw.t0 = at - px * spp; vw.spp = spp;
    scheduleCanvas();
  }
  function panBy(dx){ const vw = view(); vw.t0 += dx * vw.spp; scheduleCanvas(); }
  let _raf = 0;
  function scheduleCanvas(){ if (_raf) return; _raf = requestAnimationFrame(() => { _raf = 0; renderCanvas(); }); }
  function ticks(){
    const vw = view(), W = canvasW(), t0 = vw.t0, t1 = vw.t0 + W * vw.spp, out = [];
    const push = (v, label, major) => { const x = (v - t0) / vw.spp; if (x > 92 && x < W - 30) out.push({ x, label, major }); };
    if (S.chapters){
      const step = vw.spp < 1 / 40 ? 1 : vw.spp * 3 < 1 / 30 ? 3 : 9;
      for (let ch = 1; ch <= 81; ch++){
        const b = Math.floor((ch - 1) / 27) + 1, local = ch - (b - 1) * 27;
        if (local !== 1 && (local - 1) % step) continue;
        push(ch - 1, local === 1 ? 'Book ' + ROMAN[b] : 'Ch ' + local, local === 1);
      }
      return out;
    }
    if (S.mode === 'tst'){
      const a = tstOf(t0), b = tstOf(t1);
      const steps = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 5e-4, 2e-4, 1e-4, 5e-5, 2e-5, 1e-5, 5e-6, 2e-6, 1e-6];
      let st = steps[0];
      for (let i = steps.length - 1; i >= 0; i--){ if (steps[i] * TST_CYC / vw.spp >= TICK_GAP){ st = steps[i]; break; } }
      const dec = Math.max(0, -Math.floor(Math.log10(st) + 1e-9));
      for (let n = Math.ceil(a / st); n <= Math.floor(b / st); n++) push(uOfTst(n * st), (n * st).toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' TST');
      return out;
    }
    const units = [];
    [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1].forEach(k => units.push(['y', k, k * YR]));
    [6, 3, 1].forEach(k => units.push(['m', k, k * MO]));
    [10, 5, 2, 1].forEach(k => units.push(['d', k, k * DY]));
    [12, 6, 3, 1].forEach(k => units.push(['h', k, k * HR]));
    let u = units[0];
    for (let i = units.length - 1; i >= 0; i--){ if (units[i][2] / vw.spp >= TICK_GAP){ u = units[i]; break; } }
    const [kind, k] = u, fa = fieldsOf(t0), fb = fieldsOf(t1);
    let first = true;
    if (kind === 'y'){
      for (let ay = fa.y; ay <= fb.y + 1; ay++){ const shown = ay <= 0 ? 1 - ay : ay; if (shown % k) continue; push(uOf({ y: ay, m: 1, d: 1 }), yearLabel(ay, ay < 1000 || ay >= 10000)); }
    } else if (kind === 'm'){
      for (let ay = fa.y; ay <= fb.y; ay++) for (let m = 1; m <= 12; m++){
        if ((m - 1) % k) continue;
        const v = uOf({ y: ay, m, d: 1 }); if (v < t0 - MO) continue; if (v > t1 + MO) break;
        push(v, MON3[m - 1] + (m === 1 || first ? ' ' + yearLabel(ay, false) : ''), m === 1); first = false;
      }
    } else if (kind === 'd'){
      for (let dd = Math.floor(t0 / DY); dd <= Math.ceil(t1 / DY); dd++){
        const f = civilFromDays(dd); if (k > 1 && ((f.d - 1) % k || f.d > 28 && k >= 5)) continue;
        push(dd * DY, f.d + ' ' + MON3[f.m - 1] + (first || (f.d === 1 && f.m === 1) ? ' ' + yearLabel(f.y, false) : ''), f.d === 1); first = false;
      }
    } else {
      for (let hh = Math.floor(t0 / HR); hh <= Math.ceil(t1 / HR); hh++){
        const h = ((hh % 24) + 24) % 24; if (h % k) continue;
        const f = civilFromDays(Math.floor(hh / 24));
        push(hh * HR, pad2(h) + ':00' + (first || h === 0 ? '  ' + f.d + ' ' + MON3[f.m - 1] + ' ' + yearLabel(f.y, false) : ''), h === 0); first = false;
      }
    }
    return out;
  }
  function overviewMap(){
    const pts = [...new Set(allTimes())].sort((a, b) => a - b);
    if (!pts.length) return null;
    const lo = pts[0], hi = pts[pts.length - 1], n = pts.length;
    const W = canvasW(), x0 = 10, x1 = W - 10;
    if (hi <= lo){ const f = () => (x0 + x1) / 2; return { f, inv: () => lo, lo, hi }; }
    const pos = pts.map((u, i) => 0.6 * (n > 1 ? i / (n - 1) : 0.5) + 0.4 * (u - lo) / (hi - lo));
    const X = (p) => x0 + p * (x1 - x0);
    const f = (u) => {
      if (u <= lo) return X(0) - (lo - u) / (hi - lo) * 0.4 * (x1 - x0);
      if (u >= hi) return X(1) + (u - hi) / (hi - lo) * 0.4 * (x1 - x0);
      let i = 1; while (i < n - 1 && pts[i] < u) i++;
      const a = pts[i - 1], b = pts[i], t = b > a ? (u - a) / (b - a) : 0;
      return X(pos[i - 1] + t * (pos[i] - pos[i - 1]));
    };
    const inv = (x) => {
      const p = (x - x0) / (x1 - x0);
      if (p <= 0) return lo - (-p) / 0.4 * (hi - lo);
      if (p >= 1) return hi + (p - 1) / 0.4 * (hi - lo);
      let i = 1; while (i < n - 1 && pos[i] < p) i++;
      const a = pos[i - 1], b = pos[i], t = b > a ? (p - a) / (b - a) : 0;
      return pts[i - 1] + t * (pts[i] - pts[i - 1]);
    };
    return { f, inv, lo, hi };
  }
  function renderOverview(){
    const ov = $('tlOver'); ov.hidden = S.chapters;
    if (S.chapters) return;
    const M = overviewMap(); S.ovMap = M;
    ov.innerHTML = '';
    if (!M) return;
    (S.doc.eras || []).forEach(er => {
      const r = eraSpan(er); if (!r) return;
      const a = M.f(r.lo), b = Math.max(M.f(r.hi), a + 3);
      const band = el('button', 'tl-ov-era'); band.style.left = a + 'px'; band.style.width = (b - a) + 'px'; band.style.setProperty('--c', er.color);
      band.title = er.name + ' · click to go there';
      if (b - a > 40) band.textContent = er.name;
      band.onmousedown = (ev) => ev.stopPropagation();
      band.onclick = (ev) => { ev.stopPropagation(); zoomToRange(r.lo, r.hi); };
      ov.appendChild(band);
    });
    S.doc.events.forEach(e => {
      const u = domainOf(e); if (u == null) return;
      const c = homeCal(e);
      const t = el('span', 'tl-ov-ev'); t.style.left = M.f(u) + 'px'; t.style.background = c ? c.color : '#625a4a';
      ov.appendChild(t);
    });
    const vw = view(), W = canvasW();
    const a = M.f(vw.t0), b = M.f(vw.t0 + W * vw.spp);
    const win = el('div', 'tl-ov-win'); win.style.left = Math.max(-4, a) + 'px'; win.style.width = Math.max(8, Math.min(W + 8, b) - Math.max(-4, a)) + 'px';
    ov.appendChild(win);
  }
  function render(){
    if (!S.doc) return;
    keyEvents();
    renderSide(); renderEras(); renderTop(); renderCanvas(); renderInspector(); renderStatus();
  }
  function renderRange(){
    const a = S.doc.settings['View from'] || '', b = S.doc.settings['View to'] || '';
    const act = document.activeElement;
    if (act !== $('tlFrom')) $('tlFrom').value = a; if (act !== $('tlTo')) $('tlTo').value = b;
    const pa = a ? rangePoint(a) : null, pb = b ? rangePoint(b) : null, r = homeRange();
    let hint;
    if (!a && !b) hint = 'Empty: the timeline opens on everything.';
    else if ((a && !pa) || (b && !pb)) hint = 'Write a date, like 10,000 BC or AD 2100.';
    else if (!r) hint = a && b ? 'The last date has to come after the first.' : 'Set both to use a range.';
    else hint = 'Opens on ' + fmtPoint(pa, S.mode) + ' to ' + fmtPoint(pb, S.mode) + '. Home goes back here.';
    $('tlRangeHint').textContent = hint;
  }
  function renderTop(){
    renderRange();
    $('tlModeEarth').classList.toggle('on', S.mode === 'earth'); $('tlModeTst').classList.toggle('on', S.mode === 'tst');
    $('tlChapters').classList.toggle('on', S.chapters);
    $('tlChapters').title = S.chapters ? 'Back to the timeline' : 'Lay the events out by chapter instead of by date';
    const es = $('tlEraGo'), esig = (S.doc.eras || []).map(er => er.name + er.when).join('|');
    if (es.dataset.sig !== esig){
      es.dataset.sig = esig; es.innerHTML = '';
      const o0 = el('option', null, 'Era…'); o0.value = ''; es.appendChild(o0);
      (S.doc.eras || []).forEach((er, i) => { if (!eraSpan(er)) return; const o = el('option', null, er.name); o.value = String(i); es.appendChild(o); });
    }
    es.hidden = !(S.doc.eras || []).some(er => eraSpan(er));
  }
  function goTo(q){
    q = String(q || '').trim(); if (!q) return false;
    const low = q.toLowerCase();
    if (S.chapters){ S.chapters = false; LS.set('tl.chapters', '0'); }
    const ev = S.doc.events.find(e => (e.title || '').toLowerCase() === low) || S.doc.events.find(e => (e.title || '').toLowerCase().includes(low));
    if (ev){ S.sel = ev; const u = domainOf(ev); if (u != null) focusOn(u, ev._w.start ? (ev._w.start.prec || precFor(ev._w.start.dec)) : 'month'); render(); return true; }
    return false;
  }
  function renderEras(){
    const n = (S.doc.eras || []).length;
    $('tlErasN').textContent = n ? String(n) : '';
    $('tlErasChev').innerHTML = icon(S.erasOpen ? 'chevron-down' : 'chevron-right', 12);
    $('tlErasBody').hidden = !S.erasOpen;
    const list = $('tlEras'); list.innerHTML = '';
    (S.doc.eras || []).forEach(er => {
      const wrap = el('div', 'tl-cal-wrap');
      const row = el('div', 'tl-era' + (S.editEra === er ? ' editing' : ''));
      const sw = el('span', 'tl-era-sw'); sw.style.background = er.color;
      const name = el('button', 'tl-cal-name', er.name); name.title = 'Edit this era';
      name.onclick = () => { S.editEra = S.editEra === er ? null : er; renderEras(); if (S.editEra) setTimeout(() => { const i = $('tlEraName'); if (i){ i.focus(); i.select(); } }, 0); };
      const go = el('button', 'tl-era-go'); go.innerHTML = icon('chevron-right', 14); go.title = 'Go to ' + er.name;
      go.disabled = !eraSpan(er);
      go.onclick = () => { const r = eraSpan(er); if (r){ if (S.chapters){ S.chapters = false; LS.set('tl.chapters', '0'); render(); } zoomToRange(r.lo, r.hi); } };
      row.append(sw, name, go);
      wrap.appendChild(row);
      if (S.editEra === er) wrap.appendChild(eraEditor(er));
      list.appendChild(wrap);
    });
    if (!(S.doc.eras || []).length) list.appendChild(el('div', 'tl-fold-empty', 'Name a stretch of time to jump to it.'));
  }
  function eraEditor(er){
    const box = el('div', 'tl-cal-ed');
    const nm = el('input'); nm.id = 'tlEraName'; nm.value = er.name; nm.placeholder = 'Name';
    nm.oninput = () => { const v = clean(nm.value); if (v){ er.name = v; markDirty(); renderCanvas(); } };
    nm.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === 'Escape'){ S.editEra = null; renderEras(); } };
    const wh = el('input'); wh.value = er.when === '?' ? '' : er.when; wh.placeholder = 'From → to, e.g. 1650 BC → 1500 BC';
    const hint = el('div', 'tl-range-hint');
    const showHint = () => { const r = eraSpan(er); hint.textContent = r ? fmtPoint(rangePoint(splitWhen(er.when)[0]), S.mode) + ' to the end of ' + fmtPoint(rangePoint(splitWhen(er.when).slice(-1)[0]), S.mode) : 'Write a date, or two joined by →. One date spans its whole year, month or day.'; };
    wh.oninput = () => { er.when = clean(wh.value) || '?'; markDirty(); showHint(); renderCanvas(); };
    showHint();
    const bk = el('select'); bk.title = 'Chapter-only events of this book are placed inside this era';
    [[0, 'Not a book'], [1, 'Book I'], [2, 'Book II'], [3, 'Book III']].forEach(([v, t]) => { const o = el('option', null, t); o.value = String(v); if ((er.book || 0) === v) o.selected = true; bk.appendChild(o); });
    bk.onchange = () => { er.book = +bk.value || 0; markDirty(); render(); };
    const bkl = el('label', 'tl-era-book'); bkl.append(el('span', null, 'Book'), bk);
    const sw = el('div', 'tl-swatches');
    PALETTE.forEach(col => { const b = el('button', 'tl-sw' + (col.toLowerCase() === String(er.color).toLowerCase() ? ' on' : '')); b.style.background = col; b.onclick = () => { er.color = col; markDirty(); render(); }; sw.appendChild(b); });
    const custom = el('label', 'tl-sw tl-sw-custom'); const ci = el('input'); ci.type = 'color'; ci.value = /^#[0-9a-f]{6}$/i.test(er.color) ? er.color : '#d9a52e';
    ci.onchange = () => { er.color = ci.value; markDirty(); render(); }; custom.appendChild(ci); sw.appendChild(custom);
    const act = el('div', 'tl-cal-act');
    const del = el('button', 'tl-mini danger', 'Delete');
    del.onclick = () => {
      if (!del.dataset.armed){ del.dataset.armed = '1'; del.textContent = 'Click again: the events stay'; return; }
      S.doc.eras.splice(S.doc.eras.indexOf(er), 1); S.editEra = null; markDirty(); render();
    };
    const done = el('button', 'tl-mini', 'Done'); done.onclick = () => { S.editEra = null; renderEras(); };
    act.append(el('span', 'tl-grow'), del, done);
    box.append(nm, wh, hint, bkl, sw, act);
    return box;
  }
  function addEra(fromView){
    if (S.lock) return;
    let when = '?';
    if (fromView && !S.chapters){
      const vw = view(), W = canvasW(), a = fieldsOf(vw.t0), b = fieldsOf(vw.t0 + W * vw.spp);
      const pr = vw.spp * W > 30 * YR ? 'year' : vw.spp * W > 90 * DY ? 'month' : 'day';
      when = earthText(a, pr, false) + ' → ' + earthText(b, pr, false);
    }
    let n = 1, name = 'New era'; while ((S.doc.eras || []).some(x => x.name === name)) name = 'New era ' + (++n);
    const er = { name, when, color: PALETTE[(S.doc.eras || []).length % PALETTE.length], book: 0 };
    (S.doc.eras = S.doc.eras || []).push(er); S.editEra = er; S.erasOpen = true; LS.set('tl.eras.open', '1'); markDirty(); render();
    setTimeout(() => { const i = $('tlEraName'); if (i){ i.focus(); i.select(); } }, 0);
  }
  function persistHidden(){ LS.set('tl.hidden', JSON.stringify([...S.hidden])); }
  function persistClosed(){ LS.set('tl.folders.closed', JSON.stringify([...S.closed])); }
  function renderSide(){
    const tree = $('tlCals'); tree.innerHTML = '';
    const counts = {}; S.doc.events.forEach(e => e.cals.forEach(n => counts[n] = (counts[n] || 0) + 1));
    S.doc.calendars.filter(c => !c.folder).forEach(c => tree.appendChild(calRow(c, counts)));
    S.doc.folders.forEach(f => {
      const members = S.doc.calendars.filter(c => c.folder === f);
      tree.appendChild(folderRow(f, members));
      if (!S.closed.has(f)){
        const box = el('div', 'tl-fold-kids');
        members.forEach(c => box.appendChild(calRow(c, counts)));
        if (!members.length) box.appendChild(el('div', 'tl-fold-empty', 'Drag calendars here'));
        tree.appendChild(box);
      }
    });
    tree.ondragover = (ev) => { if (S.drag) ev.preventDefault(); };
    tree.ondrop = (ev) => { if (ev.target === tree && S.drag){ ev.preventDefault(); moveCal(S.drag, null, null); } };
  }
  function calRow(c, counts){
    const wrap = el('div', 'tl-cal-wrap');
    const row = el('div', 'tl-cal' + (S.hidden.has(c.name) ? ' off' : '') + (S.editCal === c ? ' editing' : ''));
    row.draggable = true;
    row.ondragstart = (ev) => { S.drag = c; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', c.name); } catch (e) {} row.classList.add('dragging'); };
    row.ondragend = () => { S.drag = null; row.classList.remove('dragging'); };
    row.ondragover = (ev) => { if (S.drag && S.drag !== c){ ev.preventDefault(); row.classList.add('drop'); } };
    row.ondragleave = () => row.classList.remove('drop');
    row.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); row.classList.remove('drop'); if (S.drag && S.drag !== c) moveCal(S.drag, c.folder, c); };
    const tog = el('button', 'tl-cal-tog'); tog.title = S.hidden.has(c.name) ? 'Show on the timeline' : 'Hide from the timeline';
    tog.style.setProperty('--c', c.color);
    tog.onclick = (ev) => { ev.stopPropagation(); S.hidden.has(c.name) ? S.hidden.delete(c.name) : S.hidden.add(c.name); persistHidden(); render(); };
    const name = el('button', 'tl-cal-name', c.name); name.title = 'Edit this calendar';
    name.onclick = () => { S.editCal = S.editCal === c ? null : c; S.editFolder = null; renderSide(); if (S.editCal) setTimeout(() => { const i = $('tlCalName'); if (i){ i.focus(); i.select(); } }, 0); };
    const n = el('span', 'tl-cal-n', String(counts[c.name] || 0));
    row.append(tog, name, n);
    wrap.appendChild(row);
    if (S.editCal === c) wrap.appendChild(calEditor(c));
    return wrap;
  }
  function calEditor(c){
    const box = el('div', 'tl-cal-ed');
    const nm = el('input'); nm.id = 'tlCalName'; nm.value = c.name; nm.placeholder = 'Name';
    const commit = () => {
      const v = clean(nm.value).replace(/,/g, ' ').replace(/\/$/, '').trim();
      if (v && v !== c.name && !S.doc.calendars.some(x => x.name === v)){
        S.doc.events.forEach(e => { e.cals = e.cals.map(n => n === c.name ? v : n); });
        if (S.hidden.has(c.name)){ S.hidden.delete(c.name); S.hidden.add(v); persistHidden(); }
        c.name = v; markDirty(); render();
      }
    };
    nm.onkeydown = (ev) => { if (ev.key === 'Enter'){ commit(); S.editCal = null; renderSide(); } if (ev.key === 'Escape'){ S.editCal = null; renderSide(); } };
    nm.onblur = commit;
    const sw = el('div', 'tl-swatches');
    PALETTE.forEach(col => {
      const b = el('button', 'tl-sw' + (col.toLowerCase() === String(c.color).toLowerCase() ? ' on' : '')); b.style.background = col; b.title = col;
      b.onclick = () => { c.color = col; markDirty(); render(); };
      sw.appendChild(b);
    });
    const custom = el('label', 'tl-sw tl-sw-custom'); custom.title = 'Any colour';
    const ci = el('input'); ci.type = 'color'; ci.value = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#d9a52e';
    ci.onchange = () => { c.color = ci.value; markDirty(); render(); };
    custom.appendChild(ci); sw.appendChild(custom);
    const fs = el('select'); fs.title = 'Folder';
    [['', 'No folder']].concat(S.doc.folders.map(f => [f, f])).forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if ((c.folder || '') === v) o.selected = true; fs.appendChild(o); });
    fs.onchange = () => moveCal(c, fs.value || null, null);
    const act = el('div', 'tl-cal-act');
    const del = el('button', 'tl-mini danger', 'Delete');
    del.onclick = () => {
      if (!del.dataset.armed){ del.dataset.armed = '1'; del.textContent = 'Click again: events stay, only the calendar goes'; return; }
      S.doc.calendars.splice(S.doc.calendars.indexOf(c), 1);
      S.doc.events.forEach(e => { e.cals = e.cals.filter(n => n !== c.name); });
      S.hidden.delete(c.name); persistHidden(); S.editCal = null; markDirty(); render();
    };
    const done = el('button', 'tl-mini', 'Done'); done.onclick = () => { commit(); S.editCal = null; renderSide(); };
    act.append(fs, el('span', 'tl-grow'), del, done);
    box.append(nm, sw, act);
    return box;
  }
  function folderRow(f, members){
    const wrap = el('div', 'tl-folder-wrap');
    const row = el('div', 'tl-folder' + (S.closed.has(f) ? ' closed' : ''));
    row.ondragover = (ev) => { if (S.drag){ ev.preventDefault(); row.classList.add('drop'); } };
    row.ondragleave = () => row.classList.remove('drop');
    row.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); row.classList.remove('drop'); if (S.drag) moveCal(S.drag, f, null); };
    const chev = el('button', 'tl-folder-chev'); chev.innerHTML = icon(S.closed.has(f) ? 'chevron-right' : 'chevron-down', 14);
    chev.title = S.closed.has(f) ? 'Open folder' : 'Close folder';
    chev.onclick = () => { S.closed.has(f) ? S.closed.delete(f) : S.closed.add(f); persistClosed(); renderSide(); };
    const shown = members.filter(c => !S.hidden.has(c.name)).length;
    const tog = el('button', 'tl-folder-tog' + (shown === 0 ? ' off' : shown < members.length ? ' some' : ''));
    tog.innerHTML = icon('folder', 15);
    tog.title = shown ? 'Hide everything in this folder' : 'Show everything in this folder';
    tog.onclick = () => { members.forEach(c => shown ? S.hidden.add(c.name) : S.hidden.delete(c.name)); persistHidden(); render(); };
    const name = el('button', 'tl-folder-name', f); name.title = 'Rename or delete this folder';
    name.onclick = () => { S.editFolder = S.editFolder === f ? null : f; S.editCal = null; renderSide(); if (S.editFolder) setTimeout(() => { const i = $('tlFolderName'); if (i){ i.focus(); i.select(); } }, 0); };
    row.append(chev, tog, name, el('span', 'tl-cal-n', String(members.length)));
    wrap.appendChild(row);
    if (S.editFolder === f){
      const box = el('div', 'tl-cal-ed');
      const nm = el('input'); nm.id = 'tlFolderName'; nm.value = f;
      const commit = () => {
        const v = clean(nm.value).replace(/\//g, ' ').trim();
        if (v && v !== f && !S.doc.folders.includes(v)){
          S.doc.folders[S.doc.folders.indexOf(f)] = v;
          S.doc.calendars.forEach(c => { if (c.folder === f) c.folder = v; });
          if (S.closed.has(f)){ S.closed.delete(f); S.closed.add(v); persistClosed(); }
          S.editFolder = v; markDirty();
        }
      };
      nm.onkeydown = (ev) => { if (ev.key === 'Enter'){ commit(); S.editFolder = null; renderSide(); } if (ev.key === 'Escape'){ S.editFolder = null; renderSide(); } };
      nm.onblur = commit;
      const act = el('div', 'tl-cal-act');
      const del = el('button', 'tl-mini danger', 'Delete folder');
      del.onclick = () => {
        if (!del.dataset.armed){ del.dataset.armed = '1'; del.textContent = 'Click again: its calendars stay'; return; }
        S.doc.calendars.forEach(c => { if (c.folder === f) c.folder = null; });
        S.doc.folders.splice(S.doc.folders.indexOf(f), 1); S.editFolder = null; markDirty(); render();
      };
      const done = el('button', 'tl-mini', 'Done'); done.onclick = () => { commit(); S.editFolder = null; renderSide(); };
      act.append(el('span', 'tl-grow'), del, done);
      box.append(nm, act); wrap.appendChild(box);
    }
    return wrap;
  }
  function moveCal(c, folder, before){
    const a = S.doc.calendars;
    a.splice(a.indexOf(c), 1);
    c.folder = folder || null;
    const i = before ? a.indexOf(before) : -1;
    if (i >= 0) a.splice(i, 0, c); else a.push(c);
    if (folder && S.closed.has(folder)){ S.closed.delete(folder); persistClosed(); }
    markDirty(); render();
  }
  function addCalendar(){
    if (S.lock) return;
    let n = 1, name = 'New calendar';
    while (S.doc.calendars.some(c => c.name === name)) name = 'New calendar ' + (++n);
    const c = { name, color: PALETTE[S.doc.calendars.length % PALETTE.length], folder: null };
    S.doc.calendars.push(c); S.editCal = c; S.editFolder = null; markDirty(); render();
    setTimeout(() => { const i = $('tlCalName'); if (i){ i.focus(); i.select(); } }, 0);
  }
  function addFolder(){
    if (S.lock) return;
    let n = 1, name = 'New folder';
    while (S.doc.folders.includes(name)) name = 'New folder ' + (++n);
    S.doc.folders.push(name); S.editFolder = name; S.editCal = null; markDirty(); render();
    setTimeout(() => { const i = $('tlFolderName'); if (i){ i.focus(); i.select(); } }, 0);
  }
  function placed(e){ return domainOf(e) != null; }
  function homeCal(e){
    const vis = orderedCals().filter(c => !S.hidden.has(c.name));
    return vis.find(c => e.cals.includes(c.name)) || null;
  }
  function renderCanvas(){
    if (!S.doc) return;
    if (!view()) fitView();
    S.laneH = S.laneH || {};
    const vw = view(), W = canvasW();
    const axis = $('tlAxis'), lanes = $('tlLanes'), bands = $('tlBands');
    $('tlInner').style.width = W + 'px';
    renderOverview();
    const tk = $('tlTicks'); tk.innerHTML = '';
    tk.appendChild(el('div', 'tl-axis-k', S.chapters ? 'Chapters' : (S.mode === 'tst' ? 'TST' : 'Earth · UTC')));
    ticks().forEach(t => { const d = el('div', 'tl-tick' + (t.major ? ' major' : ''), t.label); d.style.left = t.x + 'px'; tk.appendChild(d); });
    bands.innerHTML = '';
    if (!S.chapters) (S.doc.eras || []).forEach(er => {
      const r = eraSpan(er); if (!r) return;
      const a = xOfV(r.lo), b = xOfV(r.hi); if (b < 0 || a > W) return;
      const band = el('div', 'tl-era-band'); band.style.left = Math.max(-2, a) + 'px'; band.style.width = (Math.min(W + 2, b) - Math.max(-2, a)) + 'px'; band.style.setProperty('--c', er.color);
      if (b - a > 60){ const lab = el('span', 'tl-era-lab', er.name); band.appendChild(lab); }
      else band.title = er.name;
      bands.appendChild(band);
    });
    lanes.innerHTML = '';
    let top = 0;
    const laneList = orderedCals().filter(c => !S.hidden.has(c.name));
    const orphans = S.doc.events.filter(e => placed(e) && !homeCal(e) && (!e.cals.length || e.cals.every(n => S.hidden.has(n)) === false));
    const noCal = S.doc.events.filter(e => placed(e) && !e.cals.length);
    if (noCal.length) laneList.push({ name: 'No calendar', color: '#625a4a', orphan: true });
    laneList.forEach(c => {
      const evs = (c.orphan ? noCal : S.doc.events.filter(e => placed(e) && homeCal(e) === c))
        .map(e => { const x = xOfV(domainOf(e)); const xe = endOf(e); return { e, x, x2: xe == null ? null : (xe === Infinity ? W + 50 : xOfV(xe)) }; })
        .filter(it => (it.x2 != null ? it.x2 : it.x + BOX_W) > -BOX_W && it.x < W + 20)
        .sort((a, b) => a.x - b.x);
      evs.forEach(it => {
        if (it.x2 != null && it.x < 0) it.left = 0;
        else it.left = it.x + BOX_W > W - 6 ? Math.max(0, it.x - BOX_W) : it.x;
      });
      const canBundle = vw.spp > MIN_SPP() * 1.01;
      const draw = [], singles = [];
      evs.forEach(it => (it.x2 != null || it.e === S.sel) ? draw.push(it) : singles.push(it));
      let g = null; const groups = [];
      singles.sort((p, q) => p.left - q.left).forEach(it => { if (g && it.left < g.x0 + BOX_W + ROW_GAP){ g.items.push(it); } else { g = { x0: it.left, items: [it] }; groups.push(g); } });
      groups.forEach(gr => {
        if (canBundle && gr.items.length >= 3) draw.push({ chip: true, left: Math.min(gr.x0, W - BOX_W - 6), items: gr.items });
        else gr.items.forEach(it => draw.push(it));
      });
      draw.sort((p, q) => p.left - q.left);
      const rows = [];
      draw.forEach(it => { let r = rows.findIndex(end => end + ROW_GAP <= it.left); if (r < 0){ r = rows.length; rows.push(-1e9); } rows[r] = it.left + BOX_W; it.row = r; });
      const need = Math.max(1, rows.length) * (BOX_H + ROW_GAP + 6) + LANE_TOP + LANE_PAD;
      const h = Math.max(need, S.laneH[c.name] || 0); S.laneH[c.name] = h;
      const lane = el('div', 'tl-lane'); lane.style.top = top + 'px'; lane.style.height = h + 'px'; lane.style.setProperty('--c', c.color);
      const lab = el('div', 'tl-lane-lab'); lab.appendChild(el('span', 'tl-lane-dot')); lab.appendChild(el('span', '', c.name)); lane.appendChild(lab);
      draw.forEach(it => {
        const y = LANE_TOP + it.row * (BOX_H + ROW_GAP + 6);
        if (it.chip){
          const its = it.items.slice().sort((p, q) => domainOf(p.e) - domainOf(q.e));
          const f = its[0].e, l = its[its.length - 1].e;
          const lbl = (e) => boxWhen(e).split(' → ')[0];
          const bx = el('button', 'tl-box tl-bundle');
          bx.style.left = it.left + 'px'; bx.style.top = y + 'px';
          bx.title = its.map(p => lbl(p.e) + '  ' + (p.e.title || '(untitled)')).join('\n') + '\n\nClick to zoom in';
          bx.append(el('span', 'tl-box-when', lbl(f) === lbl(l) ? lbl(f) : lbl(f) + ' – ' + lbl(l)), el('span', 'tl-box-what', its.length + ' events'));
          bx.onclick = () => zoomToRange(domainOf(f), domainOf(l));
          lane.appendChild(bx);
          return;
        }
        const e = it.e;
        if (it.x2 != null && it.x2 > it.x + 4){
          const a = Math.max(it.x, -10), b = Math.min(it.x2, W + 10);
          const bar = el('div', 'tl-span' + (endOf(e) === Infinity ? ' onward' : '')); bar.style.left = a + 'px'; bar.style.width = (b - a) + 'px'; bar.style.top = (y + BOX_H + 2) + 'px'; lane.appendChild(bar);
        }
        const bx = el('button', 'tl-box' + (e.open ? ' open' : '') + (S.sel === e ? ' sel' : '') + (it.left < it.x ? ' flip' : '') + (!e._w.start && !S.chapters ? ' bych' : ''));
        bx.style.left = it.left + 'px'; bx.style.top = y + 'px';
        const when = boxWhen(e);
        bx.title = (e.title || '(untitled)') + '\n' + when + (e.desc ? '\n\n' + e.desc : '') + (e.open ? '\n\nOpen: ' + (e.question || 'yes') : '');
        const wl = el('span', 'tl-box-when', when + (e.open ? ' · open' : ''));
        const others = e.cals.filter(n => !c.orphan && n !== c.name).map(n => S.doc.calendars.find(x => x.name === n)).filter(Boolean);
        if (others.length){
          const dots = el('span', 'tl-box-dots'); dots.title = 'Also in: ' + others.map(x => x.name).join(', ');
          others.forEach(o => { const d = el('i'); d.style.background = o.color; dots.appendChild(d); });
          bx.appendChild(dots);
        }
        bx.append(wl, el('span', 'tl-box-what', e.title || '(untitled)'));
        bx.onclick = () => select(e);
        lane.appendChild(bx);
      });
      lanes.appendChild(lane);
      top += h;
    });
    lanes.style.height = top + 'px'; bands.style.height = top + 'px';
    $('tlEmpty').hidden = !!S.doc.events.length;
    $('tlNoLanes').hidden = !!laneList.length || !S.doc.events.length;
    renderTray();
  }
  function boxWhen(e){
    if (S.chapters) return e.chapter;
    if (e._w.start) return whenLabel(e.when);
    return e.chapter;
  }
  function renderTray(){
    const list = S.doc.events.filter(e => !placed(e)).sort((a, b) => a._key - b._key);
    const btn = $('tlTrayBtn');
    btn.textContent = (S.chapters ? 'No chapter' : 'No date') + ' · ' + list.length;
    btn.hidden = !list.length;
    btn.classList.toggle('on', S.trayOpen && !!list.length);
    const box = $('tlTray'); box.hidden = !S.trayOpen || !list.length;
    if (box.hidden) return;
    box.innerHTML = '';
    box.appendChild(el('div', 'tl-tray-h', S.chapters ? 'Not placed in a chapter yet' : 'Not on the timeline yet: give it a date, or a chapter in a book that has an era'));
    list.forEach(e => {
      const b = el('button', 'tl-tray-row' + (S.sel === e ? ' sel' : ''));
      const c = S.doc.calendars.find(x => e.cals.includes(x.name));
      b.style.setProperty('--c', c ? c.color : '#625a4a');
      b.append(el('span', 'tl-tray-dot'), el('span', 'tl-tray-t', e.title || '(untitled)'), el('span', 'tl-tray-s', [S.chapters ? whenLabel(e.when) : e.chapter, e.open ? 'open' : ''].filter(x => x && x !== '?').join(' · ')));
      b.onclick = () => select(e);
      box.appendChild(b);
    });
  }
  function reveal(e){
    const v = domainOf(e); if (v == null) return;
    const x = xOfV(v), W = canvasW();
    if (x < 40 || x > W - BOX_W - 40){ view().t0 = v - (W / 2) * view().spp; scheduleCanvas(); }
  }
  function select(e){ S.sel = e; render(); if (e) reveal(e); if (e && !e.title) setTimeout(() => $('tlFTitle').focus(), 0); }
  function renderInspector(){
    const ins = $('tlInspector'), e = S.sel;
    ins.hidden = !e;
    if (!e) return;
    const act = document.activeElement, set = (id, v) => { const f = $(id); if (act !== f) f.value = v; };
    set('tlFTitle', e.title); set('tlFWhen', e.when === '?' ? '' : e.when); set('tlFChapter', e.chapter); set('tlFDesc', e.desc); set('tlFQ', e.question);
    const w = e._w || parseWhen(e.when);
    let hint = '';
    if (w.start) hint = describe(w.start) + (w.end ? '  →  ' + (w.end.kind === 'time' ? fmtPoint(w.end, S.mode) : describe(w.end)) : '');
    else if (w.startRaw && w.startRaw !== '?') hint = parseStory(w.startRaw) ? 'That is a chapter: put it under Chapter, the date stays open.' : 'Not a date the timeline can read: the event waits under "No date".';
    $('tlFWhenHint').textContent = hint;
    $('tlFWhenHint').hidden = !hint;
    const ch = parseStory(e.chapter);
    $('tlFChHint').textContent = e.chapter.trim() ? (ch ? describe(ch) : 'Write it like "Book I · Ch 3" or "end of Book I".') : '';
    $('tlFChHint').hidden = !e.chapter.trim();
    renderDateFields(e, w);
    $('tlFStated').classList.toggle('on', !e.open); $('tlFOpen').classList.toggle('on', e.open);
    $('tlFQ').hidden = !e.open;
    const names = e.cals.length ? e.cals : [];
    $('tlFCalsSum').textContent = names.length ? (names.length <= 2 ? names.join(', ') : names.slice(0, 2).join(', ') + ' +' + (names.length - 2)) : 'none';
    $('tlFCalsHead').classList.toggle('on', S.calsOpen);
    $('tlFCalsChev').innerHTML = icon(S.calsOpen ? 'chevron-down' : 'chevron-right', 14);
    const chips = $('tlFCals'); chips.hidden = !S.calsOpen; chips.innerHTML = '';
    if (S.calsOpen){
      const chip = (c) => {
        const on = e.cals.includes(c.name);
        const b = el('button', 'tl-chip' + (on ? ' on' : ''), c.name); b.style.setProperty('--c', c.color);
        b.onclick = () => { e.cals = on ? e.cals.filter(n => n !== c.name) : e.cals.concat(c.name); markDirty(); render(); };
        return b;
      };
      const loose = S.doc.calendars.filter(c => !c.folder);
      if (loose.length){ const g = el('div', 'tl-chipgrp'); loose.forEach(c => g.appendChild(chip(c))); chips.appendChild(g); }
      S.doc.folders.forEach(f => {
        const m = S.doc.calendars.filter(c => c.folder === f); if (!m.length) return;
        chips.appendChild(el('div', 'tl-chiph', f));
        const g = el('div', 'tl-chipgrp'); m.forEach(c => g.appendChild(chip(c))); chips.appendChild(g);
      });
    }
    const links = $('tlFLinks'); links.innerHTML = '';
    (e.sources.match(/\[\[[^\]]+\]\]/g) || []).forEach(m => {
      const title = m.slice(2, -2).split('|')[0].trim();
      const chipEl = el('span', 'tl-link-chip');
      const open = el('button', 'tl-link-open', title.replace(/^(?:Evrynthing|eV) - /, '')); open.title = 'Read ' + title; open.onclick = () => openNote(title);
      const x = el('button', 'tl-link-x'); x.innerHTML = icon('close', 11); x.title = 'Remove this link';
      x.onclick = () => { e.sources = e.sources.split(/\s*·\s*/).filter(s => s.trim() && s.trim() !== m).join(' · '); markDirty(); renderInspector(); };
      chipEl.append(open, x); links.appendChild(chipEl);
    });
    const del = $('tlFDelete'); del.textContent = 'Delete event'; del.dataset.armed = '';
  }
  function renderDateFields(e, w){
    const st = w.start;
    $('tlFEarth').hidden = S.mode !== 'earth'; $('tlFTst').hidden = S.mode !== 'tst';
    const act = document.activeElement, set = (id, v) => { const f = $(id); if (act !== f) f.value = v; };
    $('tlFApprox').checked = !!(st && st.approx);
    if (S.mode === 'tst'){
      set('tlFCycle', st ? String(st.cal === 'tst' ? st.tst : +tstOf(st.u).toFixed(decFor(st.prec))) : '');
      return;
    }
    const f = st ? (st.cal === 'earth' ? st.f : fieldsOf(st.u)) : null;
    const prec = st ? (st.cal === 'earth' ? st.prec : precFor(st.dec)) : null;
    const r = prec ? PREC_RANK[prec] : -1;
    set('tlFYear', f ? String(f.y <= 0 ? 1 - f.y : f.y) : '');
    if (f) set('tlFEra', f.y <= 0 ? 'BC' : 'AD');
    set('tlFMonth', f && r >= 1 ? String(f.m) : '');
    set('tlFDay', f && r >= 2 ? String(f.d) : '');
    set('tlFTime', f && r >= 3 ? pad2(f.h) + ':' + pad2(f.mi) : '');
  }
  function fromDateFields(){
    const e = S.sel; if (!e) return;
    const approx = $('tlFApprox').checked;
    let txt = null;
    if (S.mode === 'tst'){
      const v = $('tlFCycle').value.trim().replace(/,/g, '');
      if (!v) txt = '?';
      else if (/^-?\d+(\.\d+)?$/.test(v)) txt = tstText(parseFloat(v), (v.split('.')[1] || '').length, approx);
    } else {
      const yv = $('tlFYear').value.trim().replace(/[, ]/g, ''), era = $('tlFEra').value;
      const m = +$('tlFMonth').value || 0, d = +$('tlFDay').value || 0, tm = $('tlFTime').value.trim();
      if (!yv && !m && !d && !tm) txt = '?';
      else if (/^\d+$/.test(yv) && +yv > 0){
        const ay = era === 'BC' ? 1 - (+yv) : +yv, tmm = tm.match(/^(\d{1,2})[:.](\d{2})$/);
        let prec = 'year';
        if (m){ prec = 'month'; if (d >= 1 && d <= 31 && civilFromDays(daysFromCivil(ay, m, d)).m === m){ prec = 'day'; if (tmm && +tmm[1] < 24 && +tmm[2] < 60) prec = 'minute'; } }
        txt = earthText({ y: ay, m, d, h: tmm ? +tmm[1] : 0, mi: tmm ? +tmm[2] : 0 }, prec, approx);
      }
    }
    if (txt == null) return;
    const parts = splitWhen(e.when);
    e.when = parts.length > 1 && txt !== '?' ? txt + ' → ' + parts.slice(1).join(' → ') : txt;
    $('tlFWhen').value = e.when === '?' ? '' : e.when;
    markDirty(); keyEvents(); renderCanvas(); renderInspector(); reveal(e);
  }
  function bindInspector(){
    const upd = (fn, redraw) => (ev) => { if (!S.sel) return; fn(S.sel, ev.target.value); markDirty(); keyEvents(); if (redraw) renderCanvas(); renderInspector(); };
    $('tlFTitle').oninput = upd((e, v) => { e.title = clean(v); }, true);
    $('tlFWhen').oninput = (ev) => { upd((e, v) => { e.when = clean(v) || '?'; }, true)(ev); if (S.sel) reveal(S.sel); };
    $('tlFChapter').oninput = upd((e, v) => { e.chapter = clean(v); }, true);
    $('tlFDesc').oninput = upd((e, v) => { e.desc = clean(v); }, false);
    $('tlFQ').oninput = upd((e, v) => { e.question = clean(v); }, false);
    ['tlFYear', 'tlFDay', 'tlFTime', 'tlFCycle'].forEach(id => { $(id).oninput = fromDateFields; });
    ['tlFEra', 'tlFMonth', 'tlFApprox'].forEach(id => { $(id).onchange = fromDateFields; });
    $('tlFStated').onclick = () => { if (!S.sel) return; S.sel.open = false; markDirty(); render(); };
    $('tlFOpen').onclick = () => { if (!S.sel) return; S.sel.open = true; markDirty(); render(); $('tlFQ').focus(); };
    $('tlFCalsHead').onclick = () => { S.calsOpen = !S.calsOpen; renderInspector(); };
    $('tlFAddLink').onchange = (ev) => {
      const t = ev.target.value.trim(); ev.target.value = '';
      if (!S.sel || !t) return;
      const tag = '[[' + t + ']]';
      if (!S.sel.sources.includes(tag)) S.sel.sources = S.sel.sources ? S.sel.sources + ' · ' + tag : tag;
      markDirty(); renderInspector();
    };
    $('tlFDelete').onclick = (ev) => {
      const b = ev.currentTarget;
      if (!b.dataset.armed){ b.dataset.armed = '1'; b.textContent = 'Click again to delete'; setTimeout(() => { if (b.dataset.armed){ b.dataset.armed = ''; b.textContent = 'Delete event'; } }, 3000); return; }
      const i = S.doc.events.indexOf(S.sel); if (i >= 0) S.doc.events.splice(i, 1);
      S.sel = null; markDirty(); render();
    };
    $('tlFClose').onclick = () => { S.sel = null; render(); };
  }
  async function openNote(title){
    const pane = $('tlNote'); pane.hidden = false;
    $('tlNoteTitle').textContent = title; $('tlNoteBody').textContent = 'Opening…';
    try {
      const r = await window.writerAPI.noteRead(title);
      $('tlNoteBody').textContent = (r && r.ok && r.content != null) ? String(r.content).replace(/^---[\s\S]*?\n---\s*/, '').trim() : 'That note is not in the vault yet.';
    } catch (e) { $('tlNoteBody').textContent = 'Could not open the note.'; }
  }
  function addEvent(){
    if (S.lock) return;
    const e = blankEvent();
    const first = orderedCals().find(c => !S.hidden.has(c.name)); if (first) e.cals = [first.name];
    S.doc.events.push(e); S.trayOpen = true; markDirty(); select(e);
  }
  function markDirty(){
    if (S.lock) return;
    S.dirty = true; renderStatus();
    clearTimeout(S.saveTimer); S.saveTimer = setTimeout(save, 900);
  }
  function save(){
    if (S.lock || S.stale || !S.dirty) return S.saveChain;
    const text = serialize(S.doc); S.dirty = false; S.saving = true; renderStatus();
    S.saveChain = S.saveChain.then(async () => {
      let ok = false;
      let changed = false;
      try { const r = await window.writerAPI.tlWrite(text, S.mtime); ok = !!(r && r.ok); changed = !!(r && r.changed); if (ok && typeof r.mtimeMs === 'number') S.mtime = r.mtimeMs; } catch (e) { ok = false; }
      S.saving = false;
      if (changed){ S.dirty = false; S.stale = true; S.failed = false; }
      else if (!ok){ S.dirty = true; S.failed = true; } else S.failed = false;
      renderStatus();
    });
    return S.saveChain;
  }
  function renderStatus(){
    const s = $('tlSave'); if (!s) return;
    s.textContent = S.lock ? 'Read only: the note could not be read' : S.stale ? 'Not saved: the note changed outside the Writer. Close the Timeline and open it again' : S.failed ? 'Save failed: will retry on the next change' : S.saving ? 'Saving…' : S.dirty ? 'Unsaved' : 'Saved';
    s.className = 'tl-save' + (S.failed || S.lock || S.stale ? ' bad' : S.dirty || S.saving ? ' busy' : '');
  }
  async function load(){
    if (S.doc && (S.dirty || S.saving) && !S.stale) return S.doc;
    S.stale = false;
    try {
      const r = await window.writerAPI.tlRead();
      if (!r || !r.ok){ S.lock = true; S.doc = parseNote(''); }
      else { S.lock = false; S.doc = parseNote(r.content || ''); S.mtime = typeof r.mtimeMs === 'number' ? r.mtimeMs : undefined; }
    } catch (e) { S.lock = true; S.doc = parseNote(''); }
    keyEvents();
    return S.doc;
  }
  async function open(){
    const v = $('tlView'); v.hidden = false;
    $('tlSave').textContent = 'Opening…';
    const keepSel = S.sel ? keyOf(S.sel) : null;
    await load();
    S.sel = keepSel ? S.doc.events.find(e => keyOf(e) === keepSel) || null : null;
    try { const t = await window.writerAPI.noteTitles(); S.noteTitles = (t && t.ok && t.titles) || []; } catch (e) { S.noteTitles = []; }
    const dl = $('tlNoteList'); dl.innerHTML = ''; S.noteTitles.forEach(t => { const o = document.createElement('option'); o.value = t; dl.appendChild(o); });
    v.classList.toggle('locked', S.lock);
    V.time = null; V.ch = null;
    render();
  }
  async function close(){
    clearTimeout(S.saveTimer); await save();
    $('tlView').hidden = true; $('tlNote').hidden = true;
    try { if (typeof window.TL.onClose === 'function') window.TL.onClose(); } catch (e) {}
  }
  function setMode(m){ S.mode = m; LS.set('tl.cal', m); render(); }
  const keyOf = (e) => [e.when, e.title, e.chapter, e.cals.join(',')].join('|');
  async function eventsInChapter(b, local){
    await load();
    return S.doc.events.filter(e => e._ch && e._ch.book === b && e._ch.chKnown &&
      (e._ch.atEnd ? local === 27 : (local >= (e._ch.ch1 || 0) && local <= (e._ch.ch2 || e._ch.ch1 || 0))))
      .sort((p, q) => (domainOf(p) || p._key) - (domainOf(q) || q._key))
      .map(e => {
        let when;
        if (e._w.start) when = whenLabel(e.when);
        else when = 'Ch ' + local + ' · date not set';
        return { key: keyOf(e), title: e.title || '(untitled)', when, open: e.open, desc: e.desc };
      });
  }
  async function openEvent(key){
    S.sel = null;
    await open();
    const e = S.doc.events.find(x => keyOf(x) === key);
    if (e){ S.chapters = false; LS.set('tl.chapters', '0'); S.sel = e; const u = domainOf(e); if (u != null) focusOn(u, e._w.start ? (e._w.start.prec || precFor(e._w.start.dec)) : 'month'); render(); }
  }
  async function addInChapter(b, local){
    await open();
    if (S.lock) return;
    const e = blankEvent();
    e.chapter = 'Book ' + ROMAN[b] + ' · Ch ' + local;
    const first = orderedCals().find(c => !S.hidden.has(c.name)); if (first) e.cals = [first.name];
    S.doc.events.push(e); markDirty(); keyEvents();
    S.sel = e; const u = domainOf(e); if (u != null) focusOn(u, 'month'); else S.trayOpen = true;
    render(); setTimeout(() => $('tlFTitle').focus(), 0);
  }
  function init(){
    if (!$('tlView')) return;
    $('tlClose').onclick = close;
    $('tlAdd').onclick = addEvent;
    $('tlAddCal').onclick = addCalendar;
    $('tlAddFolder').onclick = addFolder;
    $('tlAddEra').onclick = () => addEra(false);
    $('tlAddEraView').onclick = () => addEra(true);
    $('tlZoomIn').onclick = () => zoomAt(1.6, canvasW() / 2);
    $('tlZoomOut').onclick = () => zoomAt(1 / 1.6, canvasW() / 2);
    $('tlHome').onclick = () => { fitView(); renderCanvas(); };
    $('tlAllTime').onclick = () => { if (S.chapters) fitView(); else fitAll(); renderCanvas(); };
    const go = $('tlGo');
    go.onkeydown = (ev) => { if (ev.key === 'Enter'){ const ok = goTo(go.value); go.classList.toggle('miss', !ok); if (ok){ go.value = ''; go.blur(); } } if (ev.key === 'Escape'){ go.value = ''; go.blur(); } };
    go.onchange = () => { if (go.value && S.doc.events.some(e => e.title === go.value)){ goTo(go.value); go.value = ''; } };
    $('tlEraGo').onchange = (ev) => {
      const er = (S.doc.eras || [])[+ev.target.value]; ev.target.value = '';
      if (!er || !eraSpan(er)) return;
      if (S.chapters){ S.chapters = false; LS.set('tl.chapters', '0'); render(); }
      const r = eraSpan(er); zoomToRange(r.lo, r.hi);
    };
    $('tlErasHead').onclick = () => { S.erasOpen = !S.erasOpen; LS.set('tl.eras.open', S.erasOpen ? '1' : '0'); renderEras(); };
    go.oninput = () => {
      go.classList.remove('miss');
      const dl = $('tlGoList'), q = go.value.trim().toLowerCase(); dl.innerHTML = '';
      if (!q) return;
      S.doc.events.filter(e => e.title && e.title.toLowerCase().includes(q)).slice(0, 12)
        .forEach(e => { const o = document.createElement('option'); o.value = e.title; dl.appendChild(o); });
    };
    const setRange = (key, v) => { v = clean(v); if (v) S.doc.settings[key] = v; else delete S.doc.settings[key]; markDirty(); renderRange(); if (homeRange() || !S.doc.settings['View from'] && !S.doc.settings['View to']){ fitView(); renderCanvas(); } };
    $('tlFrom').onchange = (ev) => setRange('View from', ev.target.value);
    $('tlTo').onchange = (ev) => setRange('View to', ev.target.value);
    $('tlTrayBtn').onclick = () => { S.trayOpen = !S.trayOpen; renderTray(); };
    $('tlAll').onclick = () => { S.hidden.clear(); persistHidden(); S.laneH = {}; render(); };
    $('tlNone').onclick = () => { S.doc.calendars.forEach(c => S.hidden.add(c.name)); persistHidden(); S.laneH = {}; render(); };
    $('tlModeEarth').onclick = () => setMode('earth');
    $('tlModeTst').onclick = () => setMode('tst');
    $('tlChapters').onclick = () => { S.chapters = !S.chapters; LS.set('tl.chapters', S.chapters ? '1' : '0'); S.laneH = {}; render(); };
    $('tlNoteClose').onclick = () => { $('tlNote').hidden = true; };
    const cv = $('tlCanvas');
    const pxIn = (ev) => ev.clientX - cv.getBoundingClientRect().left;
    cv.addEventListener('wheel', (ev) => {
      const sideways = ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY);
      ev.preventDefault();
      if (sideways){ panBy(ev.shiftKey ? (ev.deltaY || ev.deltaX) : ev.deltaX); return; }
      zoomAt(Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.06 : 0.0022)), pxIn(ev));
    }, { passive: false });
    let drag = null;
    cv.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.tl-box, button, input, .tl-over')) return;
      drag = { x: ev.clientX, t0: view().t0 }; cv.classList.add('panning'); ev.preventDefault();
    });
    cv.addEventListener('dblclick', (ev) => { if (ev.target.closest('.tl-box, button, input, .tl-over')) return; zoomAt(2, pxIn(ev)); });
    const ov = $('tlOver');
    let ovDrag = null;
    ov.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || !S.ovMap) return;
      ev.preventDefault(); ev.stopPropagation();
      const W = canvasW(), x = ev.clientX - ov.getBoundingClientRect().left;
      const centre = S.ovMap.inv(x);
      view().t0 = centre - view().spp * W / 2; scheduleCanvas();
      ovDrag = { x: ev.clientX, ox: x };
      ov.classList.add('dragging');
    });
    ov.addEventListener('wheel', (ev) => { ev.preventDefault(); ev.stopPropagation(); zoomAt(Math.exp(-ev.deltaY * 0.0022), canvasW() / 2); }, { passive: false });
    window.addEventListener('mousemove', (ev) => {
      if (drag){ view().t0 = drag.t0 - (ev.clientX - drag.x) * view().spp; scheduleCanvas(); }
      if (ovDrag && S.ovMap){ const W = canvasW(), x = ovDrag.ox + (ev.clientX - ovDrag.x); view().t0 = S.ovMap.inv(x) - view().spp * W / 2; scheduleCanvas(); }
    });
    window.addEventListener('mouseup', () => { if (drag){ drag = null; cv.classList.remove('panning'); } if (ovDrag){ ovDrag = null; ov.classList.remove('dragging'); } });
    window.addEventListener('resize', () => { if (!$('tlView').hidden) scheduleCanvas(); });
    document.addEventListener('keydown', (ev) => {
      if ($('tlView').hidden) return;
      if (ev.key === 'Escape'){
        if (!$('tlNote').hidden) $('tlNote').hidden = true;
        else if (S.trayOpen){ S.trayOpen = false; renderTray(); }
        else if (S.editCal || S.editFolder || S.editEra){ S.editCal = null; S.editFolder = null; S.editEra = null; renderSide(); renderEras(); }
        else if (S.sel){ S.sel = null; render(); }
        else close();
      }
      if (ev.key === '/' && document.activeElement === document.body){ ev.preventDefault(); $('tlGo').focus(); }
    });
    bindInspector();
    const btn = $('timelineBtn'); if (btn) btn.onclick = open;
    window.TL = Object.assign(window.TL || {}, { open, close, save, load, eventsInChapter, openEvent, addInChapter, parseNote, serialize: (d) => serialize(d || S.doc), _state: S, _parseWhen: parseWhen, _goTo: goTo, _tst: { tstOf, uOfTst, uOf, fieldsOf, fmtPoint, whenLabel } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
