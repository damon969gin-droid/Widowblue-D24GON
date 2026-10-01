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

function isSoftwareRequest(prompt){
  const ql=(prompt||'').toLowerCase();
  return /sito|web|landing|app|api|backend|frontend|database|deploy|software|programma|codice|react|next|flutter|dashboard|login|registrazione|crea|costruisci|sviluppa/.test(ql);
}

/** Costruisce una risposta leggibile dalle fonti modular search */
function formatSearchAnswer(prompt,nAgents,deep,plan,search){
  const lines=[];
  lines.push(deep?'══ WIDOWBLUE · RISPOSTA DEEP ══':'══ WIDOWBLUE · RISPOSTA ══');
  lines.push('Richiesta: '+prompt);
  lines.push('Agenti: '+nAgents+(deep?' · tutti attivi':''));
  if(search&&search.queryNormalized&&search.queryNormalized!==prompt){
    lines.push('Query normalizzata: '+search.queryNormalized);
  }
  lines.push('');

  const results=(search&&search.results)||[];
  const providers=(search&&search.providers)||[];
  const answer=search&&search.answer;

  lines.push('— RISPOSTA —');
  if(answer&&answer.text){
    lines.push(answer.text);
    if(answer.title)lines.push('Fonte principale: ['+(answer.provider||'?')+'] '+answer.title);
    if(answer.url)lines.push(answer.url);
  }else if(results.length){
    // fallback: primo snippet lungo / summary
    const best=results.find(r=>r.kind==='summary'&&r.snippet)||results.find(r=>(r.snippet||'').length>40);
    if(best){
      lines.push(best.snippet.slice(0,700));
      lines.push('Fonte: ['+best.provider+'] '+(best.title||''));
      if(best.url)lines.push(best.url);
    }else{
      lines.push('(nessuna sintesi disponibile — vedi fonti)');
    }
  }else{
    lines.push('Ricerca live non ha restituito risultati utili.');
    lines.push('Suggerimento: aggiungi TAVILY_API_KEY o SERPER_API_KEY nei secret Cloudflare.');
  }

  if(results.length){
    lines.push('');
    lines.push('— FONTI TRACCIATE —');
    results.slice(0,deep?12:8).forEach((r,i)=>{
      lines.push((i+1)+'. ['+r.provider+'] '+(r.title||'senza titolo'));
      if(r.url)lines.push('   '+r.url);
    });
  }

  if(providers.length){
    lines.push('');
    lines.push('— PROVIDER —');
    providers.forEach(pr=>{
      lines.push('· '+pr.name+': '+(pr.ok?('ok · '+pr.count+' risultati · '+pr.ms+'ms'):('errore · '+(pr.error||''))));
    });
  }

  // Piano progetto solo se la richiesta è di tipo software
  if(isSoftwareRequest(prompt)&&plan&&plan.stack&&plan.stack.length){
    lines.push('');
    lines.push('— PIANO PROGETTO —');
    lines.push('Stack: '+plan.stack.join(' · '));
    if(plan.steps)plan.steps.forEach((s,i)=>lines.push((i+1)+'. '+s));
  }

  lines.push('');
  lines.push('— WidowBlue · ricerca modulare multi-provider');
  return lines.join('\n');
}

function analyze(q,atts,deep){
  const ql=q.toLowerCase();const links=q.match(/https?:\/\/[^\s]+/g)||[];
  const wants={web:/sito|web|landing|html|next|react|frontend|pagina|website|ui|ux/.test(ql),api:/api|backend|server|endpoint|fastapi|node|express|graphql/.test(ql),db:/database|db|postgres|sql|supabase|neon|mongo|redis/.test(ql),mobile:/app|mobile|flutter|android|ios|swift|kotlin/.test(ql),auth:/login|auth|autenticazione|oauth|utente|registrazione|mfa|password/.test(ql),media:/immagine|video|logo|splash|avatar|image|audio/.test(ql),research:/cerca|ricerca|search|analizza|page|confronta|mercato|competitor/.test(ql)||links.length>0,security:/sicurezza|security|nis2|encrypt|firewall|waf/.test(ql),cloud:/cloudflare|aws|deploy|vercel|docker|k8s|hosting/.test(ql)};
  const stack=[];if(wants.web)stack.push('Next.js + Tailwind + React');if(wants.api)stack.push('FastAPI / Node (API REST)');if(wants.db)stack.push('PostgreSQL + Redis');if(wants.mobile)stack.push('Flutter (iOS/Android)');if(wants.auth)stack.push('Auth JWT + MFA TOTP');if(wants.security)stack.push('WAF Cloudflare + Zero Trust');if(wants.cloud)stack.push('Cloudflare Workers/Pages + R2');if(wants.research)stack.push('Ricerca multi-provider tracciata');if(wants.media)stack.push('Pipeline media');if(!stack.length)stack.push('Next.js + Tailwind','Cloudflare Workers','Auth modulare');
  const nAgents=nodes.length;let attNote='';
  if(atts.length)attNote='\nAllegati:\n'+atts.map(a=>'- '+a.name+(a.text?' ['+a.text.length+' car]':a.note?(' ['+a.note+']'):'')).join('\n');
  if(links.length)attNote+='\nLink rilevati:\n'+links.map(u=>'- '+u).join('\n');
  if(!deep)return{title:'Piano WidowBlue',body:'RICHIESTA\n'+q+attNote+'\n\nMODALIT\u00c0\nStandard\n\nSTACK\n- '+stack.join('\n- ')+'\n\n\u2014 WidowBlue'};
  return{title:'Analisi approfondita \u00b7 '+nAgents+' agenti',body:'DEEP SWEEP\nAgenti: '+nAgents+'\n\nRICHIESTA\n'+q+attNote+'\n\nSTACK\n- '+stack.join('\n- ')+'\n\n\u2014 WidowBlue deep'};
}
const stepsStd=[[0,'Analizzo','Coordinatore'],[3,'Design','Design'],[1,'Frontend','Frontend'],[2,'Backend','Backend'],[4,'Database','Database'],[5,'Media','Media'],[7,'Test','Test'],[8,'Memoria','Memoria'],[9,'Deploy','Deploy'],[10,'Sicurezza','Sicurezza'],[11,'Docs','Documenti']];
const stepsDeep=[[0,'Deep sweep rete','Coordinatore'],[0,'Ricerca multi-fonte','Coordinatore'],[3,'Design system','Design'],[1,'Architettura UI','Frontend'],[2,'Contratti API','Backend'],[4,'Modello dati','Database'],[10,'Threat model','Sicurezza'],[5,'Asset media','Media'],[7,'Piano test','Test'],[8,'Contesto RAG','Memoria'],[9,'Pipeline deploy','Deploy'],[11,'Documentazione','Documenti'],[0,'Sintesi finale','Coordinatore']];
function showPanel(title,body){lastResult=body;document.getElementById('ptitle').textContent=title;document.getElementById('pbody').textContent=body;document.getElementById('panel').style.display='block';document.getElementById('overlay').style.display='block'}
document.getElementById('pclose').onclick=document.getElementById('overlay').onclick=()=>{document.getElementById('panel').style.display='none';document.getElementById('overlay').style.display='none'};
document.getElementById('pcopy').onclick=async()=>{try{await navigator.clipboard.writeText(lastResult);say('Widow Blue','copiato')}catch(e){}};
document.getElementById('pdl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lastResult],{type:'text/plain'}));a.download='widowblue-risposta.txt';a.click()};

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
  if(allMode){say('Coordinatore','TUTTI GLI AGENTI \u2014 '+nAgents+' agenti, ricerca approfondita\u2026');fireAll()}
  else{say('Coordinatore','elaborazione + ricerca modulare\u2026');fire(0)}
  const steps=allMode?stepsDeep:stepsStd;const delay=allMode?420:650;let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){
      const[s,m,r]=steps[i++];fire(s);
      if(allMode){for(let k=0;k<nodes.length;k++)if(nodes[k].par===s||k===s)nodes[k].act=1}
      say(r,m+(allMode?' \u00b7 deep':''));
    }else{
      clearInterval(iv);
      (async()=>{
        let usedApi=false;
        if(window.wbApi&&wbApi.orchestrate){
          try{
            say('Ricerca','multi-provider'+(allMode?' deep':'')+'\u2026');
            const r=await wbApi.orchestrate(prompt,{deep:allMode,search:true,attachments:atts.map(a=>a.name)});
            if(r.ok&&r.data){
              const body=formatSearchAnswer(prompt,nAgents,allMode,r.data.plan,r.data.search);
              const nRes=(r.data.search&&r.data.search.results&&r.data.search.results.length)||0;
              showPanel(nRes?'Risposta · '+nRes+' fonti':'Risposta ricerca',body);
              if(window.wbSaveConversation)wbSaveConversation(prompt,body);
              say('Widow Blue',nRes?('risposta pronta · '+nRes+' fonti'):'ricerca completata (poche fonti)');
              usedApi=true;
            }else if(r.data&&r.data.error){
              say('Ricerca','errore API: '+(r.data.message||r.data.error));
            }
          }catch(e){say('Ricerca','fallback locale · '+String(e.message||e));}
        }
        if(!usedApi){
          try{
            if(window.wbApi&&wbApi.search){
              const sr=await wbApi.search(prompt,allMode);
              if(sr.ok&&sr.data&&sr.data.results){
                const body=formatSearchAnswer(prompt,nAgents,allMode,null,sr.data);
                showPanel('Risposta ricerca',body);
                if(window.wbSaveConversation)wbSaveConversation(prompt,body);
                say('Widow Blue','risposta da /api/search');
                usedApi=true;
              }
            }
          }catch(e2){}
        }
        if(!usedApi){
          const res=analyze(prompt,atts,allMode);
          showPanel(res.title,res.body);
          if(window.wbSaveConversation)wbSaveConversation(prompt,res.body);
          say('Widow Blue','piano locale (API non raggiungibile)');
        }
        running=false;if(go)go.disabled=false;files.length=0;renderChips();
      })();
    }
  },delay);
  document.getElementById('q').value='';
}
document.getElementById('go').onclick=run;
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
