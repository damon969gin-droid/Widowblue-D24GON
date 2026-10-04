/* WB canvas – starburst oro su richiesta normale + icosaedro pentagrammatico PH */
(function(){
const canvas=document.getElementById('c');
if(!canvas) return;
const x=canvas.getContext('2d');
let W,H,cx,cy,R,t=0,yaw=.4,pit=.28,roll=0,drag=false,lx=0,ly=0,running=false,allMode=false,ptrId=null;

const ROLES=['Coordinatore','Frontend','Backend','Design','Database','Media','Voce','Test','Memoria','Deploy','Sicurezza','Documenti'];
const TARGET_WORKERS=441;
function fib(i,n,r){const y=1-(i/(n-1))*2,rr=Math.sqrt(Math.max(0,1-y*y)),th=Math.PI*(3-Math.sqrt(5))*i;return[Math.cos(th)*rr*r,y*r,Math.sin(th)*rr*r];}
const nodes=[];ROLES.forEach((r,i)=>nodes.push({r,p:fib(i,12,.48),k:0,s:4.5,act:0,kids:[]}));
const shells=[[.25,.62],[.35,.78],[.4,.94]];
let _wleft=TARGET_WORKERS;
shells.forEach(([share,rad],k)=>{const c=k===shells.length-1?_wleft:Math.round(TARGET_WORKERS*share);_wleft-=c;for(let i=0;i<c;i++){const j=1+rad*.05*(Math.random()-.5),p=fib(i,c,rad*j);let best=0,bd=-9;nodes.slice(0,12).forEach((m,mi)=>{const d=m.p[0]*p[0]+m.p[1]*p[1]+m.p[2]*p[2];if(d>bd){bd=d;best=mi}});nodes.push({p,k:k+1,s:1.4+Math.random()*.9,act:0,par:best});nodes[best].kids.push(nodes.length-1)}});
const EDGE=[];
for(let i=12;i<nodes.length;i++){if(nodes[i].par!=null)EDGE.push([nodes[i].par,i])}
for(let i=0;i<12;i++){EDGE.push([i,(i+1)%12]);EDGE.push([i,(i+3)%12]);EDGE.push([i,(i+5)%12]);}
for(let i=12;i<nodes.length;i++){
  const p=nodes[i].par; if(p==null) continue;
  const kids=nodes[p].kids||[];
  const ix=kids.indexOf(i);
  if(ix>=0&&ix<kids.length-1) EDGE.push([i,kids[ix+1]]);
}
const PH=(1+Math.sqrt(5))/2,IV=[];
[[0,1,PH],[0,1,-PH],[0,-1,PH],[0,-1,-PH],[1,PH,0],[1,-PH,0],[-1,PH,0],[-1,-PH,0],[PH,0,1],[PH,0,-1],[-PH,0,1],[-PH,0,-1]].forEach(v=>{const l=Math.hypot(...v);IV.push(v.map(a=>a/l))});
const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const FACES=IV.map((v,i)=>{const nb=IV.map((u,j)=>j).filter(j=>j!==i&&Math.abs(d2(IV[j],v)-4/(1+PH*PH))<.01);const u0=Math.abs(v[0])<.9?[1,0,0]:[0,1,0];let a=[v[1]*u0[2]-v[2]*u0[1],v[2]*u0[0]-v[0]*u0[2],v[0]*u0[1]-v[1]*u0[0]];const al=Math.hypot(...a)||1;a=a.map(q=>q/al);const b=[v[1]*a[2]-v[2]*a[1],v[2]*a[0]-v[0]*a[2],v[0]*a[1]-v[1]*a[0]];nb.sort((p,q)=>{const P=IV[p],Q=IV[q];return Math.atan2(P[0]*b[0]+P[1]*b[1]+P[2]*b[2],P[0]*a[0]+P[1]*a[1]+P[2]*a[2])-Math.atan2(Q[0]*b[0]+Q[1]*b[1]+Q[2]*b[2],Q[0]*a[0]+Q[1]*a[1]+Q[2]*a[2])});return nb.length>=5?[nb[0],nb[2],nb[4],nb[1],nb[3],nb[0]]:[nb[0]||0,nb[1]||0,nb[2]||0,nb[0]||0];});
const speed=[.35,.22,.14];

function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;cx=W/2;cy=H*0.42;R=Math.min(W,H)*0.38;}
resize();window.addEventListener('resize',resize);
const tEl0=document.getElementById('t'); if(tEl0) tEl0.textContent=nodes.length;

function proj(p){
  let [px,py,pz]=p;
  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit),c3=Math.cos(roll),s3=Math.sin(roll);
  let x1=px*c1+pz*s1,z1=-px*s1+pz*c1;px=x1;pz=z1;
  let y1=py*c2-pz*s2;pz=py*s2+pz*c2;py=y1;
  x1=px*c3-py*s3;py=px*s3+py*c3;px=x1;
  const sc=R/(1.15+pz*0.55);
  return[cx+px*sc,cy+py*sc,pz,sc/R];
}

canvas.style.touchAction='none';
canvas.addEventListener('pointerdown',e=>{drag=true;ptrId=e.pointerId;lx=e.clientX;ly=e.clientY;try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!drag||(ptrId!=null&&e.pointerId!==ptrId))return;yaw+=(e.clientX-lx)*.005;pit=Math.max(-1.2,Math.min(1.2,pit+(e.clientY-ly)*.004));lx=e.clientX;ly=e.clientY;});
function endDrag(e){if(ptrId!=null&&e.pointerId!==ptrId)return;drag=false;ptrId=null;}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

const pulses=[];
let displayCount=0;
let countTarget=0;
const MAX_AGENTS=nodes.length;
let seqActive=false;
let seqIdx=0;
let seqOrder=[];

function buildSeqOrder(){
  seqOrder=[];
  for(let i=0;i<12;i++) seqOrder.push(i);
  for(let k=1;k<=4;k++) for(let i=12;i<nodes.length;i++) if(nodes[i].k===k) seqOrder.push(i);
  for(let i=12;i<nodes.length;i++) if(seqOrder.indexOf(i)<0) seqOrder.push(i);
}

function syncFlags(){
  if(window.WBNet){
    if(typeof window.WBNet.allMode==='boolean') allMode=window.WBNet.allMode;
    if(typeof window.WBNet.running==='boolean') running=window.WBNet.running;
  }
  if(typeof window.allMode==='boolean') allMode=window.allMode;
  if(typeof window.running==='boolean') running=window.running;
}

function igniteNetwork(){
  buildSeqOrder();
  nodes.forEach(n=>{n.act=0});
  if(!allMode){
    for(let i=0;i<12;i++) nodes[i].act=0.98;
    seqIdx=12; seqActive=true; countTarget=12;
  } else {
    for(let i=0;i<12;i++) nodes[i].act=0.9;
    seqIdx=12; seqActive=true; countTarget=12;
  }
  pulses.length=0;
  for(let i=0;i<12;i++){
    const kids=nodes[i].kids||[];
    for(let k=0;k<kids.length;k++) pulses.push({from:i,to:kids[k],t:-(k%8)*0.02-Math.random()*0.02});
    pulses.push({from:i,to:(i+1)%12,t:-Math.random()*0.05});
    pulses.push({from:i,to:(i+3)%12,t:-0.02-Math.random()*0.05});
  }
  for(let p=0;p<Math.min(EDGE.length,1600);p++){
    const e=EDGE[p]; if(!e) continue;
    if(e[0]<12 && e[1]>=12) continue;
    pulses.push({from:e[0],to:e[1],t:-0.05-Math.random()*0.4});
  }
}

function dimNetwork(){
  nodes.forEach(n=>{n.act=0});
  pulses.length=0;
  countTarget=0;
  seqActive=false;
  seqIdx=0;
}

window.WBNet={
  allMode:false,
  running:false,
  setAllMode(v){
    this.allMode=!!v;
    allMode=!!v;
    window.allMode=!!v;
    if(v){
      nodes.forEach((n)=>{ n.act = n.k===0 ? 0.5 : 0.25+Math.random()*0.15; });
      countTarget=MAX_AGENTS;
      seqActive=false;
      if(running) igniteNetwork();
    } else {
      this.running=false; running=false; window.running=false;
      dimNetwork();
    }
  },
  setRunning(v){
    this.running=!!v;
    running=!!v;
    window.running=!!v;
    if(v) igniteNetwork();
    else {
      pulses.length=0;
      if(allMode){
        nodes.forEach((n)=>{ n.act = n.k===0 ? 0.5 : 0.25; });
        countTarget=MAX_AGENTS;
        seqActive=false;
      } else dimNetwork();
    }
  },
  ignite:igniteNetwork,
  dim:dimNetwork,
  pulse(from,to){ pulses.push({from:from|0,to:to|0,t:0}); },
  nodes,
};

function draw(){
  t+=.016;x.clearRect(0,0,W,H);
  syncFlags();
  shells.forEach((_,k)=>{const a=speed[k]*.016,c=Math.cos(a),s=Math.sin(a);nodes.forEach(n=>{if(n.k===k+1){const[px,py,pz]=n.p;n.p=[px*c-pz*s,py,px*s+pz*c]}})});
  if(!drag)yaw+=.0085;
  const P=nodes.map(n=>proj(n.p));
  const burst = !!(running && !allMode);

  {
    const amb=x.createRadialGradient(cx+R*.75,cy-R*.2,0,cx+R*.75,cy-R*.2,R*1.6);
    amb.addColorStop(0, burst ? 'rgba(255,200,40,.38)' : 'rgba(255,190,50,.20)');
    amb.addColorStop(.4, burst ? 'rgba(230,150,20,.16)' : 'rgba(220,140,20,.08)');
    amb.addColorStop(.75,'rgba(160,90,10,.03)');
    amb.addColorStop(1,'rgba(0,0,0,0)');
    x.globalAlpha=1;x.fillStyle=amb;x.fillRect(0,0,W,H);
  }

  if(running && seqActive){
    const batch = burst ? 32 : 16;
    for(let b=0;b<batch && seqIdx<seqOrder.length;b++){
      const ni=seqOrder[seqIdx++];
      const nn=nodes[ni]; if(!nn) continue;
      if(burst) nn.act = nn.k===0 ? 0.98 : (0.85+Math.random()*0.12);
      else nn.act = nn.k===0 ? 0.9 : (0.45+Math.random()*0.25);
      if(nn.par!=null) pulses.push({from:nn.par,to:ni,t:0});
    }
    countTarget=Math.min(MAX_AGENTS, seqIdx);
    if(seqIdx>=seqOrder.length){ seqActive=false; countTarget=MAX_AGENTS; }
  }

  x.lineCap='round';
  if(burst){
    for(let i=0;i<nodes.length;i++){
      const q=P[i]; if(!q) continue;
      const isLead=i<12;
      x.globalAlpha=isLead?0.58:0.32;
      x.strokeStyle=isLead?'#ffd84a':'#ffc830';
      x.lineWidth=isLead?1.4:0.58;
      x.beginPath();x.moveTo(cx,cy);x.lineTo(q[0],q[1]);x.stroke();
    }
  } else {
    x.globalAlpha=.22;x.strokeStyle='rgba(90,180,210,.5)';x.lineWidth=1.1;
    for(let i=0;i<12;i++){ if(!P[i]) continue; x.beginPath();x.moveTo(cx,cy);x.lineTo(P[i][0],P[i][1]);x.stroke(); }
  }

  const edgeLimit=burst?EDGE.length:Math.min(EDGE.length,2200);
  for(let e=0;e<edgeLimit;e++){
    const ed=EDGE[e]; if(!ed) continue;
    const a=ed[0],b=ed[1];
    const na=nodes[a],nb=nodes[b]; if(!na||!nb) continue;
    const strength=Math.max(na.act||0,nb.act||0);
    if(!burst && strength<.05 && !allMode) continue;
    const A=P[a],B=P[b]; if(!A||!B) continue;
    if(burst){
      const lead=a<12&&b<12;
      if(!lead) continue;
      x.globalAlpha=0.72;
      x.strokeStyle='#6ef0ff';
      x.lineWidth=2.05;
    } else if(allMode){
      x.globalAlpha=.15+strength*.25;
      x.strokeStyle='rgba(100,200,220,.55)';
      x.lineWidth=.8;
    } else {
      x.globalAlpha=.18+strength*.3;
      x.strokeStyle='rgba(140,135,110,.65)';
      x.lineWidth=.85+strength*.6;
    }
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }

  for(let i=pulses.length-1;i>=0;i--){
    const p=pulses[i];
    p.t+=burst?.034:.024;
    if(p.t>1){pulses.splice(i,1);continue}
    if(p.t<0) continue;
    if(!running){pulses.splice(i,1);continue}
    const a=p.from>=0?P[p.from]:[cx,cy],b=P[p.to]; if(!a||!b) continue;
    const px=a[0]+(b[0]-a[0])*p.t, py=a[1]+(b[1]-a[1])*p.t;
    const trail=Math.max(0,p.t-.14);
    x.strokeStyle=burst?'rgba(255,210,90,0.92)':'rgba(160,210,230,0.7)';
    x.lineWidth=burst?2.15:1.5;
    x.globalAlpha=(burst?.8:.55)*(1-p.t);
    x.beginPath();
    x.moveTo(a[0]+(b[0]-a[0])*trail,a[1]+(b[1]-a[1])*trail);
    x.lineTo(px,py);x.stroke();
    x.globalAlpha=(burst?.95:.75)*(1-p.t*0.35);
    x.fillStyle=burst?'rgba(255,230,140,1)':'rgba(180,230,250,0.9)';
    x.beginPath();x.arc(px,py,burst?2.9:2.2,0,6.283);x.fill();
  }
  if(running&&pulses.length<(burst?240:120)){
    for(let k=0;k<(burst?22:10);k++){
      const e=EDGE[(Math.random()*EDGE.length)|0];
      if(!e) continue;
      if(nodes[e[0]].act<=0.05&&nodes[e[1]].act<=0.05) continue;
      pulses.push({from:e[0],to:e[1],t:-Math.random()*0.2});
    }
  }

  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit);
  const SV=IV.map(v=>{let p=v.map(a=>a*.48);p=[p[0]*c1+p[2]*s1,p[1],-p[0]*s1+p[2]*c1];p=[p[0],p[1]*c2-p[2]*s2,p[1]*s2+p[2]*c2];return proj(p)});
  FACES.map(f=>({f,z:f.reduce((s,i)=>s+(SV[i]?SV[i][2]:0),0)})).sort((a,b)=>b.z-a.z).forEach(({f})=>{
    x.beginPath();
    f.forEach((i,k)=>{const q=SV[i];if(!q)return;k?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]);});
    x.closePath();
    x.fillStyle=burst?'rgba(30,100,140,.14)':'rgba(40,120,150,.08)';x.fill();
    x.strokeStyle=burst?'rgba(120,220,255,.98)':'rgba(100,210,230,.95)';
    x.lineWidth=burst?3.0:2.7;x.globalAlpha=.98;x.stroke();
  });
  SV.forEach(q=>{if(!q)return;x.globalAlpha=1;x.fillStyle=burst?'#a8e8ff':'#8fd4e8';x.beginPath();x.arc(q[0],q[1],2.8*q[3],0,6.283);x.fill()});

  const pu=1+Math.sin(t*2.6)*.12;
  const coreR=R*(burst?.22:.15)*pu;
  if(burst){
    const halo=x.createRadialGradient(cx,cy,0,cx,cy,coreR*2.8);
    halo.addColorStop(0,'rgba(160,245,255,.5)');
    halo.addColorStop(.35,'rgba(70,200,255,.22)');
    halo.addColorStop(1,'rgba(20,100,180,0)');
    x.globalAlpha=1;x.fillStyle=halo;x.beginPath();x.arc(cx,cy,coreR*2.8,0,6.283);x.fill();
  }
  const gr=x.createRadialGradient(cx,cy,0,cx,cy,coreR);
  gr.addColorStop(0,'rgba(255,255,255,1)');
  gr.addColorStop(.15,'rgba(200,250,255,1)');
  gr.addColorStop(.4,'rgba(80,220,255,.95)');
  gr.addColorStop(.7,'rgba(40,170,230,.5)');
  gr.addColorStop(1,'rgba(20,100,180,0)');
  x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,coreR,0,6.283);x.fill();

  const ord=P.map((q,i)=>i).sort((a,b)=>P[b][2]-P[a][2]);
  ord.forEach(i=>{
    const n=nodes[i],q=P[i];
    if(running){
      if(n.act>0.05) n.act=Math.min(0.99, Math.max(0.5, n.act*0.999+0.006));
    } else if(allMode){
      n.act=Math.max(0.2, n.act*0.998);
    } else {
      n.act*=.9;
      if(n.act<0.03) n.act=0;
    }
    const g=n.act>.05;
    const depth=Math.max(.22,Math.min(1,.68-q[2]*.45));
    x.globalAlpha=g?1:depth*(n.k?.7:1);
    if(burst){
      n.act=Math.max(n.act,0.88);
      x.fillStyle=n.k===0?'#ffe45a':'#ffd228';
    } else if(allMode && g){
      x.fillStyle=n.k===0?'#7ec8e8':'#4db8d0';
    } else {
      x.fillStyle=g?'rgba(200,175,120,.85)':'#3ec8e0';
    }
    const sz=(n.s+(g?n.act*(burst?1.4:0.9):0))*q[3];
    x.beginPath();x.arc(q[0],q[1],sz,0,6.283);x.fill();
    if(burst&&n.k===0){
      x.globalAlpha=.32;x.fillStyle='rgba(255,220,120,.55)';
      x.beginPath();x.arc(q[0],q[1],sz*1.85,0,6.283);x.fill();
    }
    if(n.k===0&&W>500&&q[2]<.45){
      x.globalAlpha=depth;
      x.fillStyle=burst?'rgba(255,220,140,.98)':(g?'rgba(180,210,230,.95)':'#7aa8b8');
      x.font='600 12px Rajdhani,sans-serif';x.textAlign='center';x.fillText(n.r,q[0],q[1]-12);
    }
  });
  x.globalAlpha=1;
  const tEl=document.getElementById('t');
  if(tEl) tEl.textContent=String(MAX_AGENTS);
  if(allMode && !running) countTarget=MAX_AGENTS;
  if(!allMode && !running && !seqActive) countTarget=0;
  if(running && !seqActive) countTarget=MAX_AGENTS;
  const diff=countTarget-displayCount;
  if(Math.abs(diff)>0.5) displayCount+=diff*0.14;
  else displayCount=countTarget;
  const nEl=document.getElementById('n');
  if(nEl) nEl.textContent=String(Math.round(Math.max(0, Math.min(MAX_AGENTS, displayCount))));
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
})();
