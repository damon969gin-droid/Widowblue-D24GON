/* WidowBlue neural net canvas – sequential ignition of all nodes */
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
const IV=[[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[.577,.577,.577],[-.577,.577,.577],[.577,-.577,.577],[-.577,-.577,.577],[.577,.577,-.577],[-.577,.577,-.577]];
const FACES=[[0,6,7,0],[0,7,9,0],[0,9,8,0],[0,8,6,0],[1,10,11,1],[1,11,13%12,1],[6,2,10,6],[7,4,11,7]];
const speed=[.35,.22,.14];

function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;cx=W/2;cy=H*0.42;R=Math.min(W,H)*0.38;}
resize();window.addEventListener('resize',resize);
document.getElementById('t').textContent=nodes.length;

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
const STD_ACTIVE=200;
const MAX_AGENTS=nodes.length;
let seqActive=false;
let seqIdx=0;
let seqOrder=[];

function buildSeqOrder(){
  seqOrder=[];
  for(let i=0;i<12;i++) seqOrder.push(i);
  for(let k=1;k<=4;k++){
    for(let i=12;i<nodes.length;i++) if(nodes[i].k===k) seqOrder.push(i);
  }
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
  // Accensione sequenziale di TUTTI i nodi (anche senza allMode)
  buildSeqOrder();
  nodes.forEach((n)=>{ n.act=0; });
  for(let i=0;i<12;i++) nodes[i].act=allMode?0.98:0.95;
  seqIdx=12;
  seqActive=true;
  countTarget=12;
  pulses.length=0;
  for(let i=0;i<12;i++){
    const kids=nodes[i].kids||[];
    for(let k=0;k<kids.length;k++){
      pulses.push({from:i,to:kids[k],t:-(k%8)*0.028-Math.random()*0.03});
    }
    pulses.push({from:i,to:(i+1)%12,t:-Math.random()*0.06});
    pulses.push({from:i,to:(i+3)%12,t:-0.03-Math.random()*0.06});
    pulses.push({from:i,to:(i+5)%12,t:-0.05-Math.random()*0.08});
  }
  const edgeCap=allMode?1800:1200;
  for(let p=0;p<Math.min(EDGE.length,edgeCap);p++){
    const e=EDGE[p];
    if(!e) continue;
    if(e[0]<12 && e[1]>=12) continue;
    pulses.push({from:e[0],to:e[1],t:-0.08-Math.random()*0.45});
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
      nodes.forEach((n)=>{
        if(n.k===0) n.act=0.95;
        else n.act=0.7+Math.random()*0.25;
      });
      countTarget=MAX_AGENTS;
      if(running) igniteNetwork();
      else pulses.length=0;
    } else {
      this.running=false; running=false; window.running=false;
      dimNetwork();
    }
  },
  setRunning(v){
    this.running=!!v;
    running=!!v;
    window.running=!!v;
    if(v){
      igniteNetwork();
    } else {
      pulses.length=0;
      if(allMode){
        nodes.forEach((n)=>{
          if(n.k===0) n.act=0.9;
          else n.act=Math.max(0.55, n.act*0.9);
        });
        countTarget=MAX_AGENTS;
        seqActive=false;
      } else {
        dimNetwork();
      }
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
  const fullNet=!!allMode;

  {
    const amb=x.createRadialGradient(cx+R*.8,cy-R*.25,0,cx+R*.8,cy-R*.25,R*1.5);
    amb.addColorStop(0,fullNet?'rgba(255,200,40,.35)':'rgba(255,190,50,.22)');
    amb.addColorStop(.4,fullNet?'rgba(230,150,20,.14)':'rgba(220,140,20,.08)');
    amb.addColorStop(.75,'rgba(160,90,10,.03)');
    amb.addColorStop(1,'rgba(0,0,0,0)');
    x.globalAlpha=1;x.fillStyle=amb;x.fillRect(0,0,W,H);
  }
  if(fullNet){
    for(let n of nodes){
      if(n.k!==0) continue;
      const q=proj(n.p);
      x.strokeStyle='rgba(255,210,80,0.55)';
      x.lineWidth=1.4;
      x.globalAlpha=.55;
      x.beginPath();x.moveTo(cx,cy);x.lineTo(q[0],q[1]);x.stroke();
    }
    const rayN=48;
    for(let i=0;i<rayN;i++){
      const a=(i/rayN)*Math.PI*2+t*.15;
      const len=R*(0.55+0.35*Math.sin(t*1.2+i));
      x.strokeStyle='rgba(255,200,60,0.12)';
      x.lineWidth=1;
      x.globalAlpha=.35;
      x.beginPath();
      x.moveTo(cx,cy);
      x.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len*.72);
      x.stroke();
    }
  }

  x.globalAlpha=fullNet?0.55:0.28;
  x.strokeStyle=fullNet?'rgba(255,200,70,0.65)':'rgba(80,160,180,0.35)';
  x.lineWidth=fullNet?1.15:0.7;
  for(let i=0;i<EDGE.length;i++){
    const e=EDGE[i];
    const a=P[e[0]],b=P[e[1]];
    if(!a||!b) continue;
    const na=nodes[e[0]],nb=nodes[e[1]];
    const strength=Math.max(na.act||0,nb.act||0);
    if(!fullNet && strength<0.05 && !running) continue;
    x.globalAlpha=(fullNet?0.5:0.22)*(0.35+strength*0.65);
    x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();
  }

  for(let i=pulses.length-1;i>=0;i--){
    const p=pulses[i];
    p.t+=fullNet?0.018:0.014;
    if(p.t>1){ pulses.splice(i,1); continue; }
    if(!running){ pulses.splice(i,1); continue; }
    const a=P[p.from],b=P[p.to];
    if(!a||!b){ pulses.splice(i,1); continue; }
    const px=a[0]+(b[0]-a[0])*p.t;
    const py=a[1]+(b[1]-a[1])*p.t;
    const trail=Math.max(0,p.t-.14);
    x.strokeStyle=fullNet?'rgba(255,210,90,0.9)':'rgba(195,180,125,0.75)';
    x.lineWidth=fullNet?2.1:1.65;
    x.globalAlpha=(fullNet?.78:.62)*(1-p.t);
    x.beginPath();
    x.moveTo(a[0]+(b[0]-a[0])*trail,a[1]+(b[1]-a[1])*trail);
    x.lineTo(px,py);
    x.stroke();
    x.globalAlpha=(fullNet?.95:.8)*(1-p.t*0.35);
    x.fillStyle=fullNet?'rgba(255,230,140,1)':'rgba(215,195,135,0.95)';
    x.beginPath();x.arc(px,py,fullNet?2.8:2.35,0,6.283);x.fill();
  }
  const pulseCap=fullNet?220:140;
  if(running&&pulses.length<pulseCap){
    const nNew=fullNet?20:12;
    for(let k=0;k<nNew;k++){
      const e=EDGE[(Math.random()*EDGE.length)|0];
      if(!e) continue;
      if(nodes[e[0]].act<=0.05 && nodes[e[1]].act<=0.05) continue;
      pulses.push({from:e[0],to:e[1],t:-Math.random()*0.2});
    }
  }

  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit);
  const SV=IV.map(v=>{let p=v.map(a=>a*.42);p=[p[0]*c1+p[2]*s1,p[1],-p[0]*s1+p[2]*c1];p=[p[0],p[1]*c2-p[2]*s2,p[1]*s2+p[2]*c2];return proj(p)});
  FACES.map(f=>({f,z:f.slice(0,5).reduce((s,i)=>s+(SV[i]?SV[i][2]:0),0)})).sort((a,b)=>b.z-a.z).forEach(({f})=>{
    x.beginPath();f.forEach((i,k)=>{const q=SV[i];if(!q)return;k?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]);});x.closePath();
    x.fillStyle=fullNet?'rgba(30,100,140,.12)':'rgba(40,120,150,.08)';x.fill();x.shadowBlur=0;
    x.strokeStyle=fullNet?'rgba(120,220,255,.98)':'rgba(90,200,220,.92)';
    x.lineWidth=fullNet?2.9:2.6;x.globalAlpha=.96;x.stroke();
  });
  SV.forEach(q=>{if(!q)return;x.shadowBlur=0;x.globalAlpha=1;x.fillStyle=fullNet?'#a8e8ff':'#8fd4e8';x.beginPath();x.arc(q[0],q[1],2.8*q[3],0,6.283);x.fill()});

  const pu=1+Math.sin(t*2.6)*.12;
  const coreR=R*(fullNet?.24:.16)*pu;
  if(fullNet){
    const halo=x.createRadialGradient(cx,cy,0,cx,cy,coreR*3.0);
    halo.addColorStop(0,'rgba(140,240,255,.55)');
    halo.addColorStop(.3,'rgba(70,200,255,.28)');
    halo.addColorStop(.65,'rgba(40,150,230,.1)');
    halo.addColorStop(1,'rgba(20,100,180,0)');
    x.globalAlpha=1;x.fillStyle=halo;x.beginPath();x.arc(cx,cy,coreR*3.0,0,6.283);x.fill();
  }
  const gr=x.createRadialGradient(cx,cy,0,cx,cy,coreR);
  if(fullNet){
    gr.addColorStop(0,'rgba(255,255,255,1)');
    gr.addColorStop(.1,'rgba(220,250,255,1)');
    gr.addColorStop(.3,'rgba(100,230,255,1)');
    gr.addColorStop(.55,'rgba(50,190,250,.7)');
    gr.addColorStop(1,'rgba(20,120,200,0)');
  }else{
    gr.addColorStop(0,'rgba(230,250,255,1)');
    gr.addColorStop(.4,'rgba(100,200,230,.55)');
    gr.addColorStop(1,'rgba(77,180,210,0)');
  }
  x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,coreR,0,6.283);x.fill();
  if(fullNet){
    const hot=x.createRadialGradient(cx,cy,0,cx,cy,coreR*.5);
    hot.addColorStop(0,'rgba(255,255,255,1)');
    hot.addColorStop(.4,'rgba(200,245,255,.7)');
    hot.addColorStop(1,'rgba(100,210,255,0)');
    x.fillStyle=hot;x.beginPath();x.arc(cx,cy,coreR*.5,0,6.283);x.fill();
  }

  // Onda sequenziale: accende tutti i nodi progressivamente
  if(running && seqActive){
    const batch = allMode ? 28 : 14;
    for(let b=0;b<batch && seqIdx<seqOrder.length;b++){
      const ni = seqOrder[seqIdx++];
      const nn = nodes[ni];
      if(!nn) continue;
      if(nn.k===0) nn.act = allMode ? 0.98 : 0.95;
      else if(nn.k===1) nn.act = allMode ? (0.82+Math.random()*0.12) : (0.62+Math.random()*0.28);
      else if(nn.k===2) nn.act = allMode ? (0.72+Math.random()*0.18) : (0.55+Math.random()*0.3);
      else nn.act = allMode ? (0.65+Math.random()*0.25) : (0.5+Math.random()*0.32);
      if(nn.par!=null) pulses.push({from:nn.par,to:ni,t:0});
      const kids=nn.kids||[];
      for(let k=0;k<Math.min(kids.length,3);k++) pulses.push({from:ni,to:kids[k],t:-Math.random()*0.05});
    }
    countTarget = Math.min(MAX_AGENTS, seqIdx);
    if(seqIdx>=seqOrder.length){
      seqActive=false;
      countTarget=MAX_AGENTS;
    }
  }

  const ord=P.map((q,i)=>i).sort((a,b)=>P[b][2]-P[a][2]);
  ord.forEach(i=>{
    const n=nodes[i],q=P[i];
    if(running){
      if(n.act>0.05) n.act=Math.min(0.99, Math.max(0.45, n.act*0.998+0.008));
    }else if(allMode){
      n.act=Math.max(0.55,n.act*0.997+0.003);
    }else{
      n.act*=.92;
      if(n.act<0.03) n.act=0;
    }
    const g=n.act>.05;
    const depth=Math.max(.22,Math.min(1,.68-q[2]*.45));
    x.globalAlpha=g?1:depth*(n.k?.72:1);
    if(fullNet){
      n.act=Math.max(n.act,0.88);
      x.fillStyle=n.k===0?'#ffe45a':'#ffd228';
    }else{
      x.fillStyle=g?'rgba(200,175,120,.88)':'#3ec8e0';
    }
    const sz=(n.s+(g?n.act*(fullNet?1.35:1.0):0))*q[3];
    x.beginPath();x.arc(q[0],q[1],sz,0,6.283);x.fill();
    if(fullNet&&g&&n.k===0){
      x.globalAlpha=.35;x.fillStyle='rgba(255,220,120,.5)';
      x.beginPath();x.arc(q[0],q[1],sz*1.8,0,6.283);x.fill();
    }
    if(n.k===0&&W>500&&q[2]<.45){
      x.globalAlpha=depth;x.fillStyle=fullNet?'rgba(255,220,140,.98)':(g?'rgba(200,175,120,.95)':'#7aa8b8');
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
  if(Math.abs(diff)>0.5) displayCount+=diff*0.12;
  else displayCount=countTarget;
  const nEl=document.getElementById('n');
  if(nEl) nEl.textContent=String(Math.round(Math.max(0, Math.min(MAX_AGENTS, displayCount))));
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
})();
