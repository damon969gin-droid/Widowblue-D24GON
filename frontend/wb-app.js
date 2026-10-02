const logEl=document.getElementById('log'),files=[];let lastResult='';
const chatMemory=[];
const MAX_MEMORY=24;
let threadMessages=[];
let running=false;

function pushMemory(role,text,entity){
  chatMemory.push({role,text:String(text||'').slice(0,800),entity:entity||null,at:Date.now()});
  while(chatMemory.length>MAX_MEMORY)chatMemory.shift();
  try{localStorage.setItem('wb_chat_memory',JSON.stringify(chatMemory.slice(-16)))}catch(e){}
}
try{
  const saved=JSON.parse(localStorage.getItem('wb_chat_memory')||'[]');
  if(Array.isArray(saved))saved.forEach(x=>chatMemory.push(x));
}catch(e){}

function say(role,txt,cls){
  const d=document.createElement('div');
  d.className='msg '+(cls||'agent');
  if(cls==='user')d.textContent=txt;
  else d.innerHTML='<i>'+role+'</i> '+String(txt||'');
  logEl.appendChild(d);
  logEl.scrollTop=1e9;
  while(logEl.children.length>80)logEl.removeChild(logEl.firstChild);
}

function esc(s){
  return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function linkHtml(url,label){
  if(!url||!/^https?:\/\//i.test(url)) return esc(label||url||'');
  return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||url)+'</a>';
}

async function shareText(title,text,btn){
  const payload={title:title||'Widow Blue',text:String(text||'').slice(0,8000)};
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare(payload))){
      await navigator.share(payload);
      if(btn){btn.textContent='Condiviso';setTimeout(()=>{btn.textContent=btn.dataset.label||'Condividi'},1500)}
      return;
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
  }
  try{
    await navigator.clipboard.writeText(payload.text);
    if(btn){btn.textContent='Copiato';setTimeout(()=>{btn.textContent=btn.dataset.label||'Condividi'},1800)}
  }catch(e2){
    if(btn)btn.textContent='Errore';
  }
}

function formatThreadPlain(){
  const lines=['══ Widow Blue · conversazione ══',''];
  threadMessages.forEach(m=>{
    if(m.role==='user'){
      lines.push('TU: '+(m.text||m.plain||''));
      lines.push('');
    }else{
      lines.push('WIDOW BLUE:');
      lines.push(m.plain||m.text||'');
      lines.push('');
    }
  });
  lines.push('— https://widowblue-d24gon.damon969gin.workers.dev');
  return lines.join('\n');
}

function flashBtn(btn,okLabel){
  const orig=btn.dataset.label||btn.textContent;
  btn.textContent=okLabel;
  setTimeout(()=>{btn.textContent=orig},1600);
}

function appendReply(body){
  const plain=typeof body==='object'?body.plain:String(body||'');
  const html=typeof body==='object'?body.html:null;
  const imageUrl=typeof body==='object'?body.imageUrl:null;
  lastResult=plain||'';

  const d=document.createElement('div');
  d.className='msg reply';
  const content=document.createElement('div');
  content.className='reply-body';
  if(html)content.innerHTML=html;
  else content.textContent=plain;
  if(imageUrl){
    const img=document.createElement('img');
    img.className='gen-img';
    img.alt='generated';
    img.loading='lazy';
    img.src=imageUrl;
    content.appendChild(img);
  }
  d.appendChild(content);

  const actions=document.createElement('div');
  actions.className='msg-actions';

  const copyBtn=document.createElement('button');
  copyBtn.type='button';
  copyBtn.className='sec';
  copyBtn.dataset.label='Copia';
  copyBtn.textContent='Copia';
  copyBtn.onclick=async()=>{
    try{
      await navigator.clipboard.writeText(plain||content.innerText||'');
      flashBtn(copyBtn,'Copiato');
    }catch(e){copyBtn.textContent='Errore'}
  };

  const shareBtn=document.createElement('button');
  shareBtn.type='button';
  shareBtn.className='sec';
  shareBtn.dataset.label='Condividi';
  shareBtn.textContent='Condividi';
  shareBtn.onclick=()=>shareText('Widow Blue',plain||content.innerText||'',shareBtn);

  actions.appendChild(copyBtn);
  actions.appendChild(shareBtn);
  d.appendChild(actions);

  logEl.appendChild(d);
  logEl.scrollTop=1e9;
  while(logEl.children.length>80)logEl.removeChild(logEl.firstChild);

  threadMessages.push({role:'assistant',plain,html:html||null,imageUrl:imageUrl||null,at:Date.now()});
  return d;
}

function fire(i){if(typeof nodes==='undefined'||i<0||i>=nodes.length)return;const n=nodes[i];n.act=1;pulses.push({from:-1,to:i,t:0});(n.kids||[]).forEach((k,j)=>setTimeout(()=>{if(!nodes[k])return;nodes[k].act=1;pulses.push({from:i,to:k,t:0});},j*12))}
function fireAll(){if(typeof nodes==='undefined')return;for(let i=0;i<nodes.length;i++)nodes[i].act=1;for(let i=0;i<12;i++)setTimeout(()=>fire(i),i*50)}
function renderChips(){const c=document.getElementById('chips');if(!c)return;c.innerHTML='';files.forEach((f,i)=>{const s=document.createElement('span');s.className='chip';s.textContent=f.name+' \u00d7';s.onclick=()=>{files.splice(i,1);renderChips()};c.appendChild(s)})}
document.getElementById('clip').onclick=()=>document.getElementById('file').click();
document.getElementById('file').onchange=async e=>{for(const f of e.target.files){const item={name:f.name,type:f.type||'',size:f.size};if(f.type.startsWith('text/')||/\.(txt|md|json|csv|js|ts|tsx|jsx|py|html|css|yml|yaml|xml|svg)$/i.test(f.name)){try{item.text=(await f.text()).slice(0,80000)}catch(err){item.note='testo'}}else if(f.type.startsWith('image/'))item.note='immagine';else item.note='allegato';files.push(item)}e.target.value='';renderChips()};

const LANGS=[['auto','Auto'],['it-IT','IT'],['en-US','EN'],['en-GB','EN-GB'],['es-ES','ES'],['fr-FR','FR'],['de-DE','DE'],['pt-BR','PT'],['zh-CN','ZH'],['ja-JP','JA'],['ko-KR','KO'],['ar-SA','AR'],['ru-RU','RU'],['hi-IN','HI'],['nl-NL','NL'],['pl-PL','PL'],['tr-TR','TR'],['uk-UA','UK']];
const langSel=document.getElementById('lang');LANGS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;langSel.appendChild(o)});
const bl=navigator.language||'it-IT';const m=LANGS.find(([v])=>v!=='auto'&&bl.toLowerCase().startsWith(v.slice(0,2).toLowerCase()));langSel.value=m?m[0]:'auto';

let rec=null,listening=false;const voiceBtn=document.getElementById('voice');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function currentLang(){const v=langSel.value;return v==='auto'?(navigator.language||'it-IT'):v}
function resolveUiLang(prompt){
  const v=langSel.value;
  if(v&&v!=='auto')return v.slice(0,2).toLowerCase();
  const t=String(prompt||'');
  if(/[àèéìòù]/i.test(t)||/\b(che|cosa|quando|dove|perché|perche|come|chi|genera|immagine)\b/i.test(t))return 'it';
  if(/\b(what|when|where|who|why|how|generate|image)\b/i.test(t))return 'en';
  if(/[ñ¿¡]/i.test(t)||/\b(qué|cuando|donde)\b/i.test(t))return 'es';
  if(/[äöüß]/i.test(t)||/\b(was|wann|wie)\b/i.test(t))return 'de';
  return (navigator.language||'it').slice(0,2).toLowerCase();
}
function labelsFor(lang){
  const L={
    it:{ans:'Risposta',src:'Fonti',plan:'Piano',img:'Immagine'},
    en:{ans:'Answer',src:'Sources',plan:'Plan',img:'Image'},
    es:{ans:'Respuesta',src:'Fuentes',plan:'Plan',img:'Imagen'},
    fr:{ans:'Réponse',src:'Sources',plan:'Plan',img:'Image'},
    de:{ans:'Antwort',src:'Quellen',plan:'Plan',img:'Bild'},
  };
  return L[lang]||L.it;
}
if(SR){rec=new SR();rec.interimResults=true;rec.continuous=false;rec.onresult=e=>{let final='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=t;else document.getElementById('q').placeholder=t}if(final){const q=document.getElementById('q');q.value=(q.value+' '+final).trim()}};rec.onend=()=>{listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce'};rec.onerror=()=>{listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce'}}
voiceBtn.onclick=()=>{if(!rec)return;if(listening){rec.stop();return}rec.lang=currentLang();listening=true;voiceBtn.classList.add('rec');voiceBtn.textContent='Ascolto\u2026';try{rec.start()}catch(e){listening=false;voiceBtn.classList.remove('rec');voiceBtn.textContent='Voce'}};

document.getElementById('allAgents').onclick=function(){allMode=!allMode;this.textContent='Tutti gli agenti: '+(allMode?'s\u00ec':'no');this.classList.toggle('on',allMode);if(allMode&&typeof nodes!=='undefined'){for(let i=0;i<nodes.length;i++)nodes[i].act=Math.max(nodes[i].act,.45)}};

/* Nuova chat: archivia e reset */
document.getElementById('newChat').onclick=function(){
  if(threadMessages.length&&window.wbSaveConversation){
    const firstUser=threadMessages.find(m=>m.role==='user');
    const lastAsst=[...threadMessages].reverse().find(m=>m.role==='assistant');
    wbSaveConversation(
      (firstUser&&(firstUser.text||firstUser.plain))||'Chat',
      (lastAsst&&(lastAsst.plain||lastAsst.text))||'',
      threadMessages.slice()
    );
  }
  logEl.innerHTML='';
  threadMessages=[];
  chatMemory.length=0;
  try{localStorage.removeItem('wb_chat_memory')}catch(e){}
  files.length=0;renderChips();
  document.getElementById('q').value='';
  document.getElementById('q').focus();
};

(function ensureShareThreadBtn(){
  if(document.getElementById('shareThread'))return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.id='shareThread';
  btn.className='toggle';
  btn.dataset.label='Condividi chat';
  btn.textContent='Condividi chat';
  btn.onclick=()=>{
    if(!threadMessages.length)return;
    shareText('Widow Blue · conversazione',formatThreadPlain(),btn);
  };
  const box=document.querySelector('.toggles');
  if(box)box.appendChild(btn);
})();

function isSoftwareRequest(prompt){
  const ql=(prompt||'').toLowerCase();
  return /\b(sito|landing|backend|frontend|database|deploy|software|programma|codice|react|next\.js|flutter|dashboard|crea un sito|costruisci|sviluppa un|app mobile)\b/.test(ql);
}

function formatSearchAnswer(prompt,nAgents,deep,plan,search,conversation,image){
  const results=(search&&search.results)||[];
  const answer=search&&search.answer;
  const soft=isSoftwareRequest(prompt);
  const lang=resolveUiLang(prompt);
  const lb=labelsFor(lang);
  let plain='';
  let html='';
  let imageUrl=null;

  if(image&&image.imageUrl){
    imageUrl=image.imageUrl;
    plain+=(image.message||lb.img)+'\n';
    html+='<div class="ans-h">'+esc(lb.img)+'</div>';
    html+='<p class="ans-text">'+esc(image.message||lb.img)+'</p>';
    return { plain, html, imageUrl, entity: null };
  }

  plain+=lb.ans.toUpperCase()+'\n';
  html+='<div class="ans-h">'+esc(lb.ans)+'</div>';
  if(answer&&answer.text){
    plain+=answer.text+'\n';
    html+='<p class="ans-text">'+esc(answer.text)+'</p>';
  }else if(results.length){
    const best=results.find(r=>r.kind==='summary'&&r.snippet)||results[0];
    const t=(best.snippet||'').slice(0,900);
    plain+=t+'\n';
    html+='<p class="ans-text">'+esc(t)+'</p>';
  }else{
    plain+='—\n';
    html+='<p class="ans-text dim">—</p>';
  }

  const sources=results.filter(r=>r.url).slice(0,5);
  if(sources.length){
    plain+='\n'+lb.src.toUpperCase()+'\n';
    html+='<div class="ans-h">'+esc(lb.src)+'</div><ol class="ans-src">';
    sources.forEach((r,i)=>{
      const title=r.title||r.url;
      plain+=(i+1)+'. '+title+'\n   '+r.url+'\n';
      html+='<li><span class="prov">['+esc(r.provider||'')+']</span> '+linkHtml(r.url,title)+'</li>';
    });
    html+='</ol>';
  }

  if(soft&&plan&&plan.stack&&plan.stack.length){
    plain+='\n'+lb.plan.toUpperCase()+'\n'+plan.stack.join(' · ')+'\n';
    html+='<div class="ans-h">'+esc(lb.plan)+'</div><p class="ans-text">'+esc(plan.stack.join(' · '))+'</p>';
  }

  const entity=(conversation&&conversation.entity)||(answer&&answer.title)||null;
  return { plain, html, imageUrl, entity: entity ? String(entity).replace(/\s*\([A-Z]{2}\)\s*$/i,'').trim() : null };
}

function analyze(q){
  return{plain:'—',html:'<p class="ans-text dim">—</p>',entity:null};
}

const stepsStd=[[0],[1],[0]];
const stepsDeep=[[0],[0],[0]];

window.wbLoadConversation=function(it){
  if(!it)return;
  logEl.innerHTML='';
  threadMessages=[];
  chatMemory.length=0;
  const msgs=Array.isArray(it.messages)?it.messages:null;
  if(msgs&&msgs.length){
    msgs.forEach(m=>{
      if(m.role==='user'){
        const ud=document.createElement('div');
        ud.className='msg user';
        ud.textContent=m.text||m.plain||'';
        logEl.appendChild(ud);
        pushMemory('user',m.text||m.plain||'',null);
        threadMessages.push({role:'user',text:m.text||m.plain||'',at:m.at||Date.now()});
      }else{
        appendReply({plain:m.plain||m.text||'',html:m.html||null,imageUrl:m.imageUrl||null});
        pushMemory('assistant',m.plain||m.text||'',m.entity||null);
      }
    });
  }else{
    if(it.prompt){
      const ud=document.createElement('div');
      ud.className='msg user';
      ud.textContent=it.prompt;
      logEl.appendChild(ud);
      pushMemory('user',it.prompt,null);
      threadMessages.push({role:'user',text:it.prompt,at:it.ts||Date.now()});
    }
    if(it.result){
      appendReply({plain:it.result,html:null});
      pushMemory('assistant',it.result,null);
    }
  }
  logEl.scrollTop=1e9;
  document.getElementById('q').focus();
};

function run(){
  if(running)return;
  const q=document.getElementById('q').value.trim();
  if(!q&&!files.length)return;
  running=true;const go=document.getElementById('go');if(go)go.disabled=true;
  const prompt=q||'(…)';const atts=files.slice();
  pushMemory('user',prompt,null);
  threadMessages.push({role:'user',text:prompt,at:Date.now()});

  const userDiv=document.createElement('div');userDiv.className='msg user';userDiv.textContent=prompt;
  if(atts.length){const ad=document.createElement('div');ad.className='atts';ad.textContent=atts.map(a=>a.name).join(', ');userDiv.appendChild(ad)}
  logEl.appendChild(userDiv);logEl.scrollTop=1e9;

  const hist=chatMemory.slice(-12).map(h=>({role:h.role,text:h.text,entity:h.entity}));
  const uiLang=resolveUiLang(prompt);
  if(typeof allMode!=='undefined'&&allMode)fireAll();else fire(0);

  const steps=(typeof allMode!=='undefined'&&allMode)?stepsDeep:stepsStd;const delay=300;let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){
      const[s]=steps[i++];fire(s);
    }else{
      clearInterval(iv);
      (async()=>{
        let usedApi=false;
        let body=null;
        if(window.wbApi&&wbApi.orchestrate){
          try{
            const r=await wbApi.orchestrate(prompt,{deep:!!(typeof allMode!=='undefined'&&allMode),search:true,attachments:atts.map(a=>a.name),history:hist,lang:uiLang});
            if(r.ok&&r.data){
              const img=r.data.image||(r.data.search&&r.data.search.image)||null;
              body=formatSearchAnswer(prompt,(typeof nodes!=='undefined'?nodes.length:0),!!(typeof allMode!=='undefined'&&allMode),r.data.plan,r.data.search,r.data.conversation,img);
              const ent=(r.data.conversation&&r.data.conversation.entity)||body.entity;
              appendReply(body);
              pushMemory('assistant',body.plain||'',ent);
              usedApi=true;
            }else if(r.data&&r.data.error){
              appendReply({plain:String(r.data.message||r.data.error),html:null});
            }
          }catch(e){
            appendReply({plain:String(e.message||e),html:null});
          }
        }
        if(!usedApi&&window.wbApi&&wbApi.search){
          try{
            const sr=await wbApi.search(prompt,!!(typeof allMode!=='undefined'&&allMode),hist,uiLang);
            if(sr.ok&&sr.data){
              body=formatSearchAnswer(prompt,0,false,null,sr.data,null,sr.data.image||null);
              appendReply(body);
              pushMemory('assistant',body.plain||'',body.entity);
              usedApi=true;
            }
          }catch(e2){}
        }
        if(!usedApi){
          body=analyze(prompt);
          appendReply(body);
          pushMemory('assistant',body.plain||'',null);
        }
        if(window.wbSaveConversation){
          wbSaveConversation(prompt,body&&body.plain||'',threadMessages.slice());
        }
        running=false;if(go)go.disabled=false;files.length=0;renderChips();
        logEl.scrollTop=1e9;
      })();
    }
  },delay);
  document.getElementById('q').value='';
}
document.getElementById('go').onclick=run;
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
