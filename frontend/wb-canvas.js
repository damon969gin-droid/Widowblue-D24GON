const cv=document.getElementById('c'),x=cv.getContext('2d');
let W,H,cx,cy,R,t=0,yaw=.4,pit=.28,drag=false,lx=0,ly=0,running=false,allMode=false;
const ROLES=['Coordinatore','Frontend','Backend','Design','Database','Media','Voce','Test','Memoria','Deploy','Sicurezza','Documenti'];
const PH=(1+Math.sqrt(5))/2,IV=[];
[[0,1,PH],[0,1,-PH],[0,-1,PH],[0,-1,-PH],[1,PH,0],[1,-PH,0],[-1,PH,0],[-1,-PH,0],[PH,0,1],[PH,0,-1],[-PH,0,1],[-PH,0,-1]].forEach(v=>{const l=Math.hypot(...v);IV.push(v.map(a=>a/l))});
const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const FACES=IV.map((v,i)=>{const nb=IV.map((u,j)=>j).filter(j=>j!==i&&Math.abs(d2(IV[j],v)-4/(1+PH*PH))<.01);const u0=Math.abs(v[0])<.9?[1,0,0]:[0,1,0];let a=[v[1]*u0[2]-v[2]*u0[1],v[2]*u0[0]-v[0]*u0[2],v[0]*u0[1]-v[1]*u0[0]];const al=Math.hypot(...a);a=a.map(q=>q/al);const b=[v[1]*a[2]-v[2]*a[1],v[2]*a[0]-v[0]*a[2],v[0]*a[1]-v[1]*a[0]];nb.sort((p,q)=>{const P=IV[p],Q=IV[q];return Math.atan2(P[0]*b[0]+P[1]*b[1]+P[2]*b[2],P[0]*a[0]+P[1]*a[1]+P[2]*a[2])-Math.atan2(Q[0]*b[0]+Q[1]*b[1]+Q[2]*b[2],Q[0]*a[0]+Q[1]*a[1]+Q[2]*a[2])});return[nb[0],nb[2],nb[4],nb[1],nb[3],nb[0]]});
function fib(i,n,r){const y=1-2*(i+.5)/n,q=Math.sqrt(Math.max(0,1-y*y)),a=i*2.39996;return[Math.cos(a)*q*r,y*r,Math.sin(a)*q*r]}
const nodes=[];ROLES.forEach((r,i)=>nodes.push({r,p:fib(i,12,.48),k:0,s:4.5,act:0,kids:[]}));
const shells=[[.22,.7],[.32,.9],[.46,1.12]],speed=[.11,-.085,.05];
shells.forEach(([share,rad],k)=>{const c=Math.round(400*share);for(let i=0;i<c;i++){const j=1+rad*.05*(Math.random()-.5),p=fib(i,c,rad*j);let best=0,bd=-9;nodes.slice(0,12).forEach((m,mi)=>{const d=m.p[0]*p[0]+m.p[1]*p[1]+m.p[2]*p[2];if(d>bd){bd=d;best=mi}});nodes.push({p,k:k+1,s:1.4+Math.random()*.9,act:0,par:best});nodes[best].kids.push(nodes.length-1)}});
const EDGE=[];
for(let i=12;i<nodes.length;i++){if(nodes[i].par!=null)EDGE.push([nodes[i].par,i])}
for(let i=0;i<12;i++){EDGE.push([i,(i+1)%12]);EDGE.push([i,(i+3)%12])}
document.getElementById('t').textContent=nodes.length;
function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight;cx=W/2;cy=H*.42;R=Math.min(W,H)*.36}resize();addEventListener('resize',resize);
cv.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lx)*.005;pit+=(e.clientY-ly)*.004;lx=e.clientX;ly=e.clientY});
cv.addEventListener('pointerup',()=>drag=false);
function proj(p){let[x0,y0,z0]=p;let c=Math.cos(yaw),s=Math.sin(yaw);let x1=x0*c-z0*s,z1=x0*s+z0*c;c=Math.cos(pit);s=Math.sin(pit);let y1=y0*c-z1*s,z2=y0*s+z1*c;const sc=1/(1.15+z2*.5);return[cx+x1*R*sc,cy+y1*R*sc,z2,sc]}
const pulses=[];
function draw(){
  t+=.016;x.clearRect(0,0,W,H);
  shells.forEach((_,k)=>{const a=speed[k]*.016,c=Math.cos(a),s=Math.sin(a);nodes.forEach(n=>{if(n.k===k+1){const[px,py,pz]=n.p;n.p=[px*c-pz*s,py,px*s+pz*c]}})});
  if(!drag)yaw+=.0085;
  const P=nodes.map(n=>proj(n.p));
  // Raggi centrali più luminosi
  x.globalAlpha=.28;x.strokeStyle='#7ef0ff';x.lineWidth=1.4;
  for(let i=0;i<12;i++){x.beginPath();x.moveTo(cx,cy);x.lineTo(P[i][0],P[i][1]);x.stroke()}
  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit);
  const SV=IV.map(v=>{let p=v.map(a=>a*.42);p=[p[0]*c1+p[2]*s1,p[1],-p[0]*s1+p[2]*c1];p=[p[0],p[1]*c2-p[2]*s2,p[1]*s2+p[2]*c2];return proj(p)});
  // Icosaedro: facce + spigoli più calcati e luminosi
  FACES.map(f=>({f,z:f.slice(0,5).reduce((s,i)=>s+SV[i][2],0)})).sort((a,b)=>b.z-a.z).forEach(({f})=>{
    x.beginPath();f.forEach((i,k)=>k?x.lineTo(SV[i][0],SV[i][1]):x.moveTo(SV[i][0],SV[i][1]));x.closePath();
    x.fillStyle='rgba(77,225,255,.12)';x.fill();
    x.shadowColor='rgba(120,240,255,.85)';x.shadowBlur=8;
    x.strokeStyle='rgba(210,255,255,.98)';x.lineWidth=2.35;x.stroke();
    x.shadowBlur=0;
  });
  SV.forEach(q=>{x.fillStyle='#ffffff';x.shadowColor='#4de1ff';x.shadowBlur=6;x.beginPath();x.arc(q[0],q[1],3.2*q[3],0,6.283);x.fill();x.shadowBlur=0});
  const pu=1+Math.sin(t*2.4)*.12,gr=x.createRadialGradient(cx,cy,0,cx,cy,R*.16*pu);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(120,240,255,.85)');gr.addColorStop(1,'rgba(77,225,255,0)');
  x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,R*.16*pu,0,6.283);x.fill();
  const fullNet=allMode&&(running||nodes.some(n=>n.act>.08));
  for(let e=0;e<(fullNet?EDGE.length:Math.min(EDGE.length,2800));e++){
    const [a,b]=EDGE[e];const na=nodes[a],nb=nodes[b];if(!na||!nb)continue;
    const strength=Math.max(na.act,nb.act);if(!(fullNet||strength>.04))continue;
    const A=P[a],B=P[b];if(!A||!B)continue;
    if(fullNet){x.globalAlpha=.18+strength*.4;x.strokeStyle=strength>.2?'#ffc266':'#6aecff';x.lineWidth=.85+strength*1.4}
    else{x.globalAlpha=.32+strength*.55;x.strokeStyle='#ffb347';x.lineWidth=1.1+strength*1.6}
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){
    const sa=nodes[i].act,sb=nodes[j].act;
    if(sa<.15&&sb<.15&&!fullNet)continue;if(!fullNet&&(sa<.15||sb<.15))continue;
    const A=P[i],B=P[j];x.globalAlpha=fullNet?.25:Math.min(1,.28+Math.max(sa,sb)*.65);x.strokeStyle='#ffc266';x.lineWidth=fullNet?1.1:1.35+Math.max(sa,sb)*1.2;
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }
  x.globalAlpha=1;
  for(let i=pulses.length-1;i>=0;i--){
    const p=pulses[i];p.t+=.035;if(p.t>1){pulses.splice(i,1);continue}
    const a=p.from>=0?P[p.from]:[cx,cy],b=P[p.to];if(!a||!b)continue;
    const px=a[0]+(b[0]-a[0])*p.t,py=a[1]+(b[1]-a[1])*p.t;
    x.strokeStyle='rgba(255,200,100,.7)';x.lineWidth=2.4;x.globalAlpha=1-p.t;
    x.beginPath();x.moveTo(a[0]+(b[0]-a[0])*Math.max(0,p.t-.12),a[1]+(b[1]-a[1])*Math.max(0,p.t-.12));x.lineTo(px,py);x.stroke();
    x.globalAlpha=1;x.fillStyle='#ffc266';x.beginPath();x.arc(px,py,3.2,0,6.283);x.fill();
  }
  const ord=P.map((q,i)=>i).sort((a,b)=>P[b][2]-P[a][2]);let act=0;
  ord.forEach(i=>{
    const n=nodes[i],q=P[i];
    n.act*=(allMode&&running)?.992:.986;
    if(allMode&&running&&n.act<.35)n.act=Math.min(1,n.act+.02);
    const g=n.act>.05;if(g)act++;
    const depth=Math.max(.22,Math.min(1,.68-q[2]*.45));
    x.globalAlpha=g?1:depth*(n.k?.72:1);x.fillStyle=g?'#ffb347':'#6aecff';
    x.beginPath();x.arc(q[0],q[1],(n.s+(g?n.act*2.2:0))*q[3],0,6.283);x.fill();
    if(g){x.globalAlpha=.35*n.act;x.beginPath();x.arc(q[0],q[1],(n.s+4+n.act*3)*q[3],0,6.283);x.fill()}
    if(n.k===0&&W>500&&q[2]<.4){x.globalAlpha=depth;x.fillStyle=g?'#ffb347':'#9fc8d8';x.font='600 12px Rajdhani,sans-serif';x.textAlign='center';x.fillText(n.r,q[0],q[1]-11)}
  });
  x.globalAlpha=1;document.getElementById('n').textContent=act;requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
