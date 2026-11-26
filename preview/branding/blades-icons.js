const P2=(x,y)=>({x,y});
function cubic(a,b,c,d,n){ const o=[]; n=n||24; for(let i=0;i<=n;i++){ const t=i/n, u=1-t;
  o.push(P2(u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0], u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1])); } return o; }
function line(a,b,n){ const o=[]; n=n||12; for(let i=0;i<=n;i++){ const t=i/n; o.push(P2(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)); } return o; }
function arc(cx,cy,r,a0,a1,n){ const o=[]; n=n||40; for(let i=0;i<=n;i++){ const a=(a0+(a1-a0)*i/n)*Math.PI/180; o.push(P2(cx+r*Math.cos(a), cy+r*Math.sin(a))); } return o; }
function round(pts,r){ const o=[P2(pts[0][0],pts[0][1])];
  for(let i=1;i<pts.length-1;i++){ const p=pts[i], a=pts[i-1], b=pts[i+1];
    const da=Math.hypot(p[0]-a[0],p[1]-a[1]), db=Math.hypot(b[0]-p[0],b[1]-p[1]), rr=Math.min(r,da/2,db/2);
    const p1=[p[0]+(a[0]-p[0])/da*rr, p[1]+(a[1]-p[1])/da*rr], p2=[p[0]+(b[0]-p[0])/db*rr, p[1]+(b[1]-p[1])/db*rr];
    o.push(P2(p1[0],p1[1])); for(let k=1;k<10;k++){ const t=k/10,u=1-t; o.push(P2(u*u*p1[0]+2*u*t*p[0]+t*t*p2[0], u*u*p1[1]+2*u*t*p[1]+t*t*p2[1])); } o.push(P2(p2[0],p2[1])); }
  o.push(P2(pts[pts.length-1][0],pts[pts.length-1][1]));
  const out=[o[0]]; for(let i=1;i<o.length;i++){ const a=o[i-1], b=o[i], L=Math.hypot(b.x-a.x,b.y-a.y), n=Math.max(1,Math.ceil(L/0.6)); for(let k=1;k<=n;k++) out.push(P2(a.x+(b.x-a.x)*k/n, a.y+(b.y-a.y)*k/n)); }
  return out; }
const join=(...segs)=>segs.reduce((a,s)=>a.concat(a.length?s.slice(1):s),[]);
function blade(pts,o){ o=Object.assign({W:2.3,taper:'both',min:0.28,pow:0.55},o);
  const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y)); const T=L[L.length-1]||1;
  const wf=s=>{ let k; if(o.taper==='both') k=Math.pow(Math.sin(Math.PI*s),o.pow); else if(o.taper==='start') k=Math.pow(Math.sin(Math.PI*s/2),o.pow); else if(o.taper==='end') k=Math.pow(Math.cos(Math.PI*s/2),o.pow); else k=1; return o.W*(o.min/o.W+(1-o.min/o.W)*k)/2; };
  const left=[], right=[];
  for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; let tx=b.x-a.x, ty=b.y-a.y; const l=Math.hypot(tx,ty)||1; const nx=-ty/l, ny=tx/l, w=wf(L[i]/T);
    left.push([pts[i].x+nx*w, pts[i].y+ny*w]); right.push([pts[i].x-nx*w, pts[i].y-ny*w]); }
  let d='M'+left.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L');
  const capR=wf(1); d+= o.taper==='none'||o.taper==='start' ? `A${capR.toFixed(2)} ${capR.toFixed(2)} 0 0 1 ` : 'L';
  d+=right.reverse().map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L');
  if(o.taper==='none'||o.taper==='end'){ const c=wf(0); d+=`A${c.toFixed(2)} ${c.toFixed(2)} 0 0 1 ${left[0][0].toFixed(2)} ${left[0][1].toFixed(2)}`; }
  return d+'Z';
}
const I={};
const B=(pts,o)=>Object.assign({pts},o||{});
I.plus     =[B(line([12,3.5],[12,20.5])), B(line([3.5,12],[20.5,12]),{over:true})];
I.close    =[B(line([5.5,5.5],[18.5,18.5])), B(line([18.5,5.5],[5.5,18.5]),{over:true})];
I.minus    =[B(line([4,12],[20,12]))];
I.check    =[B(cubic([4.5,12.5],[7,14.5],[9,17],[10,18.5]),{taper:'start'}), B(cubic([10,18.5],[12,13],[15.5,8.5],[20,5]),{taper:'end'})];
I['chevron-left'] =[B(round([[15,4],[7.5,12],[15,20]],2.2),{W:2.5})];
I['chevron-right']=[B(round([[9,4],[16.5,12],[9,20]],2.2),{W:2.5})];
I['chevron-down'] =[B(round([[4,9],[12,16.5],[20,9]],2.2),{W:2.5})];
I.search   =[B(arc(10.5,10.5,6.3,-60,265)), B(line([15.2,15.2],[20.5,20.5]),{taper:'end',W:2.6})];
I.send     =[B(line([3.5,12],[19.5,12]),{taper:'start'}), B(cubic([12.5,5],[15,8.5],[17.5,10.5],[20,12]),{taper:'start'}), B(cubic([12.5,19],[15,15.5],[17.5,13.5],[20,12]),{taper:'start'})];
I.book     =[B(join(cubic([12,7.5],[9,5],[6,5],[3,6]), line([3,6],[3,17.5]), cubic([3,17.5],[6,16.6],[9,17],[12,19.5])),{taper:'both'}),
             B(join(cubic([12,7.5],[15,5],[18,5],[21,6]), line([21,6],[21,17.5]), cubic([21,17.5],[18,16.6],[15,17],[12,19.5])),{taper:'both'}),
             B(line([12,8.5],[12,18.5]),{W:1.6})];
I.export   =[B(round([[4.5,13.5],[4.5,19.5],[19.5,19.5],[19.5,13.5]],3)), B(line([12,16],[12,3.5]),{taper:'start'}),
             B(cubic([7.5,8],[9.5,6.5],[11,5],[12,3.5]),{taper:'start'}), B(cubic([16.5,8],[14.5,6.5],[13,5],[12,3.5]),{taper:'start'})];
I.settings =[0,120,240].map(a=>{ const r=a*Math.PI/180, rot=(x,y)=>[12+x*Math.cos(r)-y*Math.sin(r), 12+x*Math.sin(r)+y*Math.cos(r)];
             return B(cubic(rot(0,-2.2),rot(4.5,-4),rot(6.5,-1),rot(8.5,3.5)),{taper:'both',W:2.6}); });
I.info     =[B(line([12,10],[12,19.5]),{W:2.5}), {dot:[12,6.2,1.55]}];
I.mic      =[B(join(arc(12,8,3.4,180,360,20), line([15.4,8],[15.4,12]), arc(12,12,3.4,0,180,20), line([8.6,12],[8.6,8])),{taper:'none',W:1.9}),
             B(cubic([5.5,11],[5.5,19],[18.5,19],[18.5,11]),{W:2.1}), B(line([12,17.3],[12,21]),{taper:'end'})];
I.moon     =[{fill:'M15.5 3.2A9 9 0 1 0 20.8 15.4A7.2 7.2 0 0 1 15.5 3.2Z'}];
I.sun      =[{dot:[12,12,3.6]}, ...[0,60,120,180,240,300].map(a=>{ const r=a*Math.PI/180; return B(line([12+6*Math.cos(r),12+6*Math.sin(r)],[12+9.5*Math.cos(r),12+9.5*Math.sin(r)]),{taper:'end',W:2}); })];
I.calendar =[B(round([[12,5],[4.5,5],[4.5,20],[19.5,20],[19.5,5],[12,5]],3),{W:2.1}), B(line([4.5,9.8],[19.5,9.8]),{W:1.6}), B(line([8.5,2.8],[8.5,6.5]),{W:2,taper:'start'}), B(line([15.5,2.8],[15.5,6.5]),{W:2,taper:'start'}), {dot:[9,14.6,1.3]}, {dot:[12,14.6,1.3]}, {dot:[15,14.6,1.3]}];
I.grip     =[B(line([9,5],[9,19]),{W:2.2}), B(line([15,5],[15,19]),{W:2.2})];
I.overview =[B(line([4,6.5],[20,6.5])), B(line([4,12],[20,12])), B(line([4,17.5],[14,17.5]))];
I.split    =[B(round([[4,9.5],[4,4.5],[20,4.5],[20,9.5]],2.5),{W:2.1}), B(round([[4,14.5],[4,19.5],[20,19.5],[20,14.5]],2.5),{W:2.1}), B(line([7,12],[17,12]),{W:1.4,taper:'both'})];
I.merge    =[B(cubic([6,3.5],[6,10],[12,9.5],[12,14.5]),{taper:'start'}), B(cubic([18,3.5],[18,10],[12,9.5],[12,14.5]),{taper:'start'}), B(line([12,14.5],[12,21]),{taper:'end',W:2.6})];
I.trash    =[B(cubic([6,8],[6.5,13],[7,17],[7.8,20.5]),{taper:'start'}), B(line([7.8,20.5],[16.2,20.5]),{taper:'none',W:2}), B(cubic([18,8],[17.5,13],[17,17],[16.2,20.5]),{taper:'start'}),
             B(line([3.5,6.5],[20.5,6.5])), B(cubic([9,6.5],[9,3.5],[15,3.5],[15,6.5]),{W:1.7})];
I.document =[B(round([[14,3.5],[5.5,3.5],[5.5,20.5],[18.5,20.5],[18.5,8]],2.5),{W:2.2}), B(round([[14,3.5],[14,8],[18.5,8]],1.2),{W:1.5,taper:'none'}), B(line([9,12.5],[15,12.5]),{W:1.7}), B(line([9,16.5],[13,16.5]),{W:1.7})];
I.apps     =[[7,7],[17,7],[7,17],[17,17]].map(([x,y])=>B(join(arc(x,y,3.3,-90,270,36)),{taper:'both',W:2.2}));
I.review   =[B(round([[8,4],[20,4],[20,15]],2.5),{W:1.6}), B(round([[4,8],[16,8],[16,20],[4,20],[4,8]],2.5),{taper:'both',W:2.1}), B(cubic([6.8,14],[8,15.2],[9,16.3],[9.6,17]),{taper:'start',W:1.9}), B(cubic([9.6,17],[10.8,14.2],[12,12.3],[13.6,11]),{taper:'end',W:1.9})];
I.quote    =[{fill:'M10 5.2C6.3 6.3 4.2 9 4.2 12.6c0 2.3 1.3 3.9 3.2 3.9 1.6 0 2.8-1.2 2.8-2.8 0-1.6-1.1-2.7-2.6-2.7-.2 0-.4 0-.6.1.5-2.1 1.8-3.6 3.6-4.4z'},
             {fill:'M19.6 5.2c-3.7 1.1-5.8 3.8-5.8 7.4 0 2.3 1.3 3.9 3.2 3.9 1.6 0 2.8-1.2 2.8-2.8 0-1.6-1.1-2.7-2.6-2.7-.2 0-.4 0-.6.1.5-2.1 1.8-3.6 3.6-4.4z'}];
I.sparkle  =[B(cubic([12,2.5],[12.6,8],[12.6,16],[12,21.5]),{W:2.8}), B(cubic([4,12],[9,11.4],[15,11.4],[20,12]),{W:2.4,over:true}), B(line([18.5,3.5],[18.5,7.5]),{W:1.5}), B(line([16.5,5.5],[20.5,5.5]),{W:1.5,over:true})];
I.pen      =[{fill:'M12 2.5C15.5 6.5 18 10 18 13.6c0 2.6-1.6 4.4-3.4 5.3L12 21.5l-2.6-2.6C7.6 18 6 16.2 6 13.6 6 10 8.5 6.5 12 2.5z'}, {cut:B(line([12,10],[12,20]),{W:1.3,taper:'start'})}, {cutdot:[12,10.2,1.6]}];
I.sandbox  =[B(round([[12,3],[20,7.5],[20,16.5],[12,21],[4,16.5],[4,7.5],[12,3]],2),{taper:'both',W:2.1}), B(line([12,12],[12,20]),{W:1.6}), B(line([4.8,8],[12,12]),{W:1.6,taper:'start'}), B(line([19.2,8],[12,12]),{W:1.6,taper:'start'})];
I.folder   =[B(round([[3.5,8],[3.5,19.5],[20.5,19.5],[20.5,8.5],[12,8.5],[10,5.5],[3.5,5.5],[3.5,8]],2.5),{taper:'both',W:2.1})];
I.undo     =[B(join(arc(13,13.5,6.5,200,450,40).reverse()),{taper:'end'}), B(cubic([3.5,6],[4.5,8],[5.5,10],[6.6,11.4]),{taper:'start'}), B(cubic([11.5,10.5],[9.8,10.8],[8,11.1],[6.6,11.4]),{taper:'start'})];
I.menu     =[B(line([4,6.5],[20,6.5])), B(line([4,12],[20,12])), B(line([4,17.5],[20,17.5]))];
I.window   =[B(round([[4,5],[20,5],[20,19],[4,19],[4,5]],3),{taper:'both',W:2}), B(line([4,9],[20,9]),{W:1.5})];
I.cards    =[B(round([[8.4,2.7],[2.2,4.4],[5.6,17.0],[11.8,15.3],[8.4,2.7]],2.2),{taper:'both',W:2}),
             B(round([[15,6],[10,6],[10,21],[20,21],[20,6],[15,6]],2.6),{taper:'both',W:2.1,over:true})];
I.mark     =[];
I['tool-strategist']=[B(arc(12,12,6.6,-50,230),{W:1.8}), B(line([12,2],[12,22]),{W:2.9}), B(line([4,12],[20,12]),{W:2.5,over:true})];
I['tool-butler']   =[B(arc(12,15.5,7.5,180,360,40),{W:2.3,taper:'none'}), B(line([3,18.5],[21,18.5]),{W:2.3}), {dot:[12,6.3,1.7]}];
I['tool-insight']  =[B(round([[2.5,13],[7,13],[9.5,5.5],[13,19.5],[15.5,10.5],[17,13],[21.5,13]],1),{W:2.9})];
const _pal=join(cubic([13,3.2],[6.5,3],[2.6,7.5],[2.8,12.6]), cubic([2.8,12.6],[3,18.2],[7.5,21.2],[12.6,20.8]),
  cubic([12.6,20.8],[16.5,20.5],[15.5,16.8],[17.6,15.4]), cubic([17.6,15.4],[20.8,13.8],[21.5,9.2],[19.2,6.4]),
  cubic([19.2,6.4],[17.6,4.4],[15.5,3.3],[13,3.2]));
I['tool-wiki']     =[B(join(arc(12,12,3.6,-90,270,36)),{taper:'both',W:2.2}), B(line([12,8.2],[12,5.4]),{W:1.6,taper:'end'}), B(line([15.3,13.9],[17.7,15.3]),{W:1.6,taper:'end'}), B(line([8.7,13.9],[6.3,15.3]),{W:1.6,taper:'end'}),
                     {dot:[12,3.7,2]}, {dot:[19.2,16.2,2]}, {dot:[4.8,16.2,2]}];
I['tool-canon']    =[B(line([6.8,19.6],[6.8,12.6]),{W:2.2,taper:'end'}), B(line([17.2,19.6],[17.2,12.6]),{W:2.2,taper:'end'}),
                     B(line([12,20],[12,8]),{W:2.8,taper:'end'}), {dot:[12,4.4,2.1]}, B(line([3.6,21.4],[20.4,21.4]),{W:1.7})];
I['tool-atelier']  =[B(_pal,{W:2.1,taper:'none'}), {dot:[7.8,8.6,1.6]}, {dot:[12.2,7.2,1.6]}, {dot:[7.2,13.6,1.6]}, B(line([22,2],[11,15.5]),{W:2.8,taper:'start',over:true})];
let _uid=0;
function svg(name,size,extra){
  const strokes=I[name]; if(!strokes) return '';
  const id='bi'+(++_uid); let under='', over='', mask='', cuts='';
  strokes.forEach(s=>{
    if(s.fill){ under+=`<path d="${s.fill}"/>`; return; }
    if(s.dot){ under+=`<circle cx="${s.dot[0]}" cy="${s.dot[1]}" r="${s.dot[2]}"/>`; return; }
    if(s.cut){ cuts+=`<path d="${blade(s.cut.pts,s.cut)}" fill="#000"/>`; return; }
    if(s.cutdot){ cuts+=`<circle cx="${s.cutdot[0]}" cy="${s.cutdot[1]}" r="${s.cutdot[2]}" fill="#000"/>`; return; }
    const d=blade(s.pts,s);
    if(s.over){ over+=`<path d="${d}"/>`; mask+=`<path d="${d}" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/>`; }
    else under+=`<path d="${d}"/>`;
  });
  let defs='', body='';
  if(mask){ defs+=`<mask id="${id}g" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${mask}</mask>`; body=`<g mask="url(#${id}g)">${under}</g>${over}`; }
  else body=under+over;
  if(cuts){ defs+=`<mask id="${id}c" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${cuts}</mask>`; body=`<g mask="url(#${id}c)">${body}</g>`; }
  return `<svg class="bi bi-${name}" viewBox="0 0 24 24" width="${size||20}" height="${size||20}" fill="currentColor" aria-hidden="true"${extra||''}>${defs?'<defs>'+defs+'</defs>':''}${body}</svg>`;
}
const COIN_TOOLS={writer:'pen', wiki:'tool-wiki', canon:'tool-canon', strategist:'tool-strategist', butler:'tool-butler', atelier:'tool-atelier', insight:'tool-insight', sandbox:'sandbox', parables:'cards'};
const COIN_NAMES={writer:'Writer', wiki:'Wiki', canon:'Canon', strategist:'Strategist', butler:'Butler', atelier:'Atelier', insight:'System Insight', sandbox:'Sandbox'};
function bladesCoin(tool,size){
  const s=size||28, ic=COIN_TOOLS[tool]||'apps';
  return `<span class="bl-coin" data-tool="${tool}" style="width:${s}px;height:${s}px" aria-hidden="true">${svg(ic,Math.round(s*0.72))}</span>`;
}
if(typeof module!=='undefined') module.exports={I,svg,blade,bladesCoin,COIN_TOOLS};
if(typeof window!=='undefined'){ window.BladesIcon=svg; window.BladesCoin=bladesCoin; window.BLADES_TOOLS=COIN_NAMES; window.BLADES_ICONS=Object.keys(I); }
