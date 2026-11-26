const BI_MAP=[
  ['#readBookBtn','book'],['#timelineBtn','calendar'],['#parablesBtn','cards'],['#tlAdd','plus'],['#tlAddCal','plus'],['#tlAddFolder','plus'],
  ['#tlZoomIn','plus',1],['#tlZoomOut','minus',1],['#tlClose','close',1],['#tlFClose','close',1],['#tlNoteClose','close',1],['#exportBtn','export'],['#helpBtn','sparkle'],['#readerClose','close'],
  ['.panel-head .x','close',1],['.modal-head .x','close',1],['.bv-close','close',1],['.de-del','close',1],
  ['#bvBackShelf','chevron-left'],['.back-desk','chevron-left'],['#dashSettings','settings'],['#setMatterBtn','document'],
  ['.startbtn[data-rcid]','pen'],['#expGo','export'],['#dictAddBtn','plus'],['#askWorld','sparkle'],
  ['.pact[data-a="split"]','split'],['.pact[data-a="merge"]','merge'],['.pact[data-a="del"]','trash'],
  ['.padd','plus'],['.padd-end','plus'],['#pOverview','overview'],['.dict-btn','book'],
  ['.ins-btn[data-ins="dialogue"] .ins-ic','quote',1],['#expAll','check'],['#expNone','close'],['#expDrafted','pen']
];
function decorateIcons(root){
  if(!window.BladesIcon) return;
  BI_MAP.forEach(([sel,name,only])=>{ (root||document).querySelectorAll(sel).forEach(b=>{
    if(b.dataset.bi) return; b.dataset.bi=name;
    if(only){ b.innerHTML=BladesIcon(name,18); return; }
    for(const n of b.childNodes){ if(n.nodeType===3){ n.nodeValue=n.nodeValue.replace(/^\s*[+‹›]\s*/,'').replace(/\s*[→›]\s*$/,''); } }
    b.insertAdjacentHTML('afterbegin',BladesIcon(name,16)); }); });
}
(function(){ let q=false; new MutationObserver(()=>{ if(q) return; q=true; requestAnimationFrame(()=>{ q=false; decorateIcons(); }); })
  .observe(document.documentElement,{childList:true,subtree:true}); })();
function markImg(name){ return `<img class="knot" src="branding/${name}.svg" alt="" draggable="false">`; }
function roseMain(){ return markImg('blades-logo-dark'); }
function roseBook(n){ return markImg('blades-book'+n); }
function roseOwn(n){ return `<span class="mcov mcov-${n}">${markImg('blades-book'+n)}</span>`; }
function roseMono(){ return markImg('blades-logo-mono'); }
function roseCoin(){ return markImg('blades-logo-dark'); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
const PLATE_LINE_RX=/^<!-- plate(?:: .*?)? -->[ \t]*\r?\n?/gm;
function proseOf(draft){ return String(draft||'').replace(PLATE_LINE_RX,''); }
function encNote(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/-->/g,'--\\>'); }
function decNote(s){ return String(s||'').replace(/\\(\\|n|>)/g,(m,c)=>c==='n'?'\n':c==='>'?'>':'\\'); }
function parsePlates(draft){
  const s=String(draft||''), rx=/^<!-- plate(?:: (.*?))? -->[ \t]*(?:\r?\n|$)/gm;
  const out=[]; let last=0, m, note=null, seen=false;
  while((m=rx.exec(s))){
    const seg=s.slice(last,m.index);
    if(!seen){ if(m.index>0) out.push({note:'',text:seg.replace(/\n+$/,'')}); seen=true; }
    else out.push({note,text:seg.replace(/\n+$/,'')});
    note=decNote(m[1]||''); last=rx.lastIndex;
    if(m[0]==='') rx.lastIndex++;
  }
  if(!seen) return [{note:'',text:s}];
  out.push({note,text:s.slice(last).replace(/\n+$/,'')});
  return out;
}
function serializePlates(plates){
  if(plates.length===1 && !(plates[0].note||'').trim()) return plates[0].text;
  return plates.map((p,i)=>{
    const note=(p.note||'').trim()? ': '+encNote(p.note) : '';
    const head=(i===0 && !note) ? '' : '<!-- plate'+note+' -->\n';
    return head+String(p.text||'').replace(/\n+$/,'');
  }).join('\n\n');
}
let P=null;
const GRIP_SVG=(window.BladesIcon&&BladesIcon('grip',16))||'<svg viewBox="0 0 10 16"><g fill="currentColor"><circle cx="2.5" cy="3" r="1.3"/><circle cx="7.5" cy="3" r="1.3"/><circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/><circle cx="2.5" cy="13" r="1.3"/><circle cx="7.5" cy="13" r="1.3"/></g></svg>';
function syncDraft(){
  if(!P) return;
  P.ch.draft=serializePlates(P.plates); _pendingCh.add(P.ch); markDirty(); updateStatus();
}
function activePlate(){
  const a=document.activeElement;
  if(a && a.classList && a.classList.contains('ptext')) return a;
  if(P && P.lastEl && document.contains(P.lastEl)) return P.lastEl;
  return document.querySelector('#plates .ptext');
}
function placeCaret(node, atEnd){
  const r=document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd);
  const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function caretOffsetIn(node){
  const s=window.getSelection(); if(!s.rangeCount || !node.contains(s.anchorNode)) return null;
  const r=s.getRangeAt(0).cloneRange(), pre=document.createRange();
  pre.selectNodeContents(node); pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
function gapEl(i){
  const g=el('div','pgap'), b=el('button','padd','+ plate here');
  b.title='Put a new, empty plate here — a place to write later';
  b.onclick=()=>{ P.plates.splice(i,0,{note:'',text:''}); syncDraft(); P.overview=false; renderPlates(i,false); };
  g.appendChild(b); return g;
}
function updatePlatesBar(){
  const bar=document.getElementById('platesBar'); if(!bar||!P) return;
  const n=P.plates.length;
  bar.innerHTML=`<span>${n} plate${n===1?'':'s'}</span><span class="grow"></span>`+
    (n>1?`<button class="pbtn${P.overview?' on':''}" id="pOverview" title="Fold every plate to two lines, to see and move the whole chapter">Overview</button>`:'')+
'';
  const ov=document.getElementById('pOverview'); if(ov) ov.onclick=()=>{ P.overview=!P.overview; renderPlates(); };
}
function renderPlates(focusIdx, atEnd){
  const host=document.getElementById('plates'); if(!host||!P) return;
  const n=P.plates.length;
  host.classList.toggle('single', n===1); host.classList.toggle('multi', n>1);
  host.classList.toggle('overview', !!P.overview);
  host.innerHTML='';
  host.appendChild(gapEl(0));
  P.plates.forEach((pl,i)=>{
    const row=el('div','plate-row'); row.dataset.i=i;
    const note=el('div','pnote'); note.contentEditable='plaintext-only'; note.spellcheck=false;
    note.dataset.ph = n===1 ? 'Notes to yourself. Never printed.' : 'Note';
    note.textContent=pl.note||'';
    const plate=el('div','plate'+(String(pl.text).trim()?'':' empty'));
    const grip=el('div','pgrip'); grip.innerHTML=GRIP_SVG; grip.title='Drag to move this plate (or Alt+Shift+Up/Down)';
    const tx=el('div','ptext'); tx.contentEditable= P.overview ? 'false' : 'plaintext-only'; tx.spellcheck=false;
    tx.dataset.ph = n===1 ? 'Write here. Nothing interrupts you.' : 'Empty plate. Write here when you are ready.';
    tx.textContent=pl.text||'';
    const acts=el('div','pacts');
    acts.innerHTML=`<button class="pact" data-a="split" title="Split this plate in two at the cursor (Alt+Shift+Enter)">Split here</button>`+
      `<button class="pact needs-multi" data-a="merge" title="Join the plate below onto this one"${i===n-1?' disabled':''}>Merge down</button>`+
      `<button class="pact needs-multi" data-a="del" title="Remove this plate. Only possible when it has no text: merge instead to keep words"${String(pl.text).trim()?' disabled':''}>Remove</button>`;
    plate.append(grip,tx,acts); row.append(note,plate);
    host.appendChild(row); if(i<n-1) host.appendChild(gapEl(i+1));
    const delBtn=acts.querySelector('[data-a="del"]');
    tx.addEventListener('input',()=>{ pl.text=tx.textContent; const has=!!pl.text.trim();
      plate.classList.toggle('empty',!has); if(delBtn) delBtn.disabled=has; syncDraft(); });
    tx.addEventListener('focus',()=>{ P.lastEl=tx; });
    tx.addEventListener('click',()=>{ if(P.overview){ P.overview=false; renderPlates(i,true); } });
    tx.addEventListener('keydown',e=>plateKeys(e,i,tx));
    note.addEventListener('input',()=>{ pl.note=note.textContent; syncDraft(); });
    grip.addEventListener('pointerdown',e=>startPlateDrag(e,i));
    acts.querySelectorAll('.pact').forEach(b=>{ b.onmousedown=e=>e.preventDefault(); b.onclick=()=>plateAction(b.dataset.a,i,tx); });
    wireProseKeys(tx);
  });
  const end=el('div','pend'), eb=el('button','padd-end','+ plate');
  eb.title='A new empty plate at the end'; eb.onclick=()=>{ P.plates.push({note:'',text:''}); syncDraft(); P.overview=false; renderPlates(P.plates.length-1,false); };
  end.appendChild(eb); host.appendChild(end);
  updatePlatesBar();
  if(focusIdx!=null){ const t=host.querySelectorAll('.ptext')[focusIdx]; if(t && !P.overview){ t.focus({preventScroll:true}); placeCaret(t, atEnd!==false); revealInField(t,false); } }
}
function revealInField(elm, center){
  const f=document.querySelector('.field'); if(!f||!elm) return;
  const r=elm.getBoundingClientRect(), fr=f.getBoundingClientRect();
  if(center) f.scrollTop+=(r.top-fr.top)-Math.max(40,(fr.height-Math.min(r.height,fr.height))/2);
  else if(r.top<fr.top+40) f.scrollTop+=r.top-fr.top-80;
  else if(r.top>fr.bottom-120) f.scrollTop+=r.top-fr.bottom+200;
}
function movePlate(from,to){
  if(!P || to<0 || to>=P.plates.length || to===from) return;
  const [p]=P.plates.splice(from,1); P.plates.splice(to,0,p); syncDraft();
}
function plateAction(a,i,tx){
  const pl=P.plates[i]; if(!pl) return;
  if(a==='split'){
    let off=caretOffsetIn(tx); if(off==null) off=pl.text.length;
    const before=pl.text.slice(0,off).replace(/\s+$/,''), after=pl.text.slice(off).replace(/^\s+/,'');
    P.plates.splice(i,1,{note:pl.note,text:before},{note:'',text:after});
    syncDraft(); renderPlates(i+1,false);
  } else if(a==='merge'){
    const nx=P.plates[i+1]; if(!nx) return;
    const at=pl.text.replace(/\s+$/,'').length;
    pl.text=[pl.text.replace(/\s+$/,''), nx.text.replace(/^\s+/,'')].filter(Boolean).join('\n\n');
    pl.note=[pl.note,nx.note].filter(s=>s&&s.trim()).join('\n');
    P.plates.splice(i+1,1); syncDraft(); renderPlates(i,true);
    const t=document.querySelectorAll('#plates .ptext')[i]; if(t&&t.firstChild){ const r=document.createRange();
      r.setStart(t.firstChild,Math.min(at,t.firstChild.length)); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
  } else if(a==='del'){
    if(String(pl.text).trim() || P.plates.length<2) return;
    P.plates.splice(i,1); syncDraft(); renderPlates(Math.max(0,i-1),true);
  }
}
function plateKeys(e,i,tx){
  if(!(e.altKey && e.shiftKey) || e.ctrlKey || e.metaKey) return;
  if(e.key==='ArrowUp' || e.key==='ArrowDown'){
    e.preventDefault(); const to=i+(e.key==='ArrowUp'?-1:1);
    if(to<0||to>=P.plates.length) return;
    const off=caretOffsetIn(tx); movePlate(i,to); renderPlates(to,true);
    const t=document.querySelectorAll('#plates .ptext')[to];
    if(t && off!=null && t.firstChild){ const r=document.createRange(); r.setStart(t.firstChild,Math.min(off,t.firstChild.length)); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
  } else if(e.key==='Enter'){ e.preventDefault(); plateAction('split',i,tx); }
}
function startPlateDrag(e,i){
  if(!P || P.plates.length<2 || e.button!==0) return;
  e.preventDefault();
  const host=document.getElementById('plates'), field=document.querySelector('.field');
  const wasOverview=P.overview;
  if(!P.overview){ P.overview=true; renderPlates(); }
  host.classList.add('dragmode');
  const rows=[...host.querySelectorAll('.plate-row')], row=rows[i];
  const g=row.getBoundingClientRect(); field.scrollTop+=(g.top+18)-e.clientY;
  const rects=rows.map(r=>r.getBoundingClientRect());
  const gap=rows.length>1 ? (rects[1].top-rects[0].bottom) : 0;
  const shift=rects[i].height+gap;
  const startY=e.clientY, startScroll=field.scrollTop;
  let target=i, lastY=e.clientY, raf=null;
  row.classList.add('dragging');
  function layout(){
    const dy=(lastY-startY)+(field.scrollTop-startScroll);
    row.style.transform=`translateY(${dy}px)`;
    const mid=rects[i].top+rects[i].height/2+dy;
    let t=0; rects.forEach((r,j)=>{ if(j!==i && r.top+r.height/2<mid) t++; });
    target=t;
    rows.forEach((r,j)=>{ if(j===i) return;
      let s=0; if(i<target && j>i && j<=target) s=-shift; else if(target<i && j>=target && j<i) s=shift;
      r.style.transform=s?`translateY(${s}px)`:''; });
  }
  function tick(){
    const fr=field.getBoundingClientRect(); let v=0;
    if(lastY<fr.top+70) v=-Math.ceil((fr.top+70-lastY)/6); else if(lastY>fr.bottom-70) v=Math.ceil((lastY-(fr.bottom-70))/6);
    if(v){ field.scrollTop+=v; layout(); }
    raf=requestAnimationFrame(tick);
  }
  const move=ev=>{ lastY=ev.clientY; layout(); };
  const up=()=>{
    window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); window.removeEventListener('pointercancel',up);
    cancelAnimationFrame(raf);
    rows.forEach(r=>{ r.style.transform=''; r.classList.remove('dragging'); });
    host.classList.remove('dragmode');
    if(target!==i) movePlate(i,target);
    P.overview=wasOverview; renderPlates();
    const moved=host.querySelectorAll('.plate-row')[target]; if(moved) revealInField(moved,true);
  };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
  raf=requestAnimationFrame(tick);
}
const NUM=["One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve"];
const SEED = {books:[]};
let STRUCT = {books:[]};
const _diskMd={};
let _diskBook=null;
let ALL=[];
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
let _idc=0, _idmap=new Map();
function idOf(nd){ if(!nd._id){nd._id='n'+(_idc++); _idmap.set(nd._id,nd);} return nd._id; }
function byId(id){return _idmap.get(id);}
function chapterFile(n){ return 'Ch-'+String(n).padStart(2,'0')+'.md'; }
function parseChapterMd(text){
  const out={state:'blank',loop:'',play:[],touched:0,body:''};
  if(!text) return out;
  text=String(text).replace(/\r\n/g,'\n');
  const m=text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if(m){
    const fm=m[1]; out.body=m[2].replace(/^\s+/,'');
    const g=(k)=>{const r=fm.match(new RegExp('^'+k+':\\s*(.*)$','m'));return r?r[1].trim():'';};
    out.state=g('state')||'blank';
    out.loop=g('loop').replace(/^["']|["']$/g,'').replace(/\\"/g,'"');
    out.touched=parseInt(g('touched'),10)||0;
    const pl=g('play'); if(pl){ try{out.play=JSON.parse(pl);}catch(e){out.play=pl.split(',').map(s=>s.trim()).filter(Boolean);} }
  } else { out.body=text; }
  return out;
}
function buildChapterMd(ch){
  const play=JSON.stringify(ch.play||[]);
  const ep=ch._parent, act=ep&&ep._parent, book=act&&act._parent;
  const q=(s)=>String(s||'').replace(/"/g,'\\"');
  const fm=['---',
    'clearance: 2','status: active','type: manuscript-chapter',
    'book: '+(book?book.n:''),'chapter: '+ch.n,
    'title: "'+q(ch.t)+'"',
    'state: '+(ch.state||'blank'),
    'loop: "'+q(ch.loop)+'"',
    'play: '+play,
    'touched: '+(ch._touched||0),
    '---',''].join('\n');
  return fm + (ch.draft||'');
}
async function loadBook(){
  let book=null, meta=null, chapterMd={};
  try{
    if(window.writerAPI){
      const all=await window.writerAPI.msReadAll();
      if(all&&all.ok){
        const files=all.files||{};
        if(files['book.json']!=null) _diskBook=String(files['book.json']).split(String.fromCharCode(13)).join('');
        if(files['book.json']){
          try{ const j=JSON.parse(files['book.json']);
               if(!j||!j.structure||!Array.isArray(j.structure.books)) throw new Error('no structure in book.json');
               book=j.structure; meta=j.meta; }
          catch(e){
            SAVE_LOCK='structure';
            LOAD_PROBLEM='The book structure file (book.json) could not be read, so the default structure is showing. '
              +'Your chapter text loaded normally and still saves. book.json is left untouched; the previous version is in book.json.bak.';
          }
        }
        for(const fn in files){ if(/^Ch-\d+\.md$/.test(fn)){ chapterMd[fn]=files[fn]; _diskMd[fn]=String(files[fn]).split(String.fromCharCode(13)).join(''); } }
      } else {
        SAVE_LOCK='all';
        LOAD_PROBLEM='The Manuscript folder could not be read'+(all&&all.reason?' ('+all.reason+')':'')
          +'. Saving is paused so nothing can be overwritten. Close the Writer and open it again.';
      }
    }
  }catch(e){
    SAVE_LOCK='all';
    LOAD_PROBLEM='The manuscript could not be loaded ('+(e&&e.message||e)+'). Saving is paused so nothing can be overwritten. Close the Writer and open it again.';
  }
  if(!book){ book=JSON.parse(JSON.stringify(SEED)); meta=null; }
  STRUCT=book;
  STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{
    const md=chapterMd[chapterFile(c.n)];
    if(md){ const p=parseChapterMd(md); c.draft=p.body; c.state=p.state; c.loop=p.loop||c.loop; c._touched=p.touched||0; if(p.play&&p.play.length)c.play=p.play; }
  }))));
  if(meta){ Object.assign(MK, meta); }
  if(!book || !window.writerAPI){   }
  if(window.writerAPI && !SAVE_LOCK && !(await hasBookJson())){ await saveBookJson(); }
}
async function hasBookJson(){
  try{ const l=await window.writerAPI.msList(); return l&&l.ok&&(l.files||[]).includes('book.json'); }catch(e){ return false; }
}
async function mustWrite(rel, text){
  if(!window.writerAPI) return;
  const r=await window.writerAPI.msWrite(rel, text);
  if(!r||!r.ok) throw new Error((r&&r.reason)||'write failed');
}
function bookJsonText(){
  const clean=JSON.parse(JSON.stringify(STRUCT, (k,v)=> (k.startsWith('_')?undefined:v)));
  return JSON.stringify({structure:clean, meta:MK}, null, 1);
}
async function saveBookJson(){ await mustWrite('book.json', bookJsonText()); }
const noCR=(t)=>t==null?null:String(t).split(String.fromCharCode(13)).join('');
const thisSide=()=>(window.writerAPI&&window.writerAPI.phone)?'phone':'alaric';
const otherSide=()=>(window.writerAPI&&window.writerAPI.phone)?'alaric':'phone';
let _refreshing=false, _mustReload=false;
async function fileAway(file, text, who){
  if(!window.SyncModel||text==null) return;
  const k=SyncModel.keptName('Manuscript/'+file, Date.now(), who).replace(/^Manuscript\//,'');
  try{ await window.writerAPI.msWrite(k, text); }catch(e){}
}
function chapterByN(n){ let hit=null; STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{ if(c.n===n) hit=c; })))); return hit; }
function sameShape(a,b){
  try{ const s=(t)=>JSON.stringify(JSON.parse(t),(k,v)=>(k==='draft'||k==='state'||k==='loop'||k==='play'||k.startsWith('_'))?undefined:v); return s(a)===s(b); }catch(e){ return false; }
}
function applyChapterText(ch, text){
  const p=parseChapterMd(text);
  ch.draft=p.body; ch.state=p.state; ch.loop=p.loop||ch.loop; ch._touched=p.touched||ch._touched; if(p.play&&p.play.length) ch.play=p.play;
  if(P && P.ch===ch){
    const tx=[...document.querySelectorAll('#plates .ptext')], at=tx.indexOf(document.activeElement);
    P.plates=parsePlates(ch.draft); renderPlates(at>=0?Math.min(at,P.plates.length-1):null, true);
  }
}
async function writeChapter(ch, file, text){
  let expect=Object.prototype.hasOwnProperty.call(_diskMd,file)?_diskMd[file]:null;
  let r=await window.writerAPI.msWrite(file, text, expect);
  for(let n=0; r && r.changed && window.SyncModel && n<3; n++){
    const theirs=noCR(r.content);
    const m=SyncModel.mergeText(expect, theirs, text, {prefer:'theirs'});
    if(m.lost) await fileAway(file, m.lost, m.loser==='ours'?otherSide():thisSide());
    const now=buildChapterMd(ch);
    applyChapterText(ch, now===text ? m.text : SyncModel.mergeText(text, m.text, now, {prefer:'theirs'}).text);
    if(now!==text) _pendingCh.add(ch);
    expect=theirs; text=m.text;
    r=await window.writerAPI.msWrite(file, text, expect);
  }
  if(!r||!r.ok) throw new Error((r&&r.reason)||'write failed');
  _diskMd[file]=text;
}
async function writeBook(bj){
  const mine=bj;
  let expect=_diskBook, r=await window.writerAPI.msWrite('book.json', bj, expect==null?undefined:expect);
  for(let n=0; r && r.changed && window.SyncModel && n<3; n++){
    const theirs=noCR(r.content);
    const m=theirs==null?bj:SyncModel.mergeJson(expect, theirs, bj, 'theirs');
    if(m==null) break;
    expect=theirs; bj=m;
    r=await window.writerAPI.msWrite('book.json', bj, expect);
  }
  if(!r||!r.ok) throw new Error((r&&r.reason)||'write failed');
  _diskBook=bj;
  if(bj!==mine && !sameShape(bj, mine)) setTimeout(reloadKeepingPlace, 0);
}
function reloadKeepingPlace(){
  _mustReload=true;
  try{ sessionStorage.setItem('writer-reopen', JSON.stringify({n: current?current.n:null, at: Date.now()})); }catch(e){}
  location.reload();
}
async function refreshFromDisk(){
  if(_refreshing||_mustReload||SAVE_LOCK==='all'||!window.writerAPI||!window.SyncModel) return;
  _refreshing=true;
  try{
    await doSave();
    const all=await window.writerAPI.msReadAll(); if(!all||!all.ok) return;
    const files=all.files||{};
    const bk=noCR(files['book.json']);
    if(bk!=null && bk!==_diskBook){
      if(!sameShape(bk, bookJsonText())){ reloadKeepingPlace(); return; }
      _diskBook=bk;
    }
    let any=false;
    for(const fn in files){
      if(!/^Ch-\d+\.md$/.test(fn)) continue;
      const t=noCR(files[fn]); if(t===_diskMd[fn]) continue;
      const ch=chapterByN(parseInt(fn.slice(3),10)); if(!ch){ reloadKeepingPlace(); return; }
      const base=Object.prototype.hasOwnProperty.call(_diskMd,fn)?_diskMd[fn]:null, mine=buildChapterMd(ch);
      if(mine===base || (base==null && !String(ch.draft||'').trim())) applyChapterText(ch, t);
      else {
        const m=SyncModel.mergeText(base, t, mine, {prefer:'theirs'});
        if(m.lost) await fileAway(fn, m.lost, m.loser==='ours'?otherSide():thisSide());
        applyChapterText(ch, m.text);
        if(m.text!==t){ _pendingCh.add(ch); markDirty(); }
      }
      _diskMd[fn]=t; any=true;
    }
    if(any){ try{ drawOrrery(); if(_onDash) dashboard(); else updateStatus(); }catch(e){} }
  } finally { _refreshing=false; }
}
const sheet=document.getElementById('sheet');
function flowSheet(){ sheet.classList.remove('flow'); void sheet.offsetWidth; sheet.classList.add('flow'); }
const Memphis = (function(){
  let ws=null, ready=false; const waiting={};
  function connect(){
    return;
    ws.onopen=()=>{ ready=true; };
    ws.onclose=()=>{ ready=false; ws=null; setTimeout(connect, 4000); };
    ws.onerror=()=>{ try{ws.close();}catch(e){} };
    ws.onmessage=(ev)=>{
      const m=String(ev.data||'');
      if(m.startsWith('writeranswer:')){
        const rest=m.slice('writeranswer:'.length);
        const i=rest.indexOf(':'); if(i<0)return;
        const id=rest.slice(0,i); let text='';
        try{ text=decodeURIComponent(escape(atob(rest.slice(i+1)))); }catch(e){ try{text=atob(rest.slice(i+1));}catch(_){} }
        const w=waiting[id]; if(w){ clearTimeout(w.timer); w.resolve(text); delete waiting[id]; }
      }
    };
  }
  connect();
  function ask(payload){
    return new Promise((resolve)=>{
      if(!ready||!ws){ resolve({offline:true}); return; }
      const id='w'+Date.now()+Math.random().toString(36).slice(2,6);
      payload.id=id;
      const timer=setTimeout(()=>{ if(waiting[id]){ delete waiting[id]; resolve({timeout:true}); } }, 45000);
      waiting[id]={resolve:(t)=>resolve({text:t}),timer};
      try{ ws.send('writerask:'+btoa(unescape(encodeURIComponent(JSON.stringify(payload))))); }
      catch(e){ clearTimeout(timer); delete waiting[id]; resolve({offline:true}); }
    });
  }
  return { ask, get ready(){return ready;} };
})();
const fabs=document.getElementById('fabs');
const where=document.getElementById('where')||{set innerHTML(v){}};
let current=null;
let SAVE_LOCK=null;
let LOAD_PROBLEM='';
let railLevel='books';
function wireTree(){
  STRUCT.books.forEach(b=>{b._kind='Book';
    b.acts.forEach(a=>{a._parent=b;a._kind='Act';a._short=a.name||(a.t?a.t.replace(/ — .*/,''):'Act');
      (a.eps||[]).forEach(e=>{e._parent=a;e._kind='Episode';
        (e.ch||[]).forEach(c=>{c._parent=e;c._kind='Chapter'});
      });
    });
  });
}
const orrPath=document.getElementById('orrPath');
const bands={Book:document.getElementById('bandBook'),Act:document.getElementById('bandAct'),
             Episode:document.getElementById('bandEp'),Chapter:document.getElementById('bandCh')};
let _cur={book:null,act:null,ep:null,ch:null};
function renderRail(){ drawOrrery(); }
function renderRailCurrent(){ drawOrrery(); }
function setPosition(node){
  let book=null,act=null,ep=null,ch=null;
  const k=node._kind;
  if(k==='Chapter'){ch=node;ep=ch._parent;act=ep._parent;book=act._parent;}
  else if(k==='Episode'){ep=node;act=ep._parent;book=act._parent;}
  else if(k==='Act'){act=node;book=act._parent;}
  else if(k==='Book'){book=node;}
  _cur={book,act,ep,ch};
}
const _expanded={Act:false,Episode:false,Chapter:false};
function childrenOf(nd){
  if(nd._kind==='Book')return nd.acts||[];
  if(nd._kind==='Act')return nd.eps||[];
  if(nd._kind==='Episode')return nd.ch||[];
  return [];
}
function allOf(kind){
  const out=[];
  STRUCT.books.forEach(b=>{
    if(kind==='Act')b.acts.forEach(a=>out.push(a));
    else b.acts.forEach(a=>(a.eps||[]).forEach(e=>{
      if(kind==='Episode')out.push(e); else (e.ch||[]).forEach(c=>out.push(c));
    }));
  });
  return out;
}
function updateProgressChip(){
  try{
    const s=countStates();
    const pct=progressPct(s);
    const el1=document.getElementById('progpct'); if(el1)el1.textContent=fmtPct(pct)+'%';
    const bar=document.getElementById('progbar'); if(bar)bar.style.width=pct+'%';
  }catch(e){}
}
function drawOrrery(){
  updateProgressChip();
  const {book,act,ep,ch}=_cur;
  const segs=[];
  if(book)segs.push(`<span class="seg ${!act?'on':''}">${numLabel(book)}</span>`);
  if(act)segs.push(`<span class="sep">›</span><span class="seg ${!ep?'on':''}">${numLabel(act)}</span>`);
  if(ep)segs.push(`<span class="sep">›</span><span class="seg ${!ch?'on':''}">${numLabel(ep)}</span>`);
  if(ch)segs.push(`<span class="sep">›</span><span class="seg on">${numLabel(ch)}</span>`);
  orrPath.innerHTML = segs.length?segs.join(''):'Choose a chapter to begin';
  drawBand('Book', STRUCT.books, book, false, b=>{ setPosition(b); openLevel(b); drawOrrery(); });
  drawBand('Act', _expanded.Act?allOf('Act'):(book?book.acts:[]), act, _expanded.Act,
           a=>{ setPosition(a); openLevel(a); drawOrrery(); });
  drawBand('Episode', _expanded.Episode?allOf('Episode'):(act?(act.eps||[]):[]), ep, _expanded.Episode,
           e=>{ setPosition(e); openLevel(e); drawOrrery(); });
  drawBand('Chapter', _expanded.Chapter?allOf('Chapter'):(ep?(ep.ch||[]):[]), ch, _expanded.Chapter,
           c=>{ openChapter(c); });
}
function drawBand(kind, items, activeNode, isExpanded, onPick){
  const host=bands[kind];
  const bandEl=host.closest('.band');
  if(bandEl) bandEl.classList.toggle('expanded', !!isExpanded);
  host.innerHTML='';
  host.classList.remove('as-grid','as-bookrows');
  const isChapter = kind==='Chapter';
  if(!items||!items.length){
    const ghost=el('div','cell-o ghost'); ghost.textContent='—'; host.appendChild(ghost); return;
  }
  if(isExpanded && isChapter){
    host.classList.add('as-bookrows');
    STRUCT.books.forEach(b=>{
      const row=el('div','bookrow');
      const tag=el('span','brtag','Book '+roman(b.n));
      row.appendChild(tag);
      const cells=el('div','brcells');
      b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{
        const sq=makeSquare(c,activeNode,true,onPick);
        cells.appendChild(sq);
      })));
      row.appendChild(cells);
      host.appendChild(row);
    });
    return;
  }
  if(isExpanded){
    host.classList.add('as-grid');
    items.forEach(it=>host.appendChild(makeSquare(it,activeNode,false,onPick)));
    return;
  }
  const dropPrefix = (kind==='Episode'||kind==='Chapter');
  items.forEach(it=>{
    const c=el('div','cell-o anim');
    const numeral = dropPrefix ? roman(globalIndex(it)) : numLabel(it);
    const name = isChapter ? it.t : (subOf(it)||nmOf(it));
    c.innerHTML = `<span class="num">${numeral}</span><span class="nm">${esc(name)}</span>`;
    if(it===activeNode) c.classList.add('on');
    wireCell(c,it,onPick,isChapter);
    host.appendChild(c);
    setTimeout(()=>c.classList.remove('anim'),320);
  });
}
function makeSquare(it,activeNode,isChapter,onPick){
  const c=el('div','sq81 '+(isChapter?(it.state||'blank'):'lvl'));
  const name = isChapter ? it.t : (subOf(it)||nmOf(it));
  c.innerHTML=`<span class="num">${roman(globalIndex(it))}</span><span class="nm">${esc(name)}</span>`;
  if(it===activeNode)c.classList.add('on');
  wireCell(c,it,onPick,isChapter);
  return c;
}
function wireCell(c,it,onPick,isChapter){
  const name = isChapter ? it.t : (subOf(it)||nmOf(it));
  c.dataset.name = name;
  c.title = name;
  c.onclick=()=>onPick(it);
}
document.querySelectorAll('button.bl[data-exp]').forEach(btn=>{
  btn.onclick=()=>{ const k=btn.dataset.exp; _expanded[k]=!_expanded[k]; drawOrrery(); };
});
document.getElementById('orrery').addEventListener('click',e=>{
  if(e.target.closest('.orr-rest')){
    const o=document.getElementById('orrery'); o.classList.toggle('open');
    const h=document.getElementById('orrHint');
    if(h) h.textContent = o.classList.contains('open') ? 'Locked open · press to unlock' : 'Hover for the full map · press to lock';
    if(!o.classList.contains('open')){ collapseMap(); }
  }
});
function collapseMap(){ _expanded.Act=false; _expanded.Episode=false; _expanded.Chapter=false; drawOrrery(); }
document.getElementById('orrery').addEventListener('mouseleave',()=>{
  const o=document.getElementById('orrery');
  if(!o.classList.contains('open') && (_expanded.Act||_expanded.Episode||_expanded.Chapter)) collapseMap();
});
function rebuildJump(){}
function pathBar(node){
  const chain=[]; let n=node; while(n){chain.unshift(n);n=n._parent;}
  const segs=chain.map((nd,i)=>{
    const last=i===chain.length-1;
    return `<span class="seg ${last?'cur':''}" data-idx="${i}">${esc(nmOf(nd))}</span>`;
  });
  return `<div class="path">${segs.join('<span class="sep">›</span>')}</div>`;
}
function wirePath(node){
  const chain=[]; let n=node; while(n){chain.unshift(n);n=n._parent;}
  sheet.querySelectorAll('.path .seg').forEach(s=>{
    const idx=+s.dataset.idx; const target=chain[idx];
    if(idx===chain.length-1) return;
    s.onclick=()=>{ if(target._kind==='Chapter')openChapter(target); else openLevel(target);
      const lvlmap={Book:'book',Act:'act',Episode:'ep'};
      renderRail(lvlmap[target._kind]||'books', target._kind==='Book'||target._kind==='Act'||target._kind==='Episode'?target:null);
    };
  });
}
function roman(n){const m=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let s='';for(const[v,sym]of m){while(n>=v){s+=sym;n-=v;}}return s;}
function globalIndex(nd){
  if(nd._kind==='Book')return nd.n;
  if(nd._kind==='Chapter')return nd.n;
  let idx=0;
  for(const b of STRUCT.books){
    for(const a of b.acts){
      if(nd._kind==='Act'){idx++; if(a===nd)return idx;}
      else { for(const e of (a.eps||[])){ if(nd._kind==='Episode'){idx++; if(e===nd)return idx;} } }
    }
  }
  return idx;
}
function numLabel(nd,compact){
  const g=globalIndex(nd);
  if(compact)return roman(g);
  if(nd._kind==='Book')return 'Book '+roman(g);
  if(nd._kind==='Act')return 'Act '+roman(g);
  if(nd._kind==='Episode')return 'Ep '+roman(g);
  if(nd._kind==='Chapter')return 'Ch '+roman(g);
  return roman(g);
}
function nmOf(nd){return nd.name || (nd._kind==='Book'?'Book '+roman(nd.n) : nd._kind==='Chapter'?'Chapter '+roman(nd.n) : nd._short||nd.t);}
function subOf(nd){return nd.sub || (nd._kind==='Chapter'?nd.t : '');}
function openLevel(node){
  leaveView(); P=null;
  _onDash=false;
  sheet.className='sheet';
  current=null; fabs.hidden=true; var _sb=document.getElementById('statusBar'); if(_sb)_sb.hidden=true; var _ic=document.getElementById('insToolbar'); if(_ic)_ic.hidden=true;
  setPosition(node); drawOrrery();
  where.innerHTML = pathLabel(node);
  const kind=node._kind;
  let extraFields='', children='', childLbl='', kicker='';
  if(kind==='Book'){
    kicker='Book';
    extraFields=[
      fld(node,'does','What this book is','What this book is about at the broadest level'),
      fld(node,'turn','Its turn in the trilogy','How this book moves the whole arc'),
    ].join('');
    childLbl='Acts';
    children=`<div class="cards">`+(node.acts||[]).map(a=>cardHTML(a)).join('')+`</div>`;
  } else if(kind==='Act'){
    kicker='Act · Book '+node._parent.n;
    extraFields=[
      fld(node,'does','What this act does','The act\'s job in the book'),
      fld(node,'echo','Recursive role / echoes','Where this act\'s elements recur across the trilogy',true),
    ].join('');
    childLbl='Episodes';
    children=`<div class="cards">`+(node.eps||[]).map(e=>cardHTML(e)).join('')+`</div>`;
  } else if(kind==='Episode'){
    kicker='Episode · '+node._parent._short;
    extraFields=[
      fld(node,'does','What this episode does','The episode\'s job in the act'),
      fld(node,'shape','Its three chapters\' shape','How the three chapters move together',true),
    ].join('');
    childLbl='Chapters';
    children=`<div class="cards">`+(node.ch||[]).map(c=>cardHTML(c)).join('')+`</div>`;
  }
  const scriptNote = kind==='Episode' ? `
    <div class="soon" id="epScript">
      <div class="soon-k">Screenplay mode</div>
      <div class="soon-t">Write this episode as a film / TV script — scene headings, action, dialogue.</div>
      <span class="soon-tag">Coming soon</span>
    </div>` : '';
  const birdseye = `
    <div class="birdseye" id="birdsEye">
      <button class="be-head" id="beToggle">
        <span class="be-t">Descriptions — edit the whole structure from here</span>
        <span class="be-cv">show</span>
      </button>
      <div class="be-body" id="beBody" hidden>
        <div class="be-pick">List
          <button class="be-lvl" data-lvl="Act">Acts</button>
          <button class="be-lvl" data-lvl="Episode">Episodes</button>
          <button class="be-lvl" data-lvl="Chapter">Chapters</button>
        </div>
        <div class="be-rows" id="beRows"></div>
      </div>
    </div>`;
  sheet.innerHTML = pathBar(node) + `
    <div class="lvl-kind">${kicker}</div>
    <div class="fieldset">
      <div class="fld"><label>Name</label>
        <div class="inp nm" data-k="name" contenteditable="true" spellcheck="false" data-ph="e.g. Act I">${esc(nmOf(node))}</div></div>
      <div class="fld"><label>Subtitle</label>
        <div class="inp sub" data-k="sub" contenteditable="true" spellcheck="false" data-ph="e.g. a subtitle">${esc(subOf(node))}</div></div>
      ${extraFields}
    </div>
    ${scriptNote}
    ${birdseye}
    <div class="children-lbl">${childLbl}</div>
    ${children}
  `;
  wirePath(node);
  wireFields(node);
  wireCards(node);
  wireBirdsEye(node);
  flowSheet();
}
function descKeyOf(kind){ return kind==='Chapter' ? 'theme' : 'does'; }
function allOfLevel(kind){
  const out=[];
  STRUCT.books.forEach(b=>{
    if(kind==='Act') (b.acts||[]).forEach(a=>out.push({node:a,book:b}));
    else if(kind==='Episode') (b.acts||[]).forEach(a=>(a.eps||[]).forEach(e=>out.push({node:e,book:b})));
    else if(kind==='Chapter') (b.acts||[]).forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>out.push({node:c,book:b}))));
  });
  return out;
}
let _beLevel='Act';
function wireBirdsEye(node){
  const body=document.getElementById('beBody'), toggle=document.getElementById('beToggle');
  if(!toggle) return;
  toggle.onclick=()=>{ const hidden=body.hidden; body.hidden=!hidden;
    document.getElementById('birdsEye').classList.toggle('wide', hidden);
    toggle.querySelector('.be-cv').textContent=hidden?'hide':'show';
    if(hidden) renderBeRows(); };
  document.querySelectorAll('#birdsEye .be-lvl').forEach(btn=>btn.onclick=()=>{
    _beLevel=btn.dataset.lvl; renderBeRows(); });
  _beLevel = node._kind==='Book'?'Act' : node._kind==='Act'?'Episode' : 'Chapter';
}
function renderBeRows(){
  const rows=document.getElementById('beRows'); if(!rows) return;
  document.querySelectorAll('#birdsEye .be-lvl').forEach(b=>b.classList.toggle('sel',b.dataset.lvl===_beLevel));
  const key=descKeyOf(_beLevel);
  rows.innerHTML = allOfLevel(_beLevel).map(({node,book})=>{
    const label = _beLevel==='Chapter' ? ('Ch '+roman(node.n)+' · '+(node.t||'')) : (nmOf(node)+(subOf(node)?' — '+subOf(node):''));
    return `<div class="be-row">
      <div class="be-row-k" title="Book ${book.n}">${roman(book.n)} · ${label}</div>
      <div class="be-row-d" contenteditable="true" spellcheck="false" data-beid="${idOf(node)}"
        data-ph="Add a description…">${(node[key]||'').replace(/</g,'&lt;')}</div>
    </div>`;
  }).join('');
  rows.querySelectorAll('[data-beid]').forEach(el=>{
    el.addEventListener('input',()=>{ const n=byId(el.dataset.beid); if(n){ n[descKeyOf(_beLevel)]=el.textContent; markDirty(); } });
  });
}
function fld(node,key,label,ph,echo){
  return `<div class="fld ${echo?'echo':''}"><label>${label}</label>
    <div class="inp" data-k="${key}" contenteditable="true" spellcheck="false" data-ph="${ph||('Add '+label.toLowerCase()+'…')}">${esc(node[key]||'')}</div></div>`;
}
function wireFields(node){
  sheet.querySelectorAll('.inp[data-k]').forEach(inp=>{
    inp.addEventListener('input',()=>{
      node[inp.dataset.k]=inp.textContent;
      if(inp.dataset.k==='name'||inp.dataset.k==='sub'){ liveRetitle(node); }
      markDirty();
    });
  });
}
function liveRetitle(node){
  renderRailCurrent();
  rebuildJump();
  const chain=[];let n=node;while(n){chain.unshift(n);n=n._parent;}
}
function cardHTML(child){
  const k=child._kind, st=child.state||'blank';
  const badge = k==='Chapter' ? `<span class="dotstate ${st}"></span>Ch ${roman(child.n)}` : numLabel(child);
  const sub = subOf(child) || child.does || '';
  const meta = k==='Chapter' ? (st==='done'?'drafted':st==='started'?'in progress':'blank') : '';
  return `<div class="card" data-cid="${idOf(child)}">
    <div class="ck">${badge}</div>
    <div class="cname">${esc(k==='Chapter'?child.t:nmOf(child))}</div>
    ${sub?`<div class="cth">${esc(sub)}</div>`:''}
    ${meta?`<div class="cmeta">${meta}</div>`:''}
  </div>`;
}
function wireCards(node){
  sheet.querySelectorAll('.card[data-cid]').forEach(cd=>{
    const child=byId(cd.dataset.cid);
    if(!child)return;
    cd.onclick=()=>{ if(child._kind==='Chapter')openChapter(child);
      else{openLevel(child);const m={Act:'act',Episode:'ep'}[child._kind];renderRail(m,child);} };
  });
}
function pathLabel(node){
  const chain=[];let n=node;while(n){chain.unshift(n);n=n._parent;}
  return chain.map(nd=>nmOf(nd)).join(' · ');
}
function openChapter(ch){
  leaveView();
  _onDash=false;
  current=ch;
  const ep=ch._parent, act=ep._parent, book=act._parent;
  setPosition(ch); drawOrrery();
  where.innerHTML='Book '+book.n+' · '+ep.t+' · <b>'+ch.t+'</b>';
  const chaps=ep.ch; const i=chaps.indexOf(ch);
  const before=chaps[i-1], after=chaps[i+1];
  const play=(ch.play&&ch.play.length)?ch.play:['—'];
  const hasDraft = ch.draft && ch.draft.length>0;
  const lastLine = hasDraft ? (proseOf(ch.draft).trim().split('\n').filter(Boolean).pop()||'') : '';
  sheet.className='sheet chsheet';
  sheet.innerHTML = `
    <div class="chhead">
      <div class="chtag">Chapter ${roman(ch.n)} · ${numLabel(book)}</div>
      <div class="chcanon" id="chCanon"></div>
      <div class="chtitle" contenteditable="true" spellcheck="false" id="chTitle"></div>
      ${ch.theme?`<div class="chtheme">${esc(ch.theme)}</div>`:''}
      ${ lastLine ? `<div class="pickup"><span class="pickup-lbl">picking up from</span> …${lastLine.slice(-120).replace(/</g,'&lt;')}</div>` : '' }
    </div>
    <div class="plates-bar" id="platesBar"></div>
    <div class="plates" id="plates"></div>
  `;
  document.getElementById('statusBar').hidden=false;
  document.getElementById('insToolbar').hidden=false;
  const ct=document.getElementById('chTitle');
  ct.textContent=ch.t||'';
  ct.addEventListener('input',()=>{ch.t=ct.textContent;_pendingCh.add(ch);renderRailCurrent();rebuildJump();markDirty();});
  _sessionBaseWords = wordsIn(proseOf(ch.draft));
  P={ch, plates:parsePlates(ch.draft), overview:false, lastEl:null};
  renderPlates();
  updateStatus();
  wireInserts();
  fabs.hidden=false;
  flowSheet();
  wireGoal();
  fillCanon(ch);
}
async function fillCanon(ch){
  const box=document.getElementById('chCanon'); if(!box||!window.TL||!TL.eventsInChapter) return;
  const book=ch._parent&&ch._parent._parent&&ch._parent._parent._parent; if(!book) return;
  const local=ch.n-(book.n-1)*27;
  let list=[]; try{ list=await TL.eventsInChapter(book.n, local); }catch(e){ list=[]; }
  if(current!==ch) return;
  box.innerHTML='';
  list.forEach(it=>{
    const b=document.createElement('button'); b.className='chcanon-ev'+(it.open?' open':'');
    b.title=(it.desc?it.desc+'\n\n':'')+'Show it on the timeline';
    b.innerHTML='<span class="cw"></span><span class="ct"></span>';
    b.querySelector('.cw').textContent=it.when; b.querySelector('.ct').textContent=it.title;
    b.onclick=()=>TL.openEvent(it.key);
    box.appendChild(b);
  });
  const add=document.createElement('button'); add.className='chcanon-add';
  add.textContent=list.length?'+ Timeline event':'+ Add a timeline event to this chapter';
  add.title='A new event on the timeline, set in this chapter';
  add.onclick=()=>TL.addInChapter(book.n, local);
  box.appendChild(add);
}
window.TL=Object.assign(window.TL||{}, { onClose(){ if(current && document.getElementById('chCanon')) fillCanon(current); } });
let _sessionBaseWords=0;
function wordsIn(s){ const t=String(s||'').trim(); return t? t.split(/\s+/).length : 0; }
function updateStatus(){
  if(!current || !document.getElementById('plates')) return;
  const w=wordsIn(proseOf(current.draft));
  const session=Math.max(0, w-_sessionBaseWords);
  const pages=Math.max(0, Math.round(w/250));
  const read=Math.max(0, Math.round(w/230));
  const set=(id,v)=>{const e=document.getElementById(id); if(e)e.textContent=v;};
  set('sbWords', w.toLocaleString());
  const ct=chapterTarget(), ctw=document.getElementById('sbChTWrap');
  if(ctw){ ctw.hidden=!ct; set('sbChT', '~'+ct.toLocaleString()); }
  set('sbSession', (session>0?'+':'')+session.toLocaleString());
  set('sbPages', pages);
  set('sbRead', read);
  renderGoal(session);
}
function renderGoal(session){
  const goal=parseInt(MK.sessionGoal,10)||0;
  const bar=document.getElementById('sbGoalBar'), txt=document.getElementById('sbGoalTxt'),
        setBtn=document.getElementById('sbGoalSet'), fill=document.getElementById('sbGoalFill');
  if(!bar) return;
  if(!goal){ bar.hidden=true; txt.textContent=''; setBtn.hidden=false; return; }
  setBtn.hidden=true; bar.hidden=false;
  const pct=Math.min(100, Math.round(session/goal*100));
  fill.style.width=pct+'%';
  if(session>=goal){ txt.textContent='nice — '+session+' words, goal met'; txt.classList.add('met'); }
  else { txt.textContent=session+' / '+goal; txt.classList.remove('met'); }
}
function wireGoal(){
  const setBtn=document.getElementById('sbGoalSet'), txt=document.getElementById('sbGoalTxt');
  if(setBtn) setBtn.onclick=()=>{
    const wrap=document.getElementById('sbGoalWrap'); if(!wrap || wrap.querySelector('.sb-goal-in')) return;
    const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.step='50'; inp.className='sb-goal-in';
    inp.placeholder='words'; inp.value=parseInt(MK.sessionGoal,10)||'';
    inp.title='A gentle goal for this sitting. Empty or 0 clears it. Enter sets it, Esc cancels.';
    setBtn.hidden=true; txt.hidden=true; document.getElementById('sbGoalBar').hidden=true;
    wrap.appendChild(inp); inp.focus(); inp.select();
    let done=false;
    const finish=(commit)=>{ if(done)return; done=true;
      if(commit){ const n=parseInt(String(inp.value).replace(/[^\d]/g,''),10); MK.sessionGoal=n>0?n:0; markDirty(); }
      inp.remove(); txt.hidden=false; updateStatus(); };
    inp.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();finish(true);} else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);} };
    inp.onblur=()=>finish(true);
  };
  if(txt) txt.onclick=()=>{ document.getElementById('sbGoalSet').click(); };
}
function stripBeatNotes(s){ return proseOf(s).replace(/\[\[\s*note:[\s\S]*?\]\]/g,'').replace(/\n{3,}/g,'\n\n'); }
const ROSE_SVG='<svg viewBox="0 0 120 24" width="92" height="20" aria-hidden="true">'
  +'<path d="M60 12 C 52 2, 40 2, 40 12 C 40 22, 52 22, 60 12 C 68 2, 80 2, 80 12 C 80 22, 68 22, 60 12 Z" '
  +'fill="none" stroke="currentColor" stroke-width="1.1"/>'
  +'<circle cx="60" cy="12" r="1.6" fill="currentColor"/>'
  +'<line x1="6" y1="12" x2="36" y2="12" stroke="currentColor" stroke-width="1" opacity=".5"/>'
  +'<line x1="84" y1="12" x2="114" y2="12" stroke="currentColor" stroke-width="1" opacity=".5"/></svg>';
function renderProsePara(para, first){
  const t=para.trim();
  if(/^([*#~]\s*){1,5}$/.test(t)){
    return `<div class="pp-break">${ROSE_SVG}</div>`;
  }
  if(/^#{1,3}\s+/.test(t)){
    return `<div class="pp-head">${t.replace(/^#{1,3}\s+/,'').replace(/</g,'&lt;')}</div>`;
  }
  return `<p style="margin:0 0 .8em;text-indent:${first?'0':'1.4em'}">${t.replace(/</g,'&lt;').replace(/\n/g,' ')}</p>`;
}
const INSERTS={
  dialogue:{ before:'\n"', after:'"\n' },
  break:{ before:'\n\n* * *\n\n', after:'' },
  beat:{ before:'\n[[ note: ', after:' ]]\n' },
  time:{ before:'\n## ', after:'\n' }
};
function insertAtCaret(before,after){
  const pr=activePlate(); if(!pr) return;
  if(document.activeElement!==pr) pr.focus();
  const sel=window.getSelection();
  let range;
  if(sel && sel.rangeCount && pr.contains(sel.anchorNode)){ range=sel.getRangeAt(0); }
  else { range=document.createRange(); range.selectNodeContents(pr); range.collapse(false); }
  range.deleteContents();
  const text=before+after;
  const tn=document.createTextNode(text);
  range.insertNode(tn);
  const caret=document.createRange();
  caret.setStart(tn, before.length); caret.setEnd(tn, before.length);
  sel.removeAllRanges(); sel.addRange(caret);
  pr.dispatchEvent(new Event('input'));
}
function wireInserts(){
  document.querySelectorAll('#insToolbar .ins-btn').forEach(b=>{
    b.onmousedown=(e)=>{ e.preventDefault(); };
    b.onclick=()=>{ if(b.dataset.ins==='snippets'){ openSnippets(); return; } const spec=INSERTS[b.dataset.ins]; if(spec)insertAtCaret(spec.before,spec.after); };
  });
}
function wireProseKeys(prose){
  prose.addEventListener('keydown',(e)=>{
    if(e.altKey && !e.ctrlKey && !e.metaKey){
      const k=e.key.toLowerCase();
      if(k==='n'){ e.preventDefault(); insertAtCaret(INSERTS.beat.before, INSERTS.beat.after); }
      else if(k==='d'){ e.preventDefault(); insertAtCaret(INSERTS.dialogue.before, INSERTS.dialogue.after); }
      else if(k==='b'){ e.preventDefault(); insertAtCaret(INSERTS.break.before, INSERTS.break.after); }
    }
  });
  prose.addEventListener('keydown',(e)=>{
    if(e.key===' ' || e.key==='Enter' || /^[.,;:!?)"'»]$/.test(e.key)){
      if(tryExpandSnippet(e.key)) e.preventDefault();
    }
  });
}
const SNIPPET_DEFAULTS={};
function snippetMap(){
  const all=Object.assign({}, SNIPPET_DEFAULTS, (MK.snippets||{}));
  Object.keys(all).forEach(k=>{ if(!all[k]) delete all[k]; });
  return all;
}
function snipSet(key, term){
  MK.snippets=Object.assign({}, MK.snippets||{});
  if(term) MK.snippets[key]=term;
  else if(SNIPPET_DEFAULTS[key]) MK.snippets[key]='';
  else delete MK.snippets[key];
  markDirty();
}
function snipKeyOk(k){ return /^[a-z]{1,12}$/.test(k); }
function renderSnippets(){
  const list=document.getElementById('snipList'), map=snippetMap();
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const keys=Object.keys(map).sort();
  list.innerHTML=keys.length?keys.map(k=>'<div class="snip-row" data-k="'+esc(k)+'"><span class="snip-semi">;</span><span class="snip-key">'+esc(k)+'</span>'+
    '<input class="snip-term" value="'+esc(map[k])+'" spellcheck="false"><button class="chipbtn snip-del" title="Remove this snippet">Remove</button></div>').join('')
    :'<div class="snip-msg">No snippets yet. Add one below.</div>';
  list.querySelectorAll('.snip-row').forEach(row=>{
    const k=row.dataset.k, inp=row.querySelector('.snip-term');
    inp.onchange=()=>{ const v=inp.value.trim(); if(v){ snipSet(k,v); snipMsg('Saved: ;'+k+' becomes '+v); } else { inp.value=snippetMap()[k]||''; } };
    row.querySelector('.snip-del').onclick=()=>{ snipSet(k,''); renderSnippets(); snipMsg(';'+k+' removed'); };
  });
}
function snipMsg(t){ const m=document.getElementById('snipMsg'); if(m) m.textContent=t||''; }
function openSnippets(){
  renderSnippets(); snipMsg('');
  document.getElementById('snipModal').hidden=false;
  setTimeout(()=>{ const k=document.getElementById('snipNewKey'); if(k) k.focus(); }, 30);
}
(function wireSnippets(){
  const close=()=>{ document.getElementById('snipModal').hidden=true; };
  document.getElementById('snipClose').onclick=close;
  document.getElementById('snipModal').addEventListener('mousedown',e=>{ if(e.target.id==='snipModal') close(); });
  const add=()=>{
    const kEl=document.getElementById('snipNewKey'), tEl=document.getElementById('snipNewTerm');
    const k=kEl.value.trim().replace(/^;/,'').toLowerCase(), t=tEl.value.trim();
    if(!snipKeyOk(k)){ snipMsg('A shortcut is 1 to 12 letters, a to z.'); kEl.focus(); return; }
    if(!t){ snipMsg('Write what ;'+k+' should become.'); tEl.focus(); return; }
    const had=snippetMap()[k];
    snipSet(k,t); kEl.value=''; tEl.value=''; renderSnippets();
    snipMsg(had?(';'+k+' now becomes '+t+' (was '+had+')'):('Added: ;'+k+' becomes '+t)); kEl.focus();
  };
  document.getElementById('snipAdd').onclick=add;
  ['snipNewKey','snipNewTerm'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } if(e.key==='Escape') close(); }));
})();
function tryExpandSnippet(boundaryKey){
  const pr=activePlate(); const sel=window.getSelection();
  if(!pr || !sel.rangeCount) return false;
  const node=sel.anchorNode; if(!node || node.nodeType!==3) return false;
  const off=sel.anchorOffset;
  const text=node.nodeValue.slice(0,off);
  const m=text.match(/;([A-Za-z]{1,12})$/);
  if(!m) return false;
  const term=snippetMap()[m[1].toLowerCase()];
  if(!term) return false;
  const start=off-m[0].length;
  const r=document.createRange(); r.setStart(node,start); r.setEnd(node,off); r.deleteContents();
  const add=(boundaryKey==='Enter')?'\n':boundaryKey;
  const tn=document.createTextNode(term+add);
  r.insertNode(tn);
  const caret=document.createRange(); caret.setStart(tn,tn.length); caret.collapse(true);
  sel.removeAllRanges(); sel.addRange(caret);
  if(pr) pr.dispatchEvent(new Event('input'));
  return true;
}
const MK={ tag:'',
  title:'Evrynthing',
  author:'',
  intro:'One book of eighty-one chapters, built on threes.',
  maxwords:'120,000',
  statsBook:1,
  sessionGoal:0,
  snippets:{} };
const MATTER_DEFAULTS=[
  {key:'halftitle', label:'Half-title', where:'front', body:'{{TITLE}}'},
  {key:'titlepage', label:'Title page', where:'front', body:'{{TITLE}}\n\n{{TAG}}\n\na novel by'},
  {key:'copyright', label:'Copyright', where:'front', body:'Copyright © {{YEAR}}.\nAll rights reserved.\n\nThis is a work of fiction. Names, characters, places and incidents are the product of the author’s imagination.\n\nFirst edition.'},
  {key:'dedication', label:'Dedication', where:'front', body:'For —'},
  {key:'epigraph', label:'Epigraph', where:'front', body:'“One is all, and all is one.”'},
  {key:'foreword', label:'Foreword / Preface', where:'front', body:'(Your foreword goes here — write a few words about how the book came to be, or delete this page.)'},
  {key:'acknowledgements', label:'Acknowledgements', where:'back', body:'Thanks to —\n\n(List the people who helped you get here.)'},
  {key:'aboutauthor', label:'About the author', where:'back', body:''},
];
function ensureMatter(){
  if(!MK.matter){ MK.matter = MATTER_DEFAULTS.map(m=>({...m})); }
  else {
    MATTER_DEFAULTS.forEach(def=>{ if(!MK.matter.some(m=>m.key===def.key)) MK.matter.push({...def}); });
  }
  return MK.matter;
}
function matterText(body){
  return String(body||'')
    .replace(/\{\{TITLE\}\}/g, MK.title||'Evrynthing')
    .replace(/\{\{TAG\}\}/g, MK.tag||'')
    .replace(/\{\{YEAR\}\}/g, new Date().getFullYear());
}
function countStates(book){
  let done=0,started=0,blank=0,words=0,total=0;
  const books = book ? [book] : STRUCT.books;
  books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{
    total++;
    const s=c.state||'blank'; if(s==='done')done++;else if(s==='started')started++;else blank++;
    words += wordsIn(proseOf(c.draft));
  }))));
  return {done,started,blank,words,total};
}
function targetWords(){ return parseInt(String(MK.maxwords||'').replace(/[^\d]/g,''),10)||0; }
function chapterTarget(){ const t=targetWords(); return t? Math.round(t/81) : 0; }
function progressPct(s){
  const T=targetWords();
  if(T) return Math.min(100, s.words/(T*s.total/81)*100);
  return s.total? (s.done+s.started*0.4)/s.total*100 : 0;
}
function fmtPct(p){ return p>0 && p<10 ? String(Math.round(p*10)/10) : String(Math.round(p)); }
function recentlyTouched(limit){
  const all=[];
  STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>all.push(c)))));
  const worked=all.filter(c=>c._touched || (c.draft&&c.draft.trim()) || c.state==='started' || c.state==='done');
  worked.sort((x,y)=>(y._touched||0)-(x._touched||0));
  const list = worked.length? worked : [all[0]];
  return limit? list.slice(0,limit) : list;
}
function lastTouched(){ return recentlyTouched(1)[0]; }
function bookTitleOf(n){ const b=STRUCT.books[n-1]; return (b&&b.sub&&b.sub.trim()) || (b&&b.booktitle) || ('Book '+roman(n)); }
let _onDash=false;
function dashboard(){
  leaveView(); P=null;
  _onDash=true;
  current=null; fabs.hidden=true; var _sb=document.getElementById('statusBar'); if(_sb)_sb.hidden=true; var _ic=document.getElementById('insToolbar'); if(_ic)_ic.hidden=true;
  _cur={book:null,act:null,ep:null,ch:null};
  drawOrrery();
  document.getElementById('app').classList.remove('focus');
  sheet.className='sheet dashsheet';
  const s=countStates();
  const pct=progressPct(s);
  const recent=recentlyTouched(6); const lc=recent[0];
  const lcBook=lc._parent&&lc._parent._parent&&lc._parent._parent._parent;
  const lcText=proseOf(lc.draft||'').trim(), lcWords=wordsIn(lcText);
  const lcPlates=parsePlates(lc.draft||'').length;
  const lastLine=lcText ? (lcText.split('\n').filter(l=>l.trim()).pop()||'') : '';
  const pick=lc.loop || (lastLine ? '…'+lastLine.slice(-240) : '');
  const target=(parseInt(String(MK.maxwords||'').replace(/[^\d]/g,''),10)||0);
  const books=STRUCT.books.map(b=>{
    const bs=countStates(b), bp=fmtPct(progressPct(bs));
    const cells=b.acts.map(a=>`<div class="d2-act">`+(a.eps||[]).map(e=>`<div class="d2-ep">`+
      (e.ch||[]).map(c=>`<button class="d2-sq ${c.state||'blank'}" data-cid="${idOf(c)}" title="Ch ${roman(c.n)} · ${esc(c.t)}${c.state==='started'?' (in progress)':c.state==='done'?' (written)':''}"></button>`).join('')
      +`</div>`).join('')+`</div>`).join('');
    return `<div class="d2-book">
      <button class="d2-bname" data-bid="${idOf(b)}" title="Open Book ${roman(b.n)}"><span class="rmark">${roseOwn(b.n)}</span>
        <span class="t"><span class="k">Book ${roman(b.n)}</span><span class="n">${esc(bookTitleOf(b.n))}</span></span></button>
      <div class="d2-cells">${cells}</div>
      <div class="d2-bstat"><b>${bp}%</b><br>${bs.words.toLocaleString()} words</div>
    </div>`;
  }).join('');
  const spines=STRUCT.books.map(b=>`<span class="d2-sp bv-theme-${b.n}" data-vol="${b.n}" title="Read ${esc(bookTitleOf(b.n))}">
      <span class="sp-vol">${roman(b.n)}</span><span class="sp-t">${esc(bookTitleOf(b.n))}</span><span class="rmark">${roseBook(b.n)}</span></span>`).join('');
  sheet.innerHTML=`
   <div class="dash2">
    <div class="d2-head">
      <span class="rmark">${roseMain()}</span>
      <div class="d2-titles">
        <div class="dtag">${esc(MK.tag||'A trilogy in three books')}</div>
        <h1 class="dtitle">${esc(MK.title||'Evrynthing')}</h1>
        <p class="dintro">${esc(MK.intro||'')}<span class="dintro-stats">${MK.intro?' · ':''}by ${esc(MK.author||'')}</span></p>
      </div>
      <button class="dsettings" id="dashSettings" title="Book settings">Settings</button>
    </div>
    <div class="d2-row">
      <div class="d2-box d2-resume" id="resumeBox">
        <div class="d2-lbl">Jump back in</div>
        <div class="d2-rname">${esc(lc.t)}</div>
        <div class="d2-rsub">Chapter ${roman(lc.n)} · ${esc(nmOf(lc._parent))}${lc._parent&&lc._parent.sub?' — '+esc(lc._parent.sub):''}${lcBook?' · Book '+roman(lcBook.n):''}</div>
        <div class="d2-rpick">${pick?esc(pick):'A blank page. Start anywhere: plates let you begin in the middle.'}</div>
        <div class="d2-ract">
          <button class="startbtn" data-rcid="${idOf(lc)}">Continue writing</button>
          <span class="d2-rmeta"><b>${lcWords.toLocaleString()}</b> words${lcPlates>1?` · <b>${lcPlates}</b> plates`:''}</span>
        </div>
        ${recent.length>1?`<div class="d2-recent">
          <div class="drl-lbl">Recently worked on</div>
          ${recent.slice(1).map(c=>`<button class="drl-row" data-rcid="${idOf(c)}">
            <span class="drl-dot ${c.state||'blank'}"></span>
            <span class="drl-name">${esc(c.t)}</span>
            <span class="drl-sub">Ch ${roman(c.n)} · ${esc(nmOf(c._parent))}</span>
          </button>`).join('')}
        </div>`:''}
      </div>
      <div class="d2-box d2-shelf" id="dOpenBook" title="Read it like the finished thing">
        <div class="d2-lbl">Open the book</div>
        <div class="d2-spines" id="dMiniShelf">${spines}</div>
        <div class="dbs-hint">Pick a volume to read it bound and paginated</div>
      </div>
    </div>
    <div class="d2-box">
      <div class="d2-lbl">The trilogy</div>
      <div class="d2-top">
        <div class="d2-pct">${fmtPct(pct)}<span>%</span></div>
        <div class="d2-vitals">
          <span><b>${s.words.toLocaleString()}</b> words drafted</span>
          <span><b>~${(s.words*0.9/250|0)||0}</b> pages</span>
          <span><b>${s.done+s.started}</b> of 81 chapters touched</span>
          ${target?`<span class="muted">target ${target.toLocaleString()} words · ~${chapterTarget().toLocaleString()} per chapter</span>`:''}
        </div>
      </div>
      <div class="d2-bar"><i style="width:${pct}%"></i></div>
      <div class="d2-books">${books}</div>
      <div class="d2-legend"><span><i class="done"></i>${s.done} written</span><span><i class="started"></i>${s.started} started</span><span><i></i>${s.blank} blank</span>
        <span class="grow"></span><span>Groups of three are episodes, groups of nine are acts</span></div>
    </div>
   </div>`;
  flowSheet();
  sheet.querySelectorAll('[data-rcid]').forEach(x=>x.onclick=()=>{ const c=byId(x.dataset.rcid); if(c)openChapter(c); });
  sheet.querySelectorAll('#dMiniShelf .d2-sp').forEach(sp=>sp.onclick=(e)=>{ e.stopPropagation(); openBookView(parseInt(sp.dataset.vol,10)); });
  const ob=sheet.querySelector('#dOpenBook'); if(ob)ob.onclick=()=>openBookView();
  sheet.querySelectorAll('.d2-sq[data-cid]').forEach(h=>h.onclick=()=>{ const c=byId(h.dataset.cid); if(c)openChapter(c); });
  sheet.querySelectorAll('.d2-bname[data-bid]').forEach(b=>b.onclick=()=>{ const n=byId(b.dataset.bid); if(n)openLevel(n); });
  const sb=sheet.querySelector('#dashSettings'); if(sb)sb.onclick=openBookSettings;
}
function renderPerBook(){
  const body=document.getElementById('dPerBookBody'); if(!body) return;
  const n=Math.min(Math.max(parseInt(MK.statsBook,10)||1,1),STRUCT.books.length);
  const b=STRUCT.books[n-1]; const bs=countStates(b);
  const bpct=progressPct(bs);
  const pages=(bs.words*0.9/250|0)||0;
  document.querySelectorAll('#dPerBook .dpb-tab').forEach(t=>t.classList.toggle('sel',parseInt(t.dataset.sb,10)===n));
  body.innerHTML=`
    <div class="dpb-name">${bookTitleOf(n)}</div>
    <div class="dpb-row"><div class="dpb-bar"><i style="width:${bpct}%"></i></div><span class="dpb-pct">${fmtPct(bpct)}%</span></div>
    <div class="dpb-stats">
      <span><b>${bs.done}</b> written</span>
      <span><b>${bs.started}</b> started</span>
      <span><b>${bs.blank}</b> blank</span>
      <span><b>${bs.words.toLocaleString()}</b> words</span>
      <span class="muted">~${pages} pages · ${bs.total} chapters</span>
    </div>`;
}
document.getElementById('homeBtn').onclick=dashboard;
(async function boot(){
  try{ await loadBook(); }catch(e){ console.error('loadBook failed',e);
    SAVE_LOCK='all'; LOAD_PROBLEM='The manuscript could not be loaded. Saving is paused so nothing can be overwritten. Close the Writer and open it again.';
    if(!STRUCT.books.length)STRUCT=JSON.parse(JSON.stringify(SEED)); }
  showLoadProblem();
  try{ await loadLibrary(); }catch(e){ console.error('loadLibrary failed',e); }
  wireTree();
  try{ document.getElementById('brandRose').innerHTML=roseCoin(); document.getElementById('insBreakIc').innerHTML=roseMono(); }catch(e){}
  decorateIcons();
  drawOrrery();
  dashboard();
  try{ const r=JSON.parse(sessionStorage.getItem('writer-reopen')||'null'); sessionStorage.removeItem('writer-reopen');
    if(r && r.n!=null && Date.now()-r.at<60000){ const c=chapterByN(r.n); if(c) openChapter(c); } }catch(e){}
  if(window.writerAPI && window.writerAPI.onFilesChanged) window.writerAPI.onFilesChanged(()=>{ refreshFromDisk(); });
})();
function openPanel(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
  const el=document.getElementById(id); if(el) el.classList.add('show');
}
function closePanels(){
  const wasSettings=document.getElementById('settingsPanel').classList.contains('show');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
  if(wasSettings && _onDash) dashboard();
}
function openBookSettings(){
  const map={setTitle:'title',setTag:'tag',setIntro:'intro',setAuthor:'author',setMax:'maxwords'};
  Object.entries(map).forEach(([id,key])=>{
    const el=document.getElementById(id); if(!el)return;
    el.value = MK[key]!=null ? MK[key] : '';
    el.oninput=()=>{ MK[key] = (key==='maxwords') ? (parseInt(el.value,10)||0) : el.value; markDirty(); };
  });
  document.getElementById('setMatterBtn').onclick=openMatterEditor;
  openPanel('settingsPanel');
}
function openMatterEditor(){
  ensureMatter();
  const list=document.getElementById('matterList');
  const sectionFront=MK.matter.filter(m=>m.where==='front');
  const sectionBack=MK.matter.filter(m=>m.where==='back');
  function block(m){
    return `<div class="matter-item">
      <div class="mi-head"><span class="mi-label">${m.label}</span>
        <label class="mi-toggle"><input type="checkbox" data-mk-show="${m.key}" ${m.hide?'':'checked'}> include</label></div>
      <textarea class="mi-body" data-mk-body="${m.key}" spellcheck="false" rows="4">${(m.body||'').replace(/</g,'&lt;')}</textarea>
    </div>`;
  }
  list.innerHTML =
    '<div class="matter-sec">Front matter</div>'+sectionFront.map(block).join('')+
    '<div class="matter-sec">Back matter</div>'+sectionBack.map(block).join('');
  list.querySelectorAll('[data-mk-body]').forEach(ta=>{
    ta.addEventListener('input',()=>{ const m=MK.matter.find(x=>x.key===ta.dataset.mkBody); if(m){m.body=ta.value;markDirty();} });
  });
  list.querySelectorAll('[data-mk-show]').forEach(cb=>{
    cb.addEventListener('change',()=>{ const m=MK.matter.find(x=>x.key===cb.dataset.mkShow); if(m){m.hide=!cb.checked;markDirty();} });
  });
  openPanel('matterPanel');
}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); closePanels(); });
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && document.querySelector('.panel.show')){ closePanels(); }
});
document.addEventListener('mousedown',e=>{
  const open=document.querySelector('.panel.show'); if(!open) return;
  if(!e.target.closest('.panel') && !e.target.closest('.fab') && !e.target.closest('.progresschip')
     && !e.target.closest('.dict-btn') && !e.target.closest('#dashSettings')){ closePanels(); }
});
document.getElementById('helpBtn').onclick=()=>openPanel('helpPanel');
const saveBtn=document.getElementById('saveBtn'), saveLabel=document.getElementById('saveLabel');
let dirty=false, _editSeq=0, _autoT=null, _saveChain=Promise.resolve();
const _pendingCh=new Set();
const AUTOSAVE_MS=1500;
function markDirty(){
  _editSeq++;
  clearTimeout(_autoT); _autoT=setTimeout(()=>{ if(dirty) doSave(); }, AUTOSAVE_MS);
  if(dirty)return; dirty=true; saveBtn.classList.remove('saved'); saveLabel.textContent='Save';
}
function leaveView(){
  if(dirty || _pendingCh.size) doSave();
}
function doSave(){
  clearTimeout(_autoT);
  if(SAVE_LOCK==='all'){ saveLabel.textContent='Saving paused'; showLoadProblem(); return Promise.resolve(false); }
  if(current) _pendingCh.add(current);
  const seq=_editSeq;
  const chs=[..._pendingCh]; _pendingCh.clear();
  const jobs=chs.map(ch=>{
    if(proseOf(ch.draft).trim() && ch.state==='blank') ch.state='started';
    const file=chapterFile(ch.n);
    if(_diskMd[file]!=null ? _diskMd[file]===buildChapterMd(ch) : (!String(ch.draft||'').trim() && (ch.state||'blank')==='blank' && !ch.loop)) return null;
    ch._touched=Date.now();
    return {ch, file, text:buildChapterMd(ch)};
  }).filter(Boolean);
  const bj = (SAVE_LOCK==='structure' || _mustReload) ? null : bookJsonText();
  saveLabel.textContent='Saving…';
  _saveChain=_saveChain.then(async()=>{
    const failed=[];
    for(const j of jobs){ try{ if(window.writerAPI) await writeChapter(j.ch, j.file, j.text); }catch(e){ failed.push(j.ch); console.error('save failed',j.file,e); } }
    let bjFail=false;
    if(bj!=null){ try{ if(window.writerAPI) await writeBook(bj); }catch(e){ bjFail=true; console.error('save failed book.json',e); } }
    if(failed.length || bjFail){
      failed.forEach(c=>_pendingCh.add(c));
      dirty=true; saveBtn.classList.remove('saved'); saveLabel.textContent='Save failed';
      return false;
    }
    if(seq===_editSeq && !_pendingCh.size){
      dirty=false; saveBtn.classList.add('saved');
      saveLabel.textContent = SAVE_LOCK==='structure' ? 'Saved (chapters)' : 'Saved';
    }
    return true;
  });
  return _saveChain;
}
function showLoadProblem(){
  if(!LOAD_PROBLEM) return;
  let b=document.getElementById('loadProblem');
  if(!b){
    b=document.createElement('div'); b.id='loadProblem';
    b.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;max-width:640px;'
      +'padding:10px 16px;border-radius:8px;background:#3a1f1a;color:#f3e6d8;border:1px solid #c0392b;'
      +'font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
    document.body.appendChild(b);
  }
  b.textContent=LOAD_PROBLEM;
}
saveBtn.onclick=doSave;
if(window.writerAPI && window.writerAPI.onSaveNow){ window.writerAPI.onSaveNow(async()=>{
  try{ await doSave(); }catch(e){}
  try{ if(window.TL) await window.TL.save(); }catch(e){}
  try{ if(window.IP) await window.IP.save(); }catch(e){}
  try{ if(window.writerAPI.saveDone) window.writerAPI.saveDone(); }catch(e){}
}); }
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveBtn.click();}});
function allChaptersInOrder(){
  const out=[]; STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>out.push({c,b})))));
  return out;
}
document.getElementById('readBookBtn').onclick=()=>{ document.getElementById('readChoose').hidden=false; };
document.getElementById('readChooseClose').onclick=()=>{ document.getElementById('readChoose').hidden=true; };
document.getElementById('chooseManuscript').onclick=()=>{ document.getElementById('readChoose').hidden=true; openReader(); };
document.getElementById('chooseBook').onclick=()=>{ document.getElementById('readChoose').hidden=true; openBookView(); };
const Book = (function(){
  let vol=null;
  let pages=[];
  let spread=0;
  let coverOpen=false;
  const bv=()=>document.getElementById('bookview');
  function romanLower(n){ return roman(n).toLowerCase(); }
  function volumeContent(bookNum){
    ensureMatter();
    const book=STRUCT.books[bookNum-1];
    const items=[];
    MK.matter.filter(m=>m.where==='front' && !m.hide).forEach(m=>items.push({type:'matter',m}));
    book.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>items.push({type:'chapter',c}))));
    MK.matter.filter(m=>m.where==='back' && !m.hide).forEach(m=>items.push({type:'matter',m}));
    return items;
  }
  let pageCh=[];
  function esc2(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function tokensOf(para){
    const out=[]; para.split('\n').forEach((line,li)=>{ if(li) out.push('\n'); line.split(/\s+/).filter(Boolean).forEach(w=>out.push(w)); });
    while(out[0]==='\n') out.shift(); while(out[out.length-1]==='\n') out.pop();
    return out;
  }
  function pHtml(toks, indent, cut){
    let s='', br=true;
    for(const t of toks){ if(t==='\n'){ s+='<br>'; br=true; continue; } s+=(br?'':' ')+esc2(t); br=false; }
    return `<p class="pp${indent?'':' noind'}${cut?' cut':''}">${s}</p>`;
  }
  function paginate(bookNum){
    const items=volumeContent(bookNum);
    const L=document.getElementById('bvLeft'), cs=getComputedStyle(L);
    const H=L.offsetHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-4;
    const meas=document.createElement('div'); meas.className='bv-page';
    meas.style.cssText=`position:absolute;left:-99999px;top:0;visibility:hidden;flex:none;width:${L.offsetWidth}px;height:auto`;
    const body=document.createElement('div'); body.className='pp-body'; meas.appendChild(body);
    document.body.appendChild(meas);
    const fits=(html)=>{ body.innerHTML=html; return body.offsetHeight<=H; };
    const out=[{kind:'blank'}];
    let cur='', info=null;
    const flush=()=>{ if(cur) out.push(Object.assign({html:cur},info)); cur=''; };
    const toRecto=()=>{ if(out.length%2===0) out.push({kind:'blank'}); };
    let chi=-1;
    for(const it of items){
      if(it.type==='matter'){
        flush();
        out.push({kind:'matter',html:`<div class="pp-matter">${esc2(matterText(it.m.body)).replace(/\n/g,'<br>')}</div>`});
        continue;
      }
      const c=it.c; chi++;
      const clean=stripBeatNotes(c.draft||'').trim();
      if(!clean){
        const last=out[out.length-1];
        if(!cur && last && last.kind==='todo'){ last.to=c; last.chs.push(chi); continue; }
        flush(); toRecto(); out.push({kind:'todo',from:c,to:c,chs:[chi],chi}); continue;
      }
      flush(); toRecto();
      info={kind:'text',ch:c.t||'',chi,opener:true};
      cur=`<div class="pp-chnum">Chapter ${roman(c.n)}</div><h2 class="pp-ch">${esc2(c.t)}</h2>`;
      const next=()=>({kind:'text',ch:c.t||'',chi});
      const paras=clean.split(/\n[ \t]*\n/).map(p=>p.replace(/^\n+|\n+$/g,'')).filter(p=>p.trim());
      let afterHead=true;
      for(const para of paras){
        const t=para.trim();
        const isBreak=/^([*#~]\s*){1,5}$/.test(t), isHead=/^#{1,3}\s+/.test(t);
        if(isBreak||isHead){
          const html=isBreak?`<div class="pp-break">${ROSE_SVG}</div>`:`<div class="pp-head">${esc2(t.replace(/^#{1,3}\s+/,''))}</div>`;
          if(!fits(cur+html+'<p class="pp">x<br>x</p>')){ flush(); info=next(); }
          cur+=html; afterHead=true; continue;
        }
        let toks=tokensOf(para), indent=!afterHead; afterHead=false;
        while(toks.length){
          const whole=pHtml(toks,indent,false);
          if(fits(cur+whole)){ cur+=whole; break; }
          let lo=0, hi=toks.length-1;
          while(lo<hi){ const mid=(lo+hi+1)>>1; if(fits(cur+pHtml(toks.slice(0,mid),indent,true))) lo=mid; else hi=mid-1; }
          let k=lo;
          if(k===0){ if(cur){ flush(); info=next(); continue; } k=1; }
          const piece=toks.slice(0,k); while(piece[piece.length-1]==='\n') piece.pop();
          cur+=pHtml(piece,indent,true); flush(); info=next();
          toks=toks.slice(k); while(toks[0]==='\n') toks.shift(); indent=false;
        }
      }
    }
    flush();
    if(out.length%2!==0) out.push({kind:'blank'});
    document.body.removeChild(meas);
    const runHead=esc2(MK.title||'Evrynthing');
    pages=out.map((pg,i)=>{
      if(pg.kind==='blank') return '';
      if(pg.kind==='matter') return pg.html;
      if(pg.kind==='todo'){
        const one=pg.from===pg.to;
        return `<div class="pp-matter"><div class="pp-chnum" style="margin:0 0 1em">${one?'Chapter '+roman(pg.from.n):'Chapters '+roman(pg.from.n)+' – '+roman(pg.to.n)}</div>`
          +`${one?`<div style="font-style:normal;font-family:var(--disp);font-size:19px;margin-bottom:.6em">${esc2(pg.from.t)}</div>`:''}<div style="color:#8a7a55">not yet written</div></div><div class="pp-num">${i}</div>`;
      }
      const head=pg.opener ? '' : `<div class="pp-run">${i%2===0?runHead:esc2(pg.ch)}</div>`;
      return `${head}<div class="pp-body">${pg.html}</div><div class="pp-num">${i}</div>`;
    });
    pageCh=out.map(pg=>pg.chi==null?-1:pg.chi);
  }
  let _rsT=null;
  window.addEventListener('resize',()=>{
    if(!vol || bv().hidden || document.getElementById('bvStage').hidden) return;
    clearTimeout(_rsT); _rsT=setTimeout(()=>{
      const chi=Math.max(pageCh[spread+1]==null?-1:pageCh[spread+1], pageCh[spread]==null?-1:pageCh[spread]);
      const f1=pageCh.indexOf(chi), l1=pageCh.lastIndexOf(chi);
      const frac=(chi>=0 && l1>f1) ? (spread-f1)/(l1-f1+1) : 0;
      paginate(vol);
      let s=Math.min(spread,pages.length-2);
      if(chi>=0){ const f2=pageCh.indexOf(chi), l2=pageCh.lastIndexOf(chi); s=f2+Math.round(Math.max(0,frac)*(l2-f2+1)); }
      spread=Math.max(0,Math.min(s-(s%2),pages.length-2)); renderSpread();
    },180);
  });
  function renderSpread(){
    const L=document.getElementById('bvLeft'), R=document.getElementById('bvRight');
    L.innerHTML = pages[spread] || '';
    R.innerHTML = pages[spread+1] || '';
    const total=pages.length;
    const a=Math.max(1,spread), b=Math.min(spread+1,total-1);
    document.getElementById('bvPageNo').textContent = (a===b?`${a}`:`${a}–${b}`)+` of ${total-1}`;
    const scrub=document.getElementById('bvScrub'); scrub.max=Math.max(0,total-2); scrub.value=spread;
  }
  function turn(dir){
    const total=pages.length;
    if(dir>0 && spread+2<total){
      const R=document.getElementById('bvRight'); R.classList.add('turnFwd');
      setTimeout(()=>{ R.classList.remove('turnFwd'); spread+=2; renderSpread(); },600);
    } else if(dir<0){
      if(spread<=0){ closeCover(); return; }
      const L=document.getElementById('bvLeft'); L.classList.add('turnBack');
      setTimeout(()=>{ L.classList.remove('turnBack'); spread-=2; renderSpread(); },600);
    }
  }
  function openShelf(){
    bv().hidden=false;
    document.getElementById('bvStage').hidden=true;
    const shelf=document.getElementById('bvShelf'); shelf.hidden=false; shelf.classList.remove('picked'); shelf.innerHTML='';
    STRUCT.books.forEach(b=>{
      const sp=document.createElement('div'); sp.className='bv-spine bv-theme-'+b.n;
      sp.innerHTML=`<span class="sp-rose">${roseBook(b.n)}</span>
        <span class="sp-title">${esc(bookTitleOf(b.n))}</span>
        <span class="sp-author">${esc(MK.author||'')}</span>`;
      sp.onclick=()=>{ shelf.classList.add('picked'); setTimeout(()=>openVolume(b.n),420); };
      shelf.appendChild(sp);
    });
  }
  function openVolume(n){
    vol=n; spread=0; coverOpen=false;
    document.getElementById('bvShelf').hidden=true;
    document.getElementById('bvStage').hidden=false;
    const book=document.getElementById('bvBook');
    book.classList.remove('coveropen','bv-theme-1','bv-theme-2','bv-theme-3');
    book.classList.add('bv-theme-'+n);
    paginate(n);
    const cover=document.getElementById('bvCover'); cover.classList.remove('open');
    cover.innerHTML=`<span class="cv-rose">${roseBook(n)}</span><span class="cv-series">${esc(MK.title||'Evrynthing')}</span>
      <span class="cv-vol">Volume ${roman(n)}</span>
      <span class="cv-rule"></span>
      <span class="cv-title">${esc(bookTitleOf(n))}</span>
      <span class="cv-rule"></span>
      <span class="cv-author">${esc(MK.author||'')}</span>
      <span class="cv-hint">turn the page to begin</span>`;
    renderNeighbors(n);
    renderSpread();
  }
  function renderNeighbors(n){
    const L=document.getElementById('bvNeighL'), R=document.getElementById('bvNeighR');
    L.innerHTML=''; R.innerHTML='';
    const others=STRUCT.books.filter(b=>b.n!==n);
    const spine=(b)=>{
      const s=document.createElement('div'); s.className='bv-sidespine bv-theme-'+b.n;
      s.innerHTML=`<span class="ss-vol">${roman(b.n)}</span><span class="ss-title">${esc(bookTitleOf(b.n))}</span><span class="ss-rose">${roseBook(b.n)}</span>`;
      s.title=bookTitleOf(b.n);
      s.onclick=()=>openVolume(b.n);
      return s;
    };
    others.forEach(b=>{ (b.n<n?L:R).appendChild(spine(b)); });
  }
  function openCover(){
    if(coverOpen) return;
    document.getElementById('bvCover').classList.add('open');
    document.getElementById('bvBook').classList.add('coveropen');
    coverOpen=true;
  }
  function closeCover(){
    if(!coverOpen) return;
    document.getElementById('bvCover').classList.remove('open');
    document.getElementById('bvBook').classList.remove('coveropen');
    coverOpen=false; spread=0; renderSpread();
  }
  function wire(){
    document.getElementById('bvLeft').onclick=()=>{ if(coverOpen) turn(-1); };
    document.getElementById('bvRight').onclick=()=>{ if(!coverOpen){ openCover(); } else { turn(1); } };
    document.getElementById('bvCover').onclick=openCover;
    document.getElementById('bvScrub').oninput=(e)=>{ if(!coverOpen)openCover(); let v=parseInt(e.target.value,10)||0; spread=v-(v%2); renderSpread(); };
    document.getElementById('bvBackShelf').onclick=openShelf;
    document.getElementById('bvClose').onclick=()=>{ bv().hidden=true; };
    document.addEventListener('keydown',(e)=>{
      if(bv().hidden || document.getElementById('bvStage').hidden) return;
      if(e.key==='ArrowRight'){ if(!coverOpen)openCover(); else turn(1); }
      else if(e.key==='ArrowLeft'){ if(coverOpen)turn(-1); }
      else if(e.key==='Escape'){ bv().hidden=true; }
    });
  }
  let wired=false;
  return { open(n){ if(!wired){wire();wired=true;}
    openShelf();
    if(n) openVolume(n);
  } };
})();
function openBookView(n){ Book.open(n); }
document.getElementById('readerClose').onclick=()=>{document.getElementById('reader').hidden=true;};
function openReader(selected){
  const page=document.getElementById('readerPage');
  let html=`<div class="ms"><div class="ms-part" style="margin-top:20px">${(MK.title||'Evrynthing').toUpperCase()}</div><div class="ms-blank">${MK.tag||''}</div>`;
  let lastBook=null;
  allChaptersInOrder().forEach(({c,b})=>{
    if(selected && !selected.has(c)) return;
    if(b!==lastBook){ html+=`<div class="ms-part">BOOK ${roman(b.n)}</div>`; lastBook=b; }
    html+=`<div class="ms-chhead">Chapter ${roman(c.n)}<span class="csub">${c.t}</span></div>`;
    html+= (c.draft&&c.draft.trim())
      ? `<div class="ms-body">${stripBeatNotes(c.draft).trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`
      : `<div class="ms-blank">[ this chapter is not yet written ]</div>`;
  });
  html+='</div>';
  page.innerHTML=html; page.scrollTop=0;
  document.getElementById('reader').hidden=false;
}
const expSel=new Set();
document.getElementById('exportBtn').onclick=()=>openExport();
document.getElementById('exportClose').onclick=()=>{document.getElementById('exportModal').hidden=true;};
function openExport(){
  const list=document.getElementById('expList'); list.innerHTML='';
  allChaptersInOrder().forEach(({c,b})=>{
    const row=el('div','exp-row'+(expSel.has(c)?' sel':''));
    row.innerHTML=`<span class="ck">${expSel.has(c)?'✓':''}</span>
      <span class="exn">Bk ${roman(b.n)} · Ch ${roman(c.n)} — ${c.t}</span>
      <span class="exs ${c.state||'blank'}"></span>`;
    row.onclick=()=>{ if(expSel.has(c))expSel.delete(c);else expSel.add(c); openExport(); updateExpCount(); };
    list.appendChild(row);
  });
  updateExpCount();
  document.getElementById('exportModal').hidden=false;
}
function updateExpCount(){document.getElementById('expCount').textContent=expSel.size+' chapter'+(expSel.size!==1?'s':'')+' selected';}
document.getElementById('expAll').onclick=()=>{allChaptersInOrder().forEach(({c})=>expSel.add(c));openExport();};
document.getElementById('expNone').onclick=()=>{expSel.clear();openExport();};
document.getElementById('expDrafted').onclick=()=>{expSel.clear();allChaptersInOrder().forEach(({c})=>{if(proseOf(c.draft).trim())expSel.add(c);});openExport();};
function buildExportHtml(selected){
  const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let parts=[`<!doctype html><html><head><meta charset="utf-8"><style>
    @page{ size:A4; }
    body{ font-family:"Courier New",Courier,monospace; font-size:12pt; line-height:2; color:#000; }
    .title{ text-align:center; margin:30% 0 0; font-size:20pt; letter-spacing:.1em; }
    .subtitle{ text-align:center; font-size:12pt; margin-top:1em; }
    .part{ text-align:center; font-weight:bold; letter-spacing:.1em; margin:2em 0 1em; page-break-before:always; }
    .chhead{ text-align:center; font-weight:bold; text-transform:uppercase; margin:3em 0 2em; page-break-before:always; }
    .chsub{ display:block; text-transform:none; font-weight:normal; margin-top:.4em; }
    .body{ white-space:pre-wrap; }
    .blank{ text-align:center; font-style:italic; color:#888; margin:2em 0; }
  </style></head><body>`];
  parts.push(`<div class="title">${esc((MK.title||'Evrynthing').toUpperCase())}</div>`);
  if(MK.tag) parts.push(`<div class="subtitle">${esc(MK.tag)}</div>`);
  let lastBook=null;
  allChaptersInOrder().forEach(({c,b})=>{
    if(selected && !selected.has(c)) return;
    if(b!==lastBook){ parts.push(`<div class="part">BOOK ${roman(b.n)}</div>`); lastBook=b; }
    parts.push(`<div class="chhead">Chapter ${roman(c.n)}<span class="chsub">${esc(c.t)}</span></div>`);
    parts.push( (c.draft&&c.draft.trim())
      ? `<div class="body">${esc(stripBeatNotes(c.draft).trim())}</div>`
      : `<div class="blank">[ not yet written ]</div>` );
  });
  parts.push('</body></html>');
  return parts.join('\n');
}
document.getElementById('expGo').onclick=async ()=>{
  if(!expSel.size){updateExpCount();return;}
  const btn=document.getElementById('expGo'); const orig=btn.textContent; btn.textContent='Exporting…'; btn.disabled=true;
  try{
    if(window.writerAPI && window.writerAPI.exportPdf){
      const html=buildExportHtml(new Set(expSel));
      const r=await window.writerAPI.exportPdf(html, (MK.title||'Evrynthing')+'.pdf');
      if(r&&r.ok){ btn.textContent='Saved'; setTimeout(()=>{document.getElementById('exportModal').hidden=true;btn.textContent=orig;btn.disabled=false;},1100); return; }
      if(r&&r.reason==='canceled'){ btn.textContent=orig;btn.disabled=false; return; }
      btn.textContent='Export failed'; setTimeout(()=>{btn.textContent=orig;btn.disabled=false;},1800);
    } else {
      document.getElementById('exportModal').hidden=true; openReader(new Set(expSel)); btn.textContent=orig;btn.disabled=false;
    }
  }catch(e){ btn.textContent='Export failed'; setTimeout(()=>{btn.textContent=orig;btn.disabled=false;},1800); }
};
let DESK={
  syn:{cold:['frigid','bitter','glacial','raw','biting','frozen','icy'],dark:['black','dim','shadowed','unlit','starless']},
  ant:{cold:['warm','hot','balmy','tepid'],dark:['bright','lit','radiant','pale']},
  rhy:{cold:['bold','told','hold','gold','fold'],dark:['spark','mark','stark','hark']},
};
const _deskLoaded={};
async function ensureDeskData(lens){
  const file={syn:'synonyms',ant:'antonyms',rhy:'rhymes'}[lens];
  if(!file || _deskLoaded[lens] || !window.writerAPI) return;
  try{ const r=await window.writerAPI.libraryRead(file); if(r&&r.ok&&r.data){ DESK[lens]=Object.assign(DESK[lens]||{}, r.data); } }catch(e){}
  _deskLoaded[lens]=true;
}
async function loadLibrary(){   }
async function ensureDeskDefs(){
  if(_deskLoaded.def || !window.writerAPI) return;
  try{ const r=await window.writerAPI.libraryRead('english'); if(r&&r.ok&&r.data) DESK.def=r.data; }catch(e){}
  _deskLoaded.def=true;
}
function splitSynonyms(arr){
  const a=(arr||[]).filter(w=>typeof w==='string' && w.trim());
  let cut=a.length;
  for(let i=1;i<a.length;i++){ if(a[i].toLowerCase()<a[i-1].toLowerCase()){ cut=i; break; } }
  const close=[], more=a.slice(cut);
  a.slice(0,cut).forEach(w=>{ if(/^[A-Z]/.test(w)) more.unshift(w); else close.push(w); });
  return { close: close.length?close:a.slice(0,12), more: close.length?more:a.slice(12) };
}
const DICT={ cache:{}, keys:{}, cur:null };
const DICT_META={
  english:{ title:'English dictionary', editable:false },
  norwegian:{ title:'Norwegian dictionary (Bokmål)', editable:false },
  dalinari:{ title:'Dalinari', editable:true, empty:'Your conlang. Add your first word below — it saves to The Library.' },
  other:{ title:'Other tongues', editable:true, empty:'Custom words from other languages (Listener and the rest). Add one below.' }
};
async function loadDict(name){
  if(DICT.cache[name]) return DICT.cache[name];
  let data={};
  try{ const r=await window.writerAPI.libraryRead(name); if(r&&r.ok&&r.data) data=r.data; }catch(e){}
  DICT.cache[name]=data;
  DICT.keys[name]=Object.keys(data).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'no'));
  return data;
}
async function openDict(name){
  DICT.cur=name;
  const meta=DICT_META[name]||{title:name,editable:false};
  document.getElementById('dictTitle').textContent=meta.title;
  document.getElementById('dictSearch').value='';
  document.getElementById('dictAdd').hidden=!meta.editable;
  document.getElementById('dictList').innerHTML='<div class="dict-loading">Loading…</div>';
  openPanel('dictPanel');
  await loadDict(name);
  buildAZ(name);
  renderDict('');
  document.getElementById('dictSearch').focus();
}
function buildAZ(name){
  const az=document.getElementById('dictAZ');
  const present=new Set((DICT.keys[name]||[]).map(k=>k[0].toLowerCase()).filter(c=>/[a-zæøå]/.test(c)));
  const letters='abcdefghijklmnopqrstuvwxyzæøå'.split('');
  az.innerHTML=letters.map(L=>`<button class="dict-ltr${present.has(L)?'':' off'}" data-ltr="${L}">${L.toUpperCase()}</button>`).join('');
  az.querySelectorAll('.dict-ltr').forEach(b=>b.onclick=()=>{
    if(b.classList.contains('off'))return;
    document.getElementById('dictSearch').value='';
    renderByLetter(name, b.dataset.ltr);
  });
}
function entryHTML(name, w){
  const defs=DICT.cache[name][w]||[];
  const body=defs.map(d=>{
    const pos=d[0]?`<span class="de-pos">${String(d[0]).replace(/</g,'&lt;')}</span>`:'';
    return `<div class="de-def">${pos}${String(d[1]||'').replace(/</g,'&lt;')}</div>`;
  }).join('');
  const del = (DICT_META[name]&&DICT_META[name].editable)?`<button class="de-del" data-del="${w.replace(/"/g,'&quot;')}" title="Remove">×</button>`:'';
  return `<div class="dict-entry"><div class="de-head"><span class="de-word">${w.replace(/</g,'&lt;')}</span>${del}</div>${body}</div>`;
}
function renderByLetter(name, ltr){
  const keys=(DICT.keys[name]||[]).filter(k=>k[0].toLowerCase()===ltr);
  paintDict(name, keys, keys.length+' word'+(keys.length!==1?'s':'')+' under '+ltr.toUpperCase());
}
function renderDict(q){
  const name=DICT.cur; if(!name) return;
  q=(q||'').trim().toLowerCase();
  const all=DICT.keys[name]||[];
  if(!q){
    if(all.length===0){ paintDict(name, [], (DICT_META[name]&&DICT_META[name].empty)||'No words yet.'); return; }
    if(all.length<=400){ paintDict(name, all, all.length+' words'); return; }
    renderByLetter(name, 'a'); return;
  }
  const pre=[], mid=[];
  for(const k of all){ const lk=k.toLowerCase(); if(lk.startsWith(q))pre.push(k); else if(lk.includes(q))mid.push(k); if(pre.length>200)break; }
  const hits=pre.concat(mid).slice(0,200);
  paintDict(name, hits, hits.length?(hits.length+' match'+(hits.length!==1?'es':'')):'No match for "'+q+'"');
}
function paintDict(name, keys, countMsg){
  document.getElementById('dictCount').textContent=countMsg||'';
  const list=document.getElementById('dictList');
  if(!keys.length){ list.innerHTML=`<div class="dict-empty">${(countMsg||'Nothing here yet.')}</div>`; return; }
  list.innerHTML=keys.map(w=>entryHTML(name,w)).join('');
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeDictWord(name, b.dataset.del));
}
async function addDictWord(){
  const name=DICT.cur; if(!name || !(DICT_META[name]&&DICT_META[name].editable)) return;
  const w=(document.getElementById('dictNewWord').value||'').trim();
  const cls=(document.getElementById('dictNewClass').value||'').trim();
  const def=(document.getElementById('dictNewDef').value||'').trim();
  if(!w){ document.getElementById('dictNewWord').focus(); return; }
  const data=DICT.cache[name]||(DICT.cache[name]={});
  const entry=[cls, def||'(no definition yet)'];
  if(data[w]) data[w].push(entry); else data[w]=[entry];
  DICT.keys[name]=Object.keys(data).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'no'));
  try{ await window.writerAPI.libraryWrite(name, data); }catch(e){}
  document.getElementById('dictNewWord').value=''; document.getElementById('dictNewClass').value=''; document.getElementById('dictNewDef').value='';
  buildAZ(name);
  document.getElementById('dictSearch').value=w; renderDict(w);
  document.getElementById('dictNewWord').focus();
}
async function removeDictWord(name, w){
  const data=DICT.cache[name]; if(!data||!data[w]) return;
  delete data[w];
  DICT.keys[name]=Object.keys(data).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase(),'no'));
  try{ await window.writerAPI.libraryWrite(name, data); }catch(e){}
  renderDict((document.getElementById('dictSearch').value||''));
}
document.querySelectorAll('.dict-btn').forEach(b=>b.onclick=()=>openDict(b.dataset.dict));
document.getElementById('dictBack').onclick=()=>openPanel('helpPanel');
document.getElementById('dictClose').onclick=()=>openPanel('helpPanel');
document.getElementById('dictSearch').addEventListener('input',e=>renderDict(e.target.value));
document.getElementById('dictAddBtn').onclick=addDictWord;
document.getElementById('dictNewDef').addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();addDictWord();} });
document.getElementById('aiFold').onclick=()=>{
  const z=document.getElementById('aiZone');z.classList.toggle('folded');
  z.querySelector('.zcv').textContent=z.classList.contains('folded')?'show':'hide';
};
let deskLens='syn';
const deskSearch=document.getElementById('deskSearch'),deskResult=document.getElementById('deskResult'),deskHint=document.getElementById('deskHint');
document.querySelectorAll('.lens').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.lens').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');
  deskLens=b.dataset.l;renderDesk();
});
deskSearch.addEventListener('input',renderDesk);
function chips(arr){return '<div class="synonyms">'+arr.map(w=>`<span class="syn">${w}</span>`).join('')+'</div>';}
function freeNote(){return '<div class="src" style="margin-top:9px">Offline dataset · 0 tokens · works on Alaric with no internet.</div>';}
async function renderDesk(){
  const q=deskSearch.value.trim().toLowerCase();
  if(!q){deskResult.innerHTML='';deskHint.hidden=false;return;}
  deskHint.hidden=true;
  if(!_deskLoaded[deskLens]){ deskResult.innerHTML='<div class="answer" style="font-size:13px"><span class="aidots">loading<span>.</span><span>.</span><span>.</span></span></div>'; await ensureDeskData(deskLens); }
  const cur=deskSearch.value.trim().toLowerCase(); if(cur!==q) return;
  const hit=(DESK[deskLens]||{})[q];
  const lensName={syn:'synonyms',ant:'antonyms',rhy:'rhymes'}[deskLens];
  if(hit && deskLens==='syn'){
    await ensureDeskDefs();
    const cur2=deskSearch.value.trim().toLowerCase(); if(cur2!==q) return;
    const sp=splitSynonyms(hit), defs=(DESK.def&&DESK.def[q])||[];
    let html='';
    if(defs.length) html+='<div class="desk-k">Meanings</div>'+defs.slice(0,5).map(d=>'<div class="desk-def"><i>'+String(d[0]||'').replace(/</g,'&lt;')+'</i> '+String(d[1]||'').replace(/</g,'&lt;')+'</div>').join('');
    html+='<div class="desk-k">Closest</div>'+chips(sp.close);
    if(sp.more.length) html+='<details class="desk-more"><summary>More related ('+sp.more.length+')</summary>'+chips(sp.more)+'</details>';
    deskResult.innerHTML=html+freeNote();
    deskResult.querySelectorAll('.syn').forEach(s=>s.onclick=()=>{ deskSearch.value=s.textContent; renderDesk(); });
  } else if(hit){
    deskResult.innerHTML=chips(hit)+freeNote();
    deskResult.querySelectorAll('.syn').forEach(s=>s.onclick=()=>{ deskSearch.value=s.textContent; renderDesk(); });
  } else {
    deskResult.innerHTML=`<div class="answer" style="font-size:13px">No ${lensName} found for "<b>${q.replace(/</g,'&lt;')}</b>". <span class="src">It may be too rare, or an invented word — try the Ask-Memphis box below for those.</span></div>`;
  }
}
let _noteFull={};
(function(){
  const inp=document.getElementById('findInput'), out=document.getElementById('findResult');
  if(!inp) return;
  let t=null;
  inp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(runFind,220); });
  window._findEsc=(s)=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function hl(text,q){ const rx=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); return window._findEsc(text).replace(rx,'<mark>$1</mark>'); }
  async function runFind(){
    const q=(inp.value||'').trim();
    if(q.length<2){ out.innerHTML=''; return; }
    DESKV.cur=null; DESKV.stack=[]; DESKV.q=q;
    const terms=WriterNotes.searchTerms(q), rx=WriterNotes.markRx(terms);
    const ch=deskChapterHits(q);
    let html='';
    if(ch.length){
      window._findCh=ch.slice(0,12);
      html+='<div class="find-sec">In your chapters <span class="find-load">hover to see more, click to read</span></div>'+window._findCh.map((h,k)=>{
        return '<button class="find-note" data-k="'+k+'"><div class="find-ch">'+window._findEsc(h.ch)+'<span class="find-n">'+h.count+(h.count===1?' mention':' mentions')+'</span></div><div class="find-txt">'+WriterNotes.markText(WriterNotes.snippet(h.text.replace(BEAT_RX,(_m,t)=>'('+String(t).trim()+')'),terms,420),rx)+'</div></button>';
      }).join('')+(ch.length>12?'<div class="src">'+(ch.length-12)+' more chapters mention it. Narrow the search to see them.</div>':'');
    }
    html+='<div class="find-sec">In your vault notes <span class="find-load" id="findNoteLoad">searching…</span></div><div id="findNotes"></div>';
    out.innerHTML=html || '<div class="src">Type a name or phrase.</div>';
    out.querySelectorAll('.find-note[data-k]').forEach(el=>el.onclick=()=>{
      const h=(window._findCh||[])[+el.dataset.k]; if(!h||!h.c) return;
      deskShow({kind:'chapter', c:h.c, ch:h.ch});
    });
    try{
      const r=await Memphis.ask({kind:'notesearch', question:q});
      const notes=document.getElementById('findNotes'), load=document.getElementById('findNoteLoad');
      if(load) load.remove();
      if(r && r.offline){ if(notes)notes.innerHTML='<div class="src">Vault search needs Memphis running — chapters above still searched offline.</div>'; return; }
      let data=null; try{ const txt=(r.text||''); if(txt.startsWith('NOTESEARCH:')) data=JSON.parse(txt.slice('NOTESEARCH:'.length)); }catch(e){}
      if(!data || !data.hits || !data.hits.length){ if(notes)notes.innerHTML='<div class="src">No vault note mentions “'+window._findEsc(q)+'”.</div>'; return; }
      _noteFull={};
      if(notes) notes.innerHTML=data.hits.slice(0,10).map((h,i)=>{
        _noteFull['n'+i]=h.full||'';
        return '<button class="find-note" data-n="n'+i+'" data-title="'+window._findEsc(h.title)+'"><div class="find-ch">'+window._findEsc(h.title.replace(/^(?:Evrynthing|eV) - /,''))+(h.in_name?' <span class="nm-tag">name match</span>':'')+(h.count?'<span class="find-n">'+h.count+(h.count===1?' mention':' mentions')+'</span>':'')+'</div><div class="find-txt">'+WriterNotes.markText(WriterNotes.plain(h.snippet||''),rx)+'</div></button>';
      }).join('')+'<div class="src">Evrynthing notes only · hover to see more, click to read · offline · 0 tokens</div>';
      if(notes) notes.querySelectorAll('.find-note').forEach(b=>b.onclick=()=>showFullNote(b.dataset.title, _noteFull[b.dataset.n]));
    }catch(e){ const load=document.getElementById('findNoteLoad'); if(load)load.textContent='(unavailable)'; }
  }
})();
const DESKV={cur:null, stack:[], q:'', editing:false};
function deskChapterHits(q){
  const list=[];
  STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{
    list.push({c, ch:'Ch '+roman(c.n)+(c.t?' — '+c.t:''), prose:proseOf(c.draft||'')});
  }))));
  return WriterNotes.chapterHits(list, q);
}
function deskShow(v, push){
  if(push!==false){ if(DESKV.cur) DESKV.stack.push(DESKV.cur); else DESKV.stack=[]; }
  DESKV.cur=v; DESKV.editing=false; paintDeskView();
}
function deskBack(){
  if(DESKV.editing) return;
  if(DESKV.stack.length){ DESKV.cur=DESKV.stack.pop(); paintDeskView(); return; }
  DESKV.cur=null; const inp=document.getElementById('findInput'); inp.dispatchEvent(new Event('input'));
}
function deskBackLabel(){
  const prev=DESKV.stack[DESKV.stack.length-1];
  if(!prev) return '‹ back to results';
  const name=prev.kind==='chapter'?prev.ch:String(prev.title||'').replace(/^(?:Evrynthing|eV) - /,'');
  return '‹ back to '+name;
}
function paintDeskView(){
  const out=document.getElementById('findResult'), v=DESKV.cur; if(!v) return;
  const e=window._findEsc, terms=WriterNotes.searchTerms(DESKV.q), rx=WriterNotes.markRx(terms);
  let bar='<div class="desk-bar"><button class="back-desk" id="noteBack" title="Backspace also goes back">'+e(deskBackLabel())+'</button>';
  let body='';
  if(v.kind==='chapter'){
    bar+='<button class="chipbtn" id="chapGo">Open the chapter</button>';
    const mine=(v.c===current);
    bar+='<span class="desk-hint">'+(mine?'This is the chapter you are writing: change it on the page.':'Click a paragraph to change it.')+'</span>';
    const plates=parsePlates(v.c.draft||'');
    let paras='';
    plates.forEach((pl,pi)=>WriterNotes.paragraphs(pl.text).forEach((p,k)=>{
      const parts=[]; let last=0; p.replace(BEAT_RX,(m,t,i)=>{ parts.push(WriterNotes.markText(p.slice(last,i),rx)); parts.push('<span class="beat">'+WriterNotes.markText(String(t).trim(),rx)+'</span>'); last=i+m.length; return m; });
      parts.push(WriterNotes.markText(p.slice(last),rx));
      paras+='<p'+(mine?'':' class="desk-para" data-pi="'+pi+'" data-k="'+k+'" title="Click to change this paragraph"')+'>'+parts.join('').replace(/\n/g,'<br>')+'</p>';
    }));
    body='<div class="note-title">'+e(v.ch)+'</div><div class="note-body md">'+paras+'</div>';
  } else {
    const canEdit=!!(window.writerAPI && writerAPI.noteBody);
    if(canEdit) bar+='<button class="chipbtn" id="noteEdit">Edit</button>';
    body='<div class="note-title">'+e(v.title)+'</div><div class="note-body md">'+WriterNotes.renderNote(v.full||'',terms)+'</div>';
  }
  bar+='<span class="desk-msg" id="deskMsg"></span></div>';
  out.innerHTML=bar+'<div class="note-view" id="deskView">'+body+'</div>';
  document.getElementById('noteBack').onclick=deskBack;
  const view=document.getElementById('deskView');
  if(v.kind==='chapter'){
    document.getElementById('chapGo').onclick=()=>{
      const c=v.c, words=DESKV.q;
      try{ closePanels(); }catch(x){}
      openChapter(c);
      setTimeout(()=>{ try{ const sel=window.getSelection(); sel.removeAllRanges(); window.find(words,false,false,true); }catch(x){} }, 350);
    };
    const m=view.querySelector('mark'); if(m) setTimeout(()=>{ view.scrollTop=Math.max(0, m.offsetTop-view.clientHeight/3); },0);
    view.querySelectorAll('.desk-para').forEach(p=>p.onclick=()=>editParaInDesk(v, p));
  } else {
    const ed=document.getElementById('noteEdit'); if(ed) ed.onclick=()=>editNoteInDesk(v.title);
    view.querySelectorAll('a.wl').forEach(a=>a.onclick=(ev)=>{ ev.preventDefault(); deskFollow(a.dataset.target); });
    if(v.heading){ const h=[...view.querySelectorAll('.nh')].find(x=>x.textContent.trim().toLowerCase()===v.heading.toLowerCase()); if(h) setTimeout(()=>{ view.scrollTop=Math.max(0,h.offsetTop-12); },0); }
  }
  try{ document.getElementById('noteBack').focus({preventScroll:true}); }catch(x){}
}
function editParaInDesk(v, el){
  if(DESKV.editing || v.c===current) return;
  const pi=+el.dataset.pi, k=+el.dataset.k;
  const plates=parsePlates(v.c.draft||''), pl=plates[pi]; if(!pl) return;
  const orig=WriterNotes.paragraphs(pl.text)[k]; if(orig==null) return;
  DESKV.editing=true;
  const wrap=document.createElement('div'); wrap.className='desk-para-edit';
  wrap.innerHTML='<textarea class="note-edit" spellcheck="true"></textarea>'
    +'<div class="note-edit-bar"><button class="chipbtn" data-a="cancel">Cancel</button><button class="startbtn sm" data-a="save">Save paragraph</button><span class="note-edit-msg">Ctrl+S saves, Esc cancels. Empty it to remove the paragraph.</span></div>';
  const ta=wrap.querySelector('textarea'); ta.value=orig;
  ta.style.minHeight=Math.max(80, el.offsetHeight+40)+'px';
  el.replaceWith(wrap); ta.focus();
  const done=()=>{ DESKV.editing=false; paintDeskView(); };
  const cancel=()=>{ if(ta.value!==orig && !confirm('Leave without saving your changes?')) return; done(); };
  const save=()=>{
    const next=ta.value;
    if(next.trim()===orig){ done(); return; }
    if(!next.trim() && !confirm('Remove this paragraph from the chapter?')) return;
    const fresh=parsePlates(v.c.draft||''), p=fresh[pi];
    if(!p || WriterNotes.paragraphs(p.text)[k]!==orig){ wrap.querySelector('.note-edit-msg').textContent='The chapter changed while you were typing. Cancel and try again.'; return; }
    const t=WriterNotes.replaceParagraph(p.text, k, next); if(t==null) return;
    p.text=t; v.c.draft=serializePlates(fresh);
    _pendingCh.add(v.c); markDirty(); doSave();
    done();
    const msg=document.getElementById('deskMsg'); if(msg) msg.textContent='Saved in '+v.ch;
  };
  wrap.querySelector('[data-a="cancel"]').onclick=cancel;
  wrap.querySelector('[data-a="save"]').onclick=save;
  ta.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); e.stopPropagation(); save(); }
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); cancel(); }
  });
}
let _deskTitles=null;
async function deskFollow(target){
  const p=WriterNotes.parseLink(target), msg=document.getElementById('deskMsg');
  if(!p.title){
    if(DESKV.cur && p.heading){ deskShow(Object.assign({}, DESKV.cur, {heading:p.heading})); }
    return;
  }
  if(!window.writerAPI || !writerAPI.noteRead){ if(msg) msg.textContent='Notes open only inside Memphis.'; return; }
  try{
    let title=p.title, r=await writerAPI.noteRead(title);
    if(!r || r.content==null){
      if(!_deskTitles){ const t=await writerAPI.noteTitles(); _deskTitles=(t&&t.titles)||[]; }
      const alt=_deskTitles.find(x=>x.toLowerCase()===title.toLowerCase());
      if(alt){ title=alt; r=await writerAPI.noteRead(title); }
    }
    if(!r || r.content==null){ if(msg) msg.textContent='There is no note called “'+p.title+'” in the vault yet.'; return; }
    deskShow({kind:'note', title, full:r.content, heading:p.heading});
  }catch(x){ if(msg) msg.textContent='That note could not be opened.'; }
}
function showFullNote(title, full){ deskShow({kind:'note', title, full}); }
document.addEventListener('keydown',ev=>{
  if(!DESKV.cur || DESKV.editing) return;
  const panel=document.getElementById('helpPanel'); if(!panel || !panel.classList.contains('show')) return;
  const a=document.activeElement;
  const typing=a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.tagName==='SELECT' || a.isContentEditable);
  if((ev.key==='Backspace' && !typing) || (ev.altKey && ev.key==='ArrowLeft')){ ev.preventDefault(); deskBack(); }
});
document.addEventListener('mouseup',ev=>{
  if(ev.button!==3 || !DESKV.cur || DESKV.editing) return;
  const panel=document.getElementById('helpPanel'); if(!panel || !panel.classList.contains('show')) return;
  ev.preventDefault(); deskBack();
});
function wlChip(link, raw){
  const p=WriterNotes.parseLink(link), s=document.createElement('span');
  s.className='wl-chip'; s.contentEditable='false';
  s.dataset.raw=raw; s.dataset.link=link;
  s.textContent=p.shown; s.title=p.page||p.target;
  return s;
}
function noteEditText(box){
  let out='';
  const walk=(n)=>{
    n.childNodes.forEach(c=>{
      if(c.nodeType===3){ out+=c.nodeValue; return; }
      if(c.nodeType!==1) return;
      if(c.classList.contains('wl-chip')){ out+=c.dataset.raw; return; }
      if(c.tagName==='BR'){ out+='\n'; return; }
      if((c.tagName==='DIV' || c.tagName==='P') && out && !out.endsWith('\n')) out+='\n';
      walk(c);
    });
  };
  walk(box);
  return out;
}
async function editNoteInDesk(title){
  const out=document.getElementById('findResult');
  const r=await writerAPI.noteBody(title);
  if(!r || !r.ok){ const msg=document.getElementById('deskMsg'); if(msg) msg.textContent=(r&&r.reason)||'That note could not be opened.'; else alert((r&&r.reason)||'That note could not be opened.'); return; }
  DESKV.editing=true;
  const orig=r.body||'', start=orig.replace(/\r\n?/g,'\n');
  out.innerHTML='<div class="note-title" style="margin-bottom:8px">'+window._findEsc(title)+'</div>'
    +'<div class="note-edit-band"><button class="chipbtn" id="wlAdd" title="Make a link (Ctrl+K)">Link</button><span class="band-hint">Select words, then Link. Ctrl+K does the same.</span></div>'
    +'<div class="note-edit" id="noteEditBox" contenteditable="true" spellcheck="true"></div>'
    +'<div class="note-edit-bar"><button class="chipbtn" id="noteCancel">Cancel</button><button class="startbtn sm" id="noteSave">Save note</button><span class="note-edit-msg" id="noteEditMsg">Click a link to change it.</span></div>'
    +'<div class="wl-pop" id="wlPop" hidden><label for="wlText">Text shown</label><input id="wlText" spellcheck="true" autocomplete="off">'
    +'<label for="wlPage">Links to the note</label><input id="wlPage" list="wlTitles" spellcheck="false" autocomplete="off"><datalist id="wlTitles"></datalist>'
    +'<div class="wl-pop-bar"><button class="startbtn sm" id="wlOk">Save link</button><button class="chipbtn" id="wlUnlink">Remove link</button><button class="chipbtn" id="wlCancel">Cancel</button></div></div>';
  const box=document.getElementById('noteEditBox');
  WriterNotes.segments(start).forEach(g=>box.appendChild(g.text!=null?document.createTextNode(g.text):wlChip(g.link,g.raw)));
  box.focus();
  const dirty=()=>noteEditText(box)!==start;
  const back=()=>{
    DESKV.editing=false;
    writerAPI.noteRead(title).then(n=>{ if(DESKV.cur && n && n.content!=null) DESKV.cur.full=n.content; paintDeskView(); }).catch(()=>paintDeskView());
  };
  const cancel=()=>{ if(dirty() && !confirm('Leave without saving your changes?')) return; back(); };
  document.getElementById('noteCancel').onclick=cancel;
  document.getElementById('noteSave').onclick=async()=>{
    const msg=document.getElementById('noteEditMsg');
    if(!dirty()){ back(); return; }
    msg.textContent='Saving…';
    const w=await writerAPI.noteWrite(title, noteEditText(box), orig);
    if(w && w.ok){ msg.textContent='Saved'; setTimeout(back, 500); }
    else msg.textContent=(w&&w.reason)||'Not saved.';
  };
  box.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); e.stopPropagation(); document.getElementById('noteSave').click(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); e.stopPropagation(); openNewLink(); return; }
    if(e.key==='Enter'){ e.preventDefault(); document.execCommand('insertLineBreak'); return; }
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); cancel(); }
  });
  box.addEventListener('paste',e=>{ e.preventDefault(); const t=(e.clipboardData&&e.clipboardData.getData('text/plain'))||''; document.execCommand('insertText', false, t); });
  const pop=document.getElementById('wlPop'), fText=document.getElementById('wlText'), fPage=document.getElementById('wlPage');
  let chip=null, newAt=null;
  const closePop=()=>{ pop.hidden=true; chip=null; newAt=null; document.getElementById('wlUnlink').hidden=false; box.focus(); };
  const fillTitles=async()=>{
    if(!_deskTitles && window.writerAPI && writerAPI.noteTitles){ try{ const t=await writerAPI.noteTitles(); _deskTitles=(t&&t.titles)||[]; }catch(x){ _deskTitles=[]; } }
    const dl=document.getElementById('wlTitles'); if(dl && !dl.childElementCount) dl.innerHTML=(_deskTitles||[]).map(t=>'<option value="'+window._findEsc(t)+'">').join('');
  };
  const placePop=(rc)=>{
    const ro=out.getBoundingClientRect();
    pop.style.top=Math.round(rc.bottom-ro.top+6)+'px';
    pop.hidden=false;
    pop.style.left=Math.round(Math.max(0, Math.min(rc.left-ro.left, ro.width-pop.offsetWidth)))+'px';
  };
  box.addEventListener('click',async e=>{
    const c=e.target.closest && e.target.closest('.wl-chip'); if(!c) return;
    e.preventDefault(); chip=c; newAt=null;
    const p=WriterNotes.parseLink(c.dataset.link);
    fText.value=p.alias||p.shown; fPage.value=p.target;
    placePop(c.getBoundingClientRect());
    fText.focus(); fText.select();
    fillTitles();
  });
  function openNewLink(){
    const sel=window.getSelection();
    let r=(sel && sel.rangeCount)?sel.getRangeAt(0):null;
    if(!r || !box.contains(r.commonAncestorContainer)){ r=document.createRange(); r.selectNodeContents(box); r.collapse(false); }
    chip=null; newAt=r.cloneRange();
    const words=r.toString().replace(/\s+/g,' ').trim();
    fText.value=words; fPage.value='';
    document.getElementById('wlUnlink').hidden=true;
    let rc=r.getBoundingClientRect(); if(!rc || (!rc.width && !rc.height)) rc=box.getBoundingClientRect();
    placePop(rc);
    (words?fPage:fText).focus();
    fillTitles();
  }
  const addBtn=document.getElementById('wlAdd');
  addBtn.addEventListener('mousedown',e=>e.preventDefault());
  addBtn.onclick=openNewLink;
  document.getElementById('wlOk').onclick=()=>{
    if(!chip && !newAt) return closePop();
    const page=fPage.value.trim(), text=fText.value.trim();
    if(!page){ fPage.focus(); return; }
    const raw=WriterNotes.makeLink(page, text), link=raw.slice(2,-2);
    if(newAt){
      const n=wlChip(link, raw), r=newAt;
      r.deleteContents(); r.insertNode(n);
      const after=document.createRange(); after.setStartAfter(n); after.collapse(true);
      closePop();
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(after);
      return;
    }
    if(raw!==chip.dataset.raw){ const n=wlChip(link, raw); chip.replaceWith(n); }
    closePop();
  };
  document.getElementById('wlUnlink').onclick=()=>{
    if(chip){ const t=fText.value.trim()||WriterNotes.parseLink(chip.dataset.link).shown; chip.replaceWith(document.createTextNode(t)); }
    closePop();
  };
  document.getElementById('wlCancel').onclick=closePop;
  [fText,fPage].forEach(f=>f.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); document.getElementById('wlOk').click(); }
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closePop(); }
  }));
}
function aiThinking(box){ box.innerHTML='<div class="answer"><span class="aidots">Memphis is thinking<span>.</span><span>.</span><span>.</span></span></div>'; }
function aiOffline(box){ box.innerHTML='<div class="answer" style="border-left-color:var(--ink-faint)">Memphis isn\'t reachable right now — the brain may not be running. The offline tools above still work.<div class="src">No internet / brain offline</div></div>'; }
async function runAsk(payload, box, label){
  aiThinking(box);
  const r=await Memphis.ask(payload);
  if(r.offline){ aiOffline(box); return; }
  if(r.timeout){ box.innerHTML='<div class="answer">That took too long — try again.<div class="src">timed out</div></div>'; return; }
  const text=(r.text||'').replace(/</g,'&lt;').replace(/\n/g,'<br>');
  box.innerHTML='<div class="answer">'+text+'<div class="src">Memphis · '+label+'</div></div>';
}
function scanManuscript(query){
  const stop=new Set(['what','have','i','said','about','the','a','an','is','are','was','were',
    'of','to','in','on','and','or','my','me','do','does','did','who','how','they','their','this','that']);
  const terms=query.toLowerCase().match(/[a-zà-ÿ''-]{3,}/gi)||[];
  const keys=terms.map(t=>t.toLowerCase()).filter(t=>!stop.has(t));
  if(!keys.length) return [];
  const hits=[];
  STRUCT.books.forEach(b=>b.acts.forEach(a=>(a.eps||[]).forEach(e=>(e.ch||[]).forEach(c=>{
    const draft=proseOf(c.draft).trim(); if(!draft) return;
    draft.split(/\n{2,}/).forEach(para=>{
      const low=para.toLowerCase();
      const score=keys.reduce((s,k)=>s+(low.includes(k)?1:0),0);
      if(score>0) hits.push({score, ch:'Ch '+roman(c.n)+(c.t?' — '+c.t:''), text:para.trim(), c});
    });
  }))));
  hits.sort((x,y)=>y.score-x.score);
  return hits.slice(0,8);
}
function doAskWorld(){
  const q=(document.getElementById('askInput').value||'').trim();
  const box=document.getElementById('askResult');
  if(!q){ box.innerHTML='<div class="answer" style="font-size:13px">Type a question first.</div>'; return; }
  const found=scanManuscript(q);
  const manuscript = found.map(h=>'['+h.ch+'] '+h.text).join('\n\n');
  const label = found.length ? 'read your chapters + vault' : 'reasoned over your vault';
  runAsk({kind:'world', question:q, manuscript}, box, label);
}
document.getElementById('askWorld').onclick=doAskWorld;
document.getElementById('askInput').addEventListener('keydown',e=>{ if(e.key==='Enter')doAskWorld(); });
const BEAT_RX=/\[\[\s*note:\s*([\s\S]*?)\]\]/g;
function whereWasI(ch){
  const draft=proseOf(ch.draft||'');
  const notes=[]; draft.replace(BEAT_RX,(_m,t)=>{ t=String(t).trim(); if(t) notes.push(t); return ''; });
  const lastPara=(txt)=>{ const ps=String(txt||'').replace(BEAT_RX,'').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean); let p=ps.length?ps[ps.length-1]:''; if(p.length>600) p='…'+p.slice(-600).replace(/^\S*\s/,''); return p; };
  const order=allChaptersInOrder().map(x=>x.c), i=order.indexOf(ch);
  let prev=null; for(let k=i-1;k>=0;k--){ if(lastPara(proseOf(order[k].draft||''))){ prev=order[k]; break; } }
  return { title:ch.t||'', theme:ch.theme||'', words:wordsIn(draft.replace(BEAT_RX,'')), last:lastPara(draft), notes,
    prevTitle:prev?(prev.t||''):'', prevLast:prev?lastPara(proseOf(prev.draft||'')):'' };
}
document.getElementById('stuck').onclick=()=>{
  const box=document.getElementById('stuckResult');
  if(!current){ box.innerHTML='<div class="answer" style="font-size:13px">Open a chapter first.</div>'; return; }
  const w=whereWasI(current), e=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  let h='<div class="answer wwi" style="font-size:13px">';
  h+='<div class="wwi-h">'+e(w.title)+' · '+w.words+' words'+(w.theme?' · '+e(w.theme):'')+'</div>';
  h+='<div class="wwi-k">Where your text stops</div>'+(w.last?'<div class="wwi-q">'+e(w.last)+'</div>':'<div class="wwi-q">Nothing written here yet.</div>');
  h+='<div class="wwi-k">Your notes in this chapter</div>'+(w.notes.length?w.notes.map(n=>'<div class="wwi-n">'+e(n)+'</div>').join(''):'<div class="wwi-q">None yet. Alt+N parks one.</div>');
  if(w.prevTitle) h+='<div class="wwi-k">Where '+e(w.prevTitle)+' ends</div><div class="wwi-q">'+e(w.prevLast)+'</div>';
  box.innerHTML=h+'</div>';
};
document.querySelector('.progresschip').onclick=()=>{ closePanels(); dashboard(); };
document.querySelector('.progresschip').style.cursor='pointer';
