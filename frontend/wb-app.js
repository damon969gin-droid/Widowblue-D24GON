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
document.getElementById('allAgents').onclick=function(){allMode=!allMode;this.textContent='Tutti gli agenti: '+(allMode?'s\u00ec':'no');this.classList.toggle('on',allMode);if(allMode){for(let i=0;i<nodes.length;i++)nodes[i].act=Math.max(nodes[i].act,.45);say('Rete','TUTTI GLI AGENTI ON \u00b7 '+nodes.length+' nodi')}else say('Rete','modalit\u00e0 standard')};

function isSoftwareRequest(prompt){
  const ql=(prompt||'').toLowerCase();
  return /\b(sito|landing|backend|frontend|database|deploy|software|programma|codice|react|next\.js|flutter|dashboard|crea un|costruisci|sviluppa un|app mobile)\b/.test(ql);
}

function esc(s){
  return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function linkHtml(url,label){
  if(!url||!/^https?:\/\//i.test(url)) return esc(label||url||'');
  return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||url)+'</a>';
}

/** Risposta pulita: solo risposta + fonti cliccabili */
function formatSearchAnswer(prompt,nAgents,deep,plan,search){
  const results=(search&&search.results)||[];
  const answer=search&&search.answer;
  const soft=isSoftwareRequest(prompt);

  let plain='';
  let html='';

  // --- RISPOSTA ---
  plain+='RISPOSTA\n';
  html+='<div class="ans-block"><div class="ans-h">Risposta</div>';
  if(answer&&answer.text){
    plain+=answer.text+'\n';
    html+='<p class="ans-text">'+esc(answer.text)+'</p>';
  }else if(results.length){
    const best=results.find(r=>r.kind==='summary'&&r.snippet)||results[0];
    const t=(best.snippet||'').slice(0,400);
    plain+=t+'\n';
    html+='<p class="ans-text">'+esc(t)+'</p>';
  }else{
    plain+='Nessuna risposta trovata nelle fonti disponibili.\n';
    html+='<p class="ans-text dim">Nessuna risposta trovata.</p>';
  }
  html+='</div>';

  // --- FONTI (max 5, link cliccabili) ---
  const sources=results.filter(r=>r.url).slice(0,5);
  if(sources.length){
    plain+='\nFONTI\n';
    html+='<div class="ans-block"><div class="ans-h">Fonti</div><ol class="ans-src">';
    sources.forEach((r,i)=>{
      const title=r.title||r.url;
      plain+=(i+1)+'. '+title+'\n   '+r.url+'\n';
      html+='<li><span class="prov">['+esc(r.provider||'')+']</span> '+linkHtml(r.url,title)+'</li>';
    });
    html+='</ol></div>';
  }

  // Piano solo se richiesta software esplicita
  if(soft&&plan&&plan.stack&&plan.stack.length){
    plain+='\nPIANO PROGETTO\nStack: '+plan.stack.join(' · ')+'\n';
    html+='<div class="ans-block"><div class="ans-h">Piano progetto</div><p>'+esc(plan.stack.join(' · '))+'</p></div>';
  }

  return { plain, html };
}

function analyze(q,atts,deep){
  const ql=q.toLowerCase();
  if(!isSoftwareRequest(q)){
    return{title:'Risposta',body:{plain:'Nessuna fonte live disponibile. Riprova o configura Tavily/Serper.',html:'<p class="ans-text dim">Nessuna fonte live disponibile.</p>'}};
  }
  const stack=['Next.js + Tailwind','Cloudflare Workers'];
  const plain='RICHIESTA\n'+q+'\n\nSTACK\n- '+stack.join('\n- ');
  return{title:'Piano',body:{plain,html:'<pre>'+esc(plain)+'</pre>'}};
}
const stepsStd=[[0,'Analizzo','Coordinatore'],[1,'Ricerca','Ricerca'],[0,'Sintesi','Coordinatore']];
const stepsDeep=[[0,'Deep sweep','Coordinatore'],[0,'Ricerca multi-fonte','Ricerca'],[0,'Sintesi','Coordinatore']];

function showPanel(title,body){
  const plain=typeof body==='object'?body.plain:body;
  const html=typeof body==='object'?body.html:null;
  lastResult=plain||'';
  document.getElementById('ptitle').textContent=title;
  const el=document.getElementById('pbody');
  if(html){el.innerHTML=html;el.classList.add('rich')}else{el.textContent=plain;el.classList.remove('rich')}
  document.getElementById('panel').style.display='block';
  document.getElementById('overlay').style.display='block';
}
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
  if(allMode){say('Coordinatore','ricerca approfondita\u2026');fireAll()}
  else{say('Coordinatore','ricerca\u2026');fire(0)}
  const steps=allMode?stepsDeep:stepsStd;const delay=allMode?350:500;let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){
      const[s,m,r]=steps[i++];fire(s);
      say(r,m);
    }else{
      clearInterval(iv);
      (async()=>{
        let usedApi=false;
        if(window.wbApi&&wbApi.orchestrate){
          try{
            say('Ricerca','fonti live\u2026');
            const r=await wbApi.orchestrate(prompt,{deep:allMode,search:true,attachments:atts.map(a=>a.name)});
            if(r.ok&&r.data){
              const body=formatSearchAnswer(prompt,nAgents,allMode,r.data.plan,r.data.search);
              const nRes=(r.data.search&&r.data.search.results&&r.data.search.results.length)||0;
              showPanel(nRes?'Risposta':'Risposta',body);
              if(window.wbSaveConversation)wbSaveConversation(prompt,body.plain||body);
              say('Widow Blue',nRes?'pronta':'completata');
              usedApi=true;
            }else if(r.data&&r.data.error){
              say('Ricerca','errore: '+(r.data.message||r.data.error));
            }
          }catch(e){say('Ricerca','fallback · '+String(e.message||e));}
        }
        if(!usedApi){
          try{
            if(window.wbApi&&wbApi.search){
              const sr=await wbApi.search(prompt,allMode);
              if(sr.ok&&sr.data){
                const body=formatSearchAnswer(prompt,nAgents,allMode,null,sr.data);
                showPanel('Risposta',body);
                if(window.wbSaveConversation)wbSaveConversation(prompt,body.plain||body);
                say('Widow Blue','pronta');
                usedApi=true;
              }
            }
          }catch(e2){}
        }
        if(!usedApi){
          const res=analyze(prompt,atts,allMode);
          showPanel(res.title,res.body);
          if(window.wbSaveConversation)wbSaveConversation(prompt,res.body.plain||res.body);
          say('Widow Blue','locale');
        }
        running=false;if(go)go.disabled=false;files.length=0;renderChips();
      })();
    }
  },delay);
  document.getElementById('q').value='';
}
document.getElementById('go').onclick=run;
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
