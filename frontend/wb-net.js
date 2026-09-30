const cv=document.getElementById('c'),x=cv.getContext('2d');
let W,H,cx,cy,R,t=0,yaw=.4,pit=.28,drag=false,lx=0,ly=0,running=false,allMode=false;
const ROLES=['Coordinatore','Frontend','Backend','Design','Database','Media','Voce','Test','Memoria','Deploy','Sicurezza','Documenti'];
const PH=(1+Math.sqrt(5))/2,IV=[];
[[0,1,PH],[0,1,-PH],[0,-1,PH],[0,-1,-PH],[1,PH,0],[1,-PH,0],[-1,PH,0],[-1,-PH,0],[PH,0,1],[PH,0,-1],[-PH,0,1],[-PH,0,-1]].forEach(v=>{const l=Math.hypot(...v);IV.push(v.map(a=>a/l))});
const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const FACES=IV.map((v,i)=>{const nb=IV.map((u,j)=>j).filter(j=>j!==i&&Math.abs(d2(IV[j],v)-4/(1+PH*PH))<.01);const u0=Math.abs(v[0])<.9?[1,0,0]:[0,1,0];let a=[v[1]*u0[2]-v[2]*u0[1],v[2]*u0[0]-v[0]*u0[2],v[0]*u0[1]-v[1]*u0[0]];const al=Math.hypot(...a);a=a.map(q=>q/al);const b=[v[1]*a[2]-v[2]*a[1],v[2]*a[0]-v[0]*a[2],v[0]*a[1]-v[1]*a[0]];nb.sort((p,q)=>{const P=IV[p],Q=IV[q];return Math.atan2(P[0]*b[0]+P[1]*b[1]+P[2]*b[2],P[0]*a[0]+P[1]*a[1]+P[2]*a[2])-Math.atan2(Q[0]*b[0]+Q[1]*b[1]+Q[2]*b[2],Q[0]*a[0]+Q[1]*a[1]+Q[2]*a[2])});return[nb[0],nb[2],nb[4],nb[1],nb[3],nb[0]]});
function fib(i,n,r){const y=1-2*(i+.5)/n,q=Math.sqrt(Math.max(0,1-y*y)),a=i*2.39996;return[Math.cos(a)*q*r,y*r,Math.sin(a)*q*r]}
const nodes=[];ROLES.forEach((r,i)=>nodes.push({r,p:fib(i,12,.48),k:0,s:4.5,act:0,kids:[]}));
const shells=[[.22,.7],[.32,.9],[.46,1.12]],speed=[.04,-.03,.018];
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
  if(!drag)yaw+=.003;
  const P=nodes.map(n=>proj(n.p));
  x.globalAlpha=.12;x.strokeStyle='#4de1ff';x.lineWidth=.7;
  for(let i=0;i<12;i++){x.beginPath();x.moveTo(cx,cy);x.lineTo(P[i][0],P[i][1]);x.stroke()}
  const c1=Math.cos(yaw),s1=Math.sin(yaw),c2=Math.cos(pit),s2=Math.sin(pit);
  const SV=IV.map(v=>{let p=v.map(a=>a*.42);p=[p[0]*c1+p[2]*s1,p[1],-p[0]*s1+p[2]*c1];p=[p[0],p[1]*c2-p[2]*s2,p[1]*s2+p[2]*c2];return proj(p)});
  FACES.map(f=>({f,z:f.slice(0,5).reduce((s,i)=>s+SV[i][2],0)})).sort((a,b)=>b.z-a.z).forEach(({f})=>{x.beginPath();f.forEach((i,k)=>k?x.lineTo(SV[i][0],SV[i][1]):x.moveTo(SV[i][0],SV[i][1]));x.closePath();x.fillStyle='rgba(77,225,255,.08)';x.fill();x.strokeStyle='rgba(232,251,255,.85)';x.lineWidth=1.25;x.stroke()});
  SV.forEach(q=>{x.fillStyle='#e8fbff';x.beginPath();x.arc(q[0],q[1],2.5*q[3],0,6.283);x.fill()});
  const pu=1+Math.sin(t*2)*.1,gr=x.createRadialGradient(cx,cy,0,cx,cy,R*.15*pu);
  gr.addColorStop(0,'rgba(232,251,255,1)');gr.addColorStop(.4,'rgba(77,225,255,.7)');gr.addColorStop(1,'rgba(77,225,255,0)');
  x.globalAlpha=1;x.fillStyle=gr;x.beginPath();x.arc(cx,cy,R*.15*pu,0,6.283);x.fill();
  const fullNet=allMode&&(running||nodes.some(n=>n.act>.08));
  for(let e=0;e<(fullNet?EDGE.length:Math.min(EDGE.length,2800));e++){
    const [a,b]=EDGE[e];const na=nodes[a],nb=nodes[b];if(!na||!nb)continue;
    const strength=Math.max(na.act,nb.act);if(!(fullNet||strength>.04))continue;
    const A=P[a],B=P[b];if(!A||!B)continue;
    if(fullNet){x.globalAlpha=.12+strength*.35;x.strokeStyle=strength>.2?'#ffb347':'#4de1ff';x.lineWidth=.55+strength*1.1}
    else{x.globalAlpha=.25+strength*.55;x.strokeStyle='#ffb347';x.lineWidth=.8+strength*1.4}
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){
    const sa=nodes[i].act,sb=nodes[j].act;
    if(sa<.15&&sb<.15&&!fullNet)continue;if(!fullNet&&(sa<.15||sb<.15))continue;
    const A=P[i],B=P[j];x.globalAlpha=fullNet?.18:Math.min(1,.2+Math.max(sa,sb)*.6);x.strokeStyle='#ffb347';x.lineWidth=fullNet?.7:1+Math.max(sa,sb);
    x.beginPath();x.moveTo(A[0],A[1]);x.lineTo(B[0],B[1]);x.stroke();
  }
  x.globalAlpha=1;
  for(let i=pulses.length-1;i>=0;i--){
    const p=pulses[i];p.t+=.028;if(p.t>1){pulses.splice(i,1);continue}
    const a=p.from>=0?P[p.from]:[cx,cy],b=P[p.to];if(!a||!b)continue;
    const px=a[0]+(b[0]-a[0])*p.t,py=a[1]+(b[1]-a[1])*p.t;
    x.strokeStyle='rgba(255,179,71,.55)';x.lineWidth=2;x.globalAlpha=1-p.t;
    x.beginPath();x.moveTo(a[0]+(b[0]-a[0])*Math.max(0,p.t-.12),a[1]+(b[1]-a[1])*Math.max(0,p.t-.12));x.lineTo(px,py);x.stroke();
    x.globalAlpha=1;x.fillStyle='#ffb347';x.beginPath();x.arc(px,py,2.8,0,6.283);x.fill();
  }
  const ord=P.map((q,i)=>i).sort((a,b)=>P[b][2]-P[a][2]);let act=0;
  ord.forEach(i=>{
    const n=nodes[i],q=P[i];
    n.act*=(allMode&&running)?.992:.986;
    if(allMode&&running&&n.act<.35)n.act=Math.min(1,n.act+.02);
    const g=n.act>.05;if(g)act++;
    const depth=Math.max(.22,Math.min(1,.68-q[2]*.45));
    x.globalAlpha=g?1:depth*(n.k?.72:1);x.fillStyle=g?'#ffb347':'#4de1ff';
    x.beginPath();x.arc(q[0],q[1],(n.s+(g?n.act*2.2:0))*q[3],0,6.283);x.fill();
    if(g){x.globalAlpha=.35*n.act;x.beginPath();x.arc(q[0],q[1],(n.s+4+n.act*3)*q[3],0,6.283);x.fill()}
    if(n.k===0&&W>500&&q[2]<.4){x.globalAlpha=depth;x.fillStyle=g?'#ffb347':'#8fb5c7';x.font='600 12px Rajdhani,sans-serif';x.textAlign='center';x.fillText(n.r,q[0],q[1]-11)}
  });
  x.globalAlpha=1;document.getElementById('n').textContent=act;requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

const logEl=document.getElementById('log'),files=[];let lastResult='';
function say(role,txt,cls){const d=document.createElement('div');d.className='msg '+(cls||'agent');if(cls==='user')d.textContent=txt;else d.innerHTML='<i>'+role+'</i> '+txt;logEl.appendChild(d);logEl.scrollTop=1e9;while(logEl.children.length>40)logEl.removeChild(logEl.firstChild)}
function fire(i){if(i<0||i>=nodes.length)return;const n=nodes[i];n.act=1;pulses.push({from:-1,to:i,t:0});(n.kids||[]).forEach((k,j)=>setTimeout(()=>{if(!nodes[k])return;nodes[k].act=1;pulses.push({from:i,to:k,t:0});const sib=(nodes[i].kids||[]).filter(id=>id!==k&&nodes[id]&&nodes[id].act>.3);if(sib.length){const other=sib[j%sib.length];pulses.push({from:k,to:other,t:0});nodes[other].act=Math.max(nodes[other].act,.7)}},j*12))}
function fireAll(){for(let i=0;i<nodes.length;i++)nodes[i].act=1;for(let i=0;i<12;i++)setTimeout(()=>fire(i),i*50);for(let e=0;e<Math.min(EDGE.length,200);e+=3){const[a,b]=EDGE[e];setTimeout(()=>pulses.push({from:a,to:b,t:0}),80+(e%40)*8)}}
function renderChips(){const c=document.getElementById('chips');c.innerHTML='';files.forEach((f,i)=>{const s=document.createElement('span');s.className='chip';s.textContent=f.name+' \u00d7';s.onclick=()=>{files.splice(i,1);renderChips()};c.appendChild(s)})}
document.getElementById('clip').onclick=()=>document.getElementById('file').click();
document.getElementById('file').onchange=async e=>{for(const f of e.target.files){const item={name:f.name,type:f.type||'',size:f.size};if(f.type.startsWith('text/')||/\.(txt|md|json|csv|js|ts|tsx|jsx|py|html|css|yml|yaml|xml|svg)$/i.test(f.name)){try{item.text=(await f.text()).slice(0,80000)}catch(err){item.note='testo'}}else if(f.type.startsWith('image/'))item.note='immagine';else if(f.type.startsWith('video/'))item.note='video';else if(f.type.startsWith('audio/'))item.note='audio';else if(/\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i.test(f.name))item.note='documento';else item.note='allegato';files.push(item)}e.target.value='';renderChips();say('Media',files.length+' file in coda')};
const LANGS=[['auto','Auto'],['it-IT','IT'],['en-US','EN'],['en-GB','EN-GB'],['es-ES','ES'],['fr-FR','FR'],['de-DE','DE'],['pt-BR','PT'],['zh-CN','ZH'],['ja-JP','JA'],['ko-KR','KO'],['ar-SA','AR'],['ru-RU','RU'],['hi-IN','HI'],['nl-NL','NL'],['pl-PL','PL'],['tr-TR','TR'],['uk-UA','UK']];
const langSel=document.getElementById('lang');LANGS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;langSel.appendChild(o)});
const bl=navigator.language||'it-IT';const m=LANGS.find(([v])=>v!=='auto'&&bl.toLowerCase().startsWith(v.slice(0,2).toLowerCase()));langSel.value=m?m[0]:'auto';
let rec=null,listening=false;const voiceBtn=document.getElementById('voice');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function currentLang(){const v=langSel.value;return v==='auto'?(navigator.language||'it-IT'):v}
if(SR){rec=new SR();rec.interimResults=true;rec.continuous=false;rec.onresult=e=>{let final='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=t;else document.getElementById('q').placeholder=t}if(final){const q=document.getElementById('q');q.value=(q.value+' '+final).trim();q.placeholder='Scrivi, parla o allega...'}};rec.onend=()=>{listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce'};rec.onerror=()=>{listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce';say('Voce','microfono non disponibile')}}
voiceBtn.onclick=()=>{if(!rec){say('Voce','Usa Chrome/Edge per la voce');return}if(listening){rec.stop();return}rec.lang=currentLang();listening=true;voiceBtn.classList.add('rec');voiceBtn.textContent='Ascolto\u2026';try{rec.start()}catch(e){listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce'}};
document.getElementById('allAgents').onclick=function(){allMode=!allMode;this.textContent='Tutti gli agenti: '+(allMode?'s\u00ec':'no');this.classList.toggle('on',allMode);if(allMode){for(let i=0;i<nodes.length;i++)nodes[i].act=Math.max(nodes[i].act,.45);say('Rete','TUTTI GLI AGENTI ON \u00b7 '+nodes.length+' nodi \u00b7 ogni Invia = ricerca approfondita')}else say('Rete','modalit\u00e0 standard (core agents)')};
function analyze(q,atts,deep){
  const ql=q.toLowerCase();const links=q.match(/https?:\/\/[^\s]+/g)||[];const words=q.split(/\s+/).filter(Boolean).length;
  const wants={web:/sito|web|landing|html|next|react|frontend|pagina|website|ui|ux/.test(ql),api:/api|backend|server|endpoint|fastapi|node|express|graphql/.test(ql),db:/database|db|postgres|sql|supabase|neon|mongo|redis/.test(ql),mobile:/app|mobile|flutter|android|ios|swift|kotlin/.test(ql),auth:/login|auth|autenticazione|oauth|utente|registrazione|mfa|password/.test(ql),media:/immagine|video|logo|splash|avatar|image|audio/.test(ql),research:/cerca|ricerca|search|analizza|page|confronta|mercato|competitor/.test(ql)||links.length>0,security:/sicurezza|security|nis2|encrypt|firewall|waf/.test(ql),cloud:/cloudflare|aws|deploy|vercel|docker|k8s|hosting/.test(ql)};
  const stack=[];if(wants.web)stack.push('Next.js + Tailwind + React');if(wants.api)stack.push('FastAPI / Node (API REST)');if(wants.db)stack.push('PostgreSQL + Redis');if(wants.mobile)stack.push('Flutter (iOS/Android)');if(wants.auth)stack.push('Auth JWT + MFA TOTP');if(wants.security)stack.push('WAF Cloudflare + Zero Trust');if(wants.cloud)stack.push('Cloudflare Workers/Pages + R2');if(wants.research)stack.push('Ricerca multi-provider tracciata');if(wants.media)stack.push('Pipeline media');if(!stack.length)stack.push('Next.js + Tailwind','Cloudflare Workers','Auth modulare');
  const nAgents=nodes.length;let attNote='';
  if(atts.length)attNote='\nAllegati:\n'+atts.map(a=>'- '+a.name+(a.text?' ['+a.text.length+' car]':a.note?(' ['+a.note+']'):'')).join('\n');
  if(links.length)attNote+='\nLink rilevati:\n'+links.map(u=>'- '+u).join('\n');
  if(!deep)return{title:'Piano WidowBlue',body:'RICHIESTA\n'+q+attNote+'\n\nMODALIT\u00c0\nStandard (core agents)\nAgenti coinvolti: ~12 core + cluster\n\nSTACK\n- '+stack.join('\n- ')+'\n\nPIANO\n1. Coordinatore\n2. Design\n3. Frontend\n4. Backend\n5. Database\n6. Test\n7. Memoria\n8. Deploy\n\nRICERCA WEB\nMulti-provider, tracciabile, rispettosa.\n\n\u2014 WidowBlue'};
  const domains=['Architettura e pattern','Stack e alternative','Sicurezza NIS2 / threat model','UX/UI accessibilit\u00e0','Schema DB e migrazioni','API contract','Deploy CI/CD osservabilit\u00e0','Costi e scaling','Privacy e licenze','Test unit/e2e/load','Documentazione','Ricerca fonti multi-provider'];
  const per=Math.max(1,Math.floor((nAgents-12)/12));
  const agentLines=ROLES.map((r)=>'  \u00b7 '+r+' + cluster (~'+per+' sub-agenti)').join('\n');
  return{title:'Analisi approfondita \u00b7 '+nAgents+' agenti',body:'\u2550\u2550\u2550 WIDOWBLUE DEEP SWEEP \u2550\u2550\u2550\nAgenti totali attivati: '+nAgents+'\nModalit\u00e0: TUTTI GLI AGENTI (ricerca approfondita)\nParole richiesta: '+words+'\n\nRICHIESTA\n'+q+attNote+'\n\nRETE AGENTI\n'+agentLines+'\n\nSTACK CONSIGLIATO\n- '+stack.join('\n- ')+'\n\nAREE ANALIZZATE\n'+domains.map((d,i)=>(i+1)+'. '+d).join('\n')+'\n\nPIANO ESECUTIVO\n1. Coordinatore: WBS, dipendenze, rischi\n2. Ricerca multi-provider tracciata\n3. Design system + HUD\n4. Frontend componenti\n5. Backend API + validazione\n6. Database + backup 3-2-1\n7. Sicurezza salt+pepper MFA\n8. Media e documenti\n9. Test automatici\n10. Memoria RAG\n11. Deploy Cloudflare\n12. Runbook e ADR\n\nOUTPUT ATTESI\n- Architecture Decision Records\n- Schema DB + OpenAPI\n- Scaffold multi-layer\n- Checklist NIS2\n- Piano deploy/rollback\n\n\u2014 WidowBlue \u00b7 deep \u00b7 '+nAgents+' agenti'};
}
const stepsStd=[[0,'Analizzo','Coordinatore'],[3,'Design','Design'],[1,'Frontend','Frontend'],[2,'Backend','Backend'],[4,'Database','Database'],[5,'Media','Media'],[7,'Test','Test'],[8,'Memoria','Memoria'],[9,'Deploy','Deploy'],[10,'Sicurezza','Sicurezza'],[11,'Docs','Documenti']];
const stepsDeep=[[0,'Deep sweep rete','Coordinatore'],[0,'Ricerca multi-fonte','Coordinatore'],[3,'Design system','Design'],[1,'Architettura UI','Frontend'],[2,'Contratti API','Backend'],[4,'Modello dati','Database'],[10,'Threat model','Sicurezza'],[5,'Asset media','Media'],[7,'Piano test','Test'],[8,'Contesto RAG','Memoria'],[9,'Pipeline deploy','Deploy'],[11,'Documentazione','Documenti'],[0,'Sintesi finale','Coordinatore']];
function showPanel(title,body){lastResult=body;document.getElementById('ptitle').textContent=title;document.getElementById('pbody').textContent=body;document.getElementById('panel').style.display='block';document.getElementById('overlay').style.display='block'}
document.getElementById('pclose').onclick=document.getElementById('overlay').onclick=()=>{document.getElementById('panel').style.display='none';document.getElementById('overlay').style.display='none'};
document.getElementById('pcopy').onclick=async()=>{try{await navigator.clipboard.writeText(lastResult);say('Widow Blue','copiato')}catch(e){}};
document.getElementById('pdl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lastResult],{type:'text/plain'}));a.download='widowblue-piano.txt';a.click()};
function run(){
  if(running)return;
  const q=document.getElementById('q').value.trim();
  if(!q&&!files.length){say('Widow Blue','scrivi, parla o allega');return}
  running=true;const go=document.getElementById('go');if(go)go.disabled=true;
  const prompt=q||'(solo allegati)';const atts=files.slice();
  const userDiv=document.createElement('div');userDiv.className='msg user';userDiv.textContent=prompt;
  if(atts.length){const ad=document.createElement('div');ad.className='atts';ad.textContent='Allegati: '+atts.map(a=>a.name).join(', ');userDiv.appendChild(ad)}
  logEl.appendChild(userDiv);logEl.scrollTop=1e9;
  const nAgents=nodes.length;
  if(allMode){say('Coordinatore','modalit\u00e0 TUTTI GLI AGENTI \u2014 attivo '+nAgents+' agenti, ricerca approfondita\u2026');fireAll()}
  else{say('Coordinatore','elaborazione standard (core + cluster)\u2026');fire(0)}
  const steps=allMode?stepsDeep:stepsStd;const delay=allMode?420:650;let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){
      const[s,m,r]=steps[i++];fire(s);
      if(allMode){for(let k=0;k<nodes.length;k++)if(nodes[k].par===s||k===s)nodes[k].act=1}
      say(r,m+(allMode?' \u00b7 deep':''));
    }else{
      clearInterval(iv);
      const res=analyze(prompt,atts,allMode);
      showPanel(res.title,res.body);
      if(window.wbSaveConversation)wbSaveConversation(prompt,res.body);
      say('Widow Blue',allMode?('analisi deep completata \u00b7 '+nAgents+' agenti'):'piano pronto');
      running=false;if(go)go.disabled=false;files.length=0;renderChips();
    }
  },delay);
  document.getElementById('q').value='';
}
document.getElementById('go').onclick=run;
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
