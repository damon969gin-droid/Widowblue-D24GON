const cv=document.getElementById('c'),x=cv.getContext('2d');
let W,H,cx,cy,R,t=0,yaw=.4,pit=.28,roll=0,drag=false,lx=0,ly=0,running=false,allMode=false,ptrId=null;
const ROLES=['Coordinatore','Frontend','Backend','Design','Database','Media','Voce','Test','Memoria','Deploy','Sicurezza','Documenti'];
const PH=(1+Math.sqrt(5))/2,IV=[];
[[0,1,PH],[0,1,-PH],[0,-1,PH],[0,-1,-PH],[1,PH,0],[1,-PH,0],[-1,PH,0],[-1,-PH,0],[PH,0,1],[PH,0,-1],[-PH,0,1],[-PH,0,-1]].forEach(v=>{const l=Math.hypot(...v);IV.push(v.map(a=>a/l))});
const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const FACES=IV.map((v,i)=>{const nb=IV.map((u,j)=>j).filter(j=>j!==i&&Math.abs(d2(IV[j],v)-4/(1+PH*PH))<.01);const u0=Math.abs(v[0])<.9?[1,0,0]:[0,1,0];let a=[v[1]*u0[2]-v[2]*u0[1],v[2]*u0[0]-v[0]*u0[2],v[0]*u0[1]-v[1]*u0[0]];const al=Math.hypot(...a);a=a.map(q=>q/al);const b=[v[1]*a[2]-v[2]*a[1],v[2]*a[0]-v[0]*a[2],v[0]*a[1]-v[1]*a[0]];nb.sort((p,q)=>{const P=IV[p],Q=IV[q];return Math.atan2(P[0]*b[0]+P[1]*b[1]+P[2]*b[2],P[0]*a[0]+P[1]*a[1]+P[2]*a[2])-Math.atan2(Q[0]*b[0]+Q[1]*b[1]+Q[2]*b[2],Q[0]*a[0]+Q[1]*a[1]+Q[2]*a[2])});return[nb[0],nb[2],nb[4],nb[1],nb[3],nb[0]]});
function fib(i,n,r){const y=1-2*(i+.5)/n,q=Math.sqrt(Math.max(0,1-y*y)),a=i*2.39996;return[Math.cos(a)*q*r,y*r,Math.sin(a)*q*r]}
const nodes=[];ROLES.forEach((r,i)=>nodes.push({r,p:fib(i,12,.48),k:0,s:4.5,act:0,kids:[]}));
const TARGET_WORKERS=441;
const shells=[[.25,.7],[.35,.9],[.40,1.12]],speed=[.11,-.085,.05];
let _wleft=TARGET_WORKERS;
shells.forEach(([share,rad],k)=>{const c=k===shells.length-1?_wleft:Math.round(TARGET_WORKERS*share);_wleft-=c;for(let i=0;i<c;i++){const j=1+rad*.05*(Math.random()-.5),p=fib(i,c,rad*j);let best=0,bd=-9;nodes.slice(0,12).forEach((m,mi)=>{const d=m.p[0]*p[0]+m.p[1]*p[1]+m.p[2]*p[2];if(d>bd){bd=d;best=mi}});nodes.push({p,k:k+1,s:1.4+Math.random()*.9,act:0,par:best});nodes[best].kids.push(nodes.length-1)}});
const EDGE=[];
for(let i=12;i<nodes.length;i++){if(nodes[i].par!=null)EDGE.push([nodes[i].par,i])}
for(let i=0;i<12;i++){EDGE.push([i,(i+1)%12]);EDGE.push([i,(i+3)%12])}
document.getElementById('t').textContent=nodes.length;
function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight;cx=W/2;cy=H*.42;R=Math.min(W,H)*.36}resize();addEventListener('resize',resize);

cv.style.touchAction='none';
function onDown(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  drag=true;ptrId=e.pointerId;lx=e.clientX;ly=e.clientY;
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  cv.style.cursor='grabbing';
  e.preventDefault();
}
function onMove(e){
  if(!drag)return;
  if(ptrId!=null&&e.pointerId!==ptrId)return;
  const dx=e.clientX-lx,dy=e.clientY-ly;
  yaw+=dx*.0075;
  pit+=dy*.0065;
  if(pit>1.45)pit=1.45;if(pit<-1.45)pit=-1.45;
  lx=e.clientX;ly=e.clientY;
  e.preventDefault();
}
function onUp(e){
  if(ptrId!=null&&e.pointerId!==ptrId)return;
  drag=false;ptrId=null;cv.style.cursor='grab';
  try{if(e.pointerId!=null)cv.releasePointerCapture(e.pointerId)}catch(_){}
}
cv.addEventListener('pointerdown',onDown,{passive:false});
cv.addEventListener('pointermove',onMove,{passive:false});
cv.addEventListener('pointerup',onUp,{passive:false});
cv.addEventListener('pointercancel',onUp,{passive:false});
cv.addEventListener('pointerleave',e=>{if(drag)onUp(e)},{passive:false});
cv.addEventListener('touchstart',e=>{if(!e.touches[0])return;drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;e.preventDefault()},{passive:false});
cv.addEventListener('touchmove',e=>{if(!drag||!e.touches[0])return;const t0=e.touches[0];yaw+=(t0.clientX-lx)*.0075;pit+=(t0.clientY-ly)*.0065;if(pit>1.45)pit=1.45;if(pit<-1.45)pit=-1.45;lx=t0.clientX;ly=t0.clientY;e.preventDefault()},{passive:false});
cv.addEventListener('touchend',()=>{drag=false},{passive:false});

function proj(p){
  let[x0,y0,z0]=p;
  let c=Math.cos(yaw),s=Math.sin(yaw);
  let x1=x0*c-z0*s,z1=x0*s+z0*c;
  c=Math.cos(pit);s=Math.sin(pit);
  let y1=y0*c-z1*s,z2=y0*s+z1*c;
  c=Math.cos(roll);s=Math.sin(roll);
  let x2=x1*c-y1*s,y2=x1*s+y1*c;
  const sc=1/(1.15+z2*.5);
  return[cx+x2*R*sc,cy+y2*R*sc,z2,sc];
}

const pulses=[];

function syncFlags(){
  // Legge lo stato esposto da wb-app / WBNet
  if(window.WBNet){
    if(typeof window.WBNet.allMode==='boolean') allMode=window.WBNet.allMode;
    if(typeof window.WBNet.running==='boolean') running=window.WBNet.running;
  }
  if(typeof window.allMode==='boolean') allMode=window.allMode;
  if(typeof window.running==='boolean') running=window.running;
}

function igniteNetwork(){
  // Accende leader + worker e crea impulsi sulle connessioni
  nodes.forEach((n,i)=>{
    if(n.k===0) n.act=1;
    else n.act=0.55+Math.random()*0.45;
  });
  // Impulsi dai leader ai figli
  for(let i=0;i<12;i++){
    const kids=nodes[i].kids||[];
    for(let k=0;k<Math.min(kids.length,8);k++){
      pulses.push({from:i,to:kids[k],t:Math.random()*0.4});
    }
    // collegamenti tra leader
    pulses.push({from:i,to:(i+1)%12,t:Math.random()*0.3});
    pulses.push({from:i,to:(i+3)%12,t:Math.random()*0.5});
  }
  // alcuni impulsi random sulla rete
  for(let p=0;p<40;p++){
    const e=EDGE[(Math.random()*Math.min(EDGE.length,2000))|0];
    if(e) pulses.push({from:e[0],to:e[1],t:Math.random()});
  }
}

function dimNetwork(){
  nodes.forEach(n=>{n.act=0});
  pulses.length=0;
}

// API globale per wb-app
window.WBNet={
  allMode:false,
  running:false,
  setAllMode(v){
    this.allMode=!!v;
    allMode=!!v;
    window.allMode=!!v;
    if(v){ this.running=true; running=true; window.running=true; igniteNetwork(); }
    else { this.running=false; running=false; window.running=false; dimNetwork(); }
  },
  setRunning(v){
    this.running=!!v;
    running=!!v;
    window.running=!!v;
    if(v) igniteNetwork();
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

  x.globalAlpha=.35;x.strokeStyle='#3ec8e8';x.lineWidth=1.5;
  for(let i=0;i<12;i++){x.beginPath();x.moveTo(cx,cy);x.lineTo(P[i][0],P[i][1]);x.stroke()}

  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit);
  const SV=IV.map(v=>{let p=v.map(a=>a*.42);p=[p[0]*c1+p[2]*s1,p[1],-p[0]*s1+p[2]*c1];p=[p[0],p[1]*c2-p[2]*s2,p[1]*s2+p[2]*c2];return proj(p)});
  FACES.map(f=>({f,z:f.slice(0,5).reduce((s,i)=>s+SV[i][2],0)})).sort((a,b)=>b.z-a.z).forEach(({f})=>{
    x.beginPath();f.forEach((i,k)=>k?x.lineTo(SV[i][0],SV[i][1]):x.moveTo(SV[i][0],SV[i][1]));x.closePath();
    x.fillStyle='rgba(40,120,150,.06)';x.fill();x.shadowBlur=0;
    x.strokeStyle='rgba(90,200,220,.9)';x.lineWidth=2.6;x.globalAlpha=.95;x.stroke();
  });
  SV.forEach(q=>{x.shadowBlur=0;x.globalAlpha=1;x.fillStyle='#8fd4e8';x.beginPath();x.arc(q[0],q[1],2.8*q[3],0,6.283);x.fill()});

  const pu=1+Math.sin(t*2.2)*.08,gr=x.createRadialGradient(cx,cy,0,cx,cy,R*.14*pu);
  gr.addColorStop(0,'rgba(180,230,245,.85)');gr.addColorStop(.5,'rgba(77,180,210,.35)');gr.addColorStop(1,'rgba(77,180,210,0)');
  x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,R*.14*pu,0,6.283);x.fill();

  // Rete attiva: tutte le linee se allMode
  const fullNet=allMode&&(running||nodes.some(n=>n.act>.08));
  const edgeLimit=fullNet?EDGE.length:Math.min(EDGE.length,2800);
  for(let e=0;e<edgeLimit;e++){
    const [a,b]=EDGE[e];const na=nodes[a],nb=nodes[b];if(!na||!nb)continue;
    const strength=Math.max(na.act,nb.act);
    if(!(fullNet||strength>.04))continue;
    const A=P[a],B=P[b];if(!A||!B)continue;
    if(fullNet){
      x.globalAlpha=.14+strength*.42;
      x.strokeStyle=strength>.35?'#ffb347':'#4de1ff';
      x.lineWidth=.7+strength*1.5;
    }else{
      x.globalAlpha=.3+strength*.5;
      x.strokeStyle='#e8a040';
      x.lineWidth=1+strength*1.5;
    }
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }
  // Collegamenti tra i 12 leader
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){
    const sa=nodes[i].act,sb=nodes[j].act;
    if(sa<.12&&sb<.12&&!fullNet)continue;
    if(!fullNet&&(sa<.12||sb<.12))continue;
    const A=P[i],B=P[j];
    x.globalAlpha=fullNet?.28:Math.min(1,.3+Math.max(sa,sb)*.65);
    x.strokeStyle='#ffb347';
    x.lineWidth=fullNet?1.15:1.3+Math.max(sa,sb)*1.2;
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }

  x.globalAlpha=1;
  // Impulsi lungo le linee
  for(let i=pulses.length-1;i>=0;i--){
    const p=pulses[i];p.t+=.032;if(p.t>1){pulses.splice(i,1);continue}
    const a=p.from>=0?P[p.from]:[cx,cy],b=P[p.to];if(!a||!b)continue;
    const px=a[0]+(b[0]-a[0])*p.t,py=a[1]+(b[1]-a[1])*p.t;
    x.strokeStyle='rgba(255,179,71,.75)';x.lineWidth=2.4;x.globalAlpha=1-p.t;
    x.beginPath();x.moveTo(a[0]+(b[0]-a[0])*Math.max(0,p.t-.12),a[1]+(b[1]-a[1])*Math.max(0,p.t-.12));x.lineTo(px,py);x.stroke();
    x.globalAlpha=1;x.fillStyle='#ffb347';x.beginPath();x.arc(px,py,3.2,0,6.283);x.fill();
  }
  // Mantieni rete accesa in allMode+running
  if(fullNet&&pulses.length<25){
    for(let k=0;k<6;k++){
      const e=EDGE[(Math.random()*Math.min(EDGE.length,1500))|0];
      if(e) pulses.push({from:e[0],to:e[1],t:0});
    }
  }

  const ord=P.map((q,i)=>i).sort((a,b)=>P[b][2]-P[a][2]);let act=0;
  ord.forEach(i=>{
    const n=nodes[i],q=P[i];
    if(allMode&&running){
      n.act=Math.min(1,Math.max(n.act,0.4)*0.998+0.008);
      if(n.act<.4)n.act=Math.min(1,n.act+.025);
    }else{
      n.act*=.986;
    }
    const g=n.act>.05;if(g)act++;
    const depth=Math.max(.22,Math.min(1,.68-q[2]*.45));
    x.globalAlpha=g?1:depth*(n.k?.72:1);
    x.fillStyle=g?'#ffb347':'#4db8d0';
    x.beginPath();x.arc(q[0],q[1],(n.s+(g?n.act*2.4:0))*q[3],0,6.283);x.fill();
    if(g){
      x.globalAlpha=.32*n.act;
      x.beginPath();x.arc(q[0],q[1],(n.s+4+n.act*3.5)*q[3],0,6.283);x.fill();
    }
    if(n.k===0&&W>500&&q[2]<.4){
      x.globalAlpha=depth;x.fillStyle=g?'#ffb347':'#7aa8b8';
      x.font='600 12px Rajdhani,sans-serif';x.textAlign='center';x.fillText(n.r,q[0],q[1]-11);
    }
  });
  x.globalAlpha=1;
  const nEl=document.getElementById('n');
  if(nEl)nEl.textContent=act;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
