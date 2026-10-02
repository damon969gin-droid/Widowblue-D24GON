/* WidowBlue app – chat, voice, upload, agents, image, history, multi-lang */
const logEl=document.getElementById('log'),files=[];
function scrollLog(){
  if(!logEl)return;
  requestAnimationFrame(()=>{
    logEl.scrollTop=logEl.scrollHeight;
    const last=logEl.lastElementChild;
    if(last&&last.scrollIntoView)try{last.scrollIntoView({block:'end',behavior:'smooth'})}catch(e){}
  });
}
function updateLogTouchMode(){
  if(!logEl)return;
  const has=logEl.children.length>0;
  logEl.classList.toggle('has-msgs',has);
  logEl.classList.toggle('empty',!has);
}
let lastResult='';
const chatMemory=[];
const MAX_MEMORY=24;
let threadMessages=[];
let appBusy=false;

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
  if(!logEl)return;
  const d=document.createElement('div');
  d.className='msg '+(cls||'agent');
  if(cls==='user')d.textContent=txt;
  else d.innerHTML='<i>'+role+'</i> '+String(txt||'');
  logEl.appendChild(d);
  updateLogTouchMode();
  scrollLog();
  while(logEl.children.length>80)logEl.removeChild(logEl.firstChild);
}

function esc(s){return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}

function linkHtml(url,label){
  if(!url||!/^https?:\/\//i.test(url)) return esc(label||url||'');
  return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||url)+'</a>';
}

function cleanUserAnswer(text){
  let t=String(text||'');
  t=t.replace(/\b(extractive[- ]?grounded|workers-ai-grounded|perplexity-grounded|deep-rag|grounded-empty)\b/gi,'');
  t=t.replace(/\b(RAG|Grounded\s*·[^\n]*|Sintesi Tavily|Sintesi Serper)\b/gi,'');
  t=t.replace(/\b(provider|generator|chunks?|contextChars|webLive|policy)\s*[:=][^\n]*/gi,'');
  t=t.replace(/\[\d+\]\s*/g,'');
  t=t.replace(/\s{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  return t;
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
  const lines=['══ Widow Blue · chat ══'];
  threadMessages.forEach(m=>{
    if(m.role==='user')lines.push('Tu: '+m.text);
    else lines.push('WB: '+(m.plain||m.text||'').slice(0,2000));
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
  if(!logEl)return;
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
    }catch(e){flashBtn(copyBtn,'Errore')}
  };
  const shareBtn=document.createElement('button');
  shareBtn.type='button';
  shareBtn.dataset.label='Condividi';
  shareBtn.className='sec';
  shareBtn.textContent='Condividi';
  shareBtn.onclick=()=>shareText('Widow Blue',plain||content.innerText||'',shareBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(shareBtn);
  d.appendChild(actions);
  logEl.appendChild(d);
  updateLogTouchMode();
  scrollLog();
  threadMessages.push({role:'assistant',plain:plain,html:html,imageUrl:imageUrl,at:Date.now()});
  try{localStorage.setItem('wb_thread',JSON.stringify(threadMessages.slice(-40)))}catch(e){}
}

function formatSearchAnswer(data){
  const ans=data&&data.answer;
  let text=ans&&ans.text?cleanUserAnswer(ans.text):'';
  const results=Array.isArray(data.results)?data.results:[];
  if(!text&&results[0]&&results[0].snippet)text=cleanUserAnswer(results[0].snippet);
  if(!text)text='Non ho trovato una risposta chiara. Prova a riformulare.';
  const sources=[];
  const seen=new Set();
  for(const r of results){
    if(!r||!r.url||seen.has(r.url))continue;
    seen.add(r.url);
    sources.push(r);
    if(sources.length>=6)break;
  }
  let html='<div class="ans-h">Risposta</div><div class="ans-text">'+esc(text)+'</div>';
  if(sources.length){
    html+='<div class="ans-h">Fonti</div><ol class="ans-src">';
    sources.forEach(r=>{
      html+='<li><span class="prov">['+esc(r.provider||'')+']</span> '+linkHtml(r.url,r.title||r.url)+'</li>';
    });
    html+='</ol>';
  }
  const plain='Risposta\n'+text+(sources.length?'\n\nFonti:\n'+sources.map((r,i)=>(i+1)+'. '+(r.title||'')+'\n'+(r.url||'')).join('\n'):'');
  return {html,plain,imageUrl:(data.image&&data.image.url)||data.imageUrl||null};
}

const LANGS=[
  ['auto','AUTO'],
  ['it','IT'],['en','EN'],['es','ES'],['fr','FR'],['de','DE'],['pt','PT'],
  ['ja','JA'],['zh','ZH'],['ko','KO'],['ar','AR'],['ru','RU'],['hi','HI'],['tr','TR'],['nl','NL'],['pl','PL']
];
function detectInputLang(text){
  const t=String(text||'');
  if(/[\u3040-\u30ff]/.test(t))return 'ja';
  if(/[\u4e00-\u9fff]/.test(t))return 'zh';
  if(/[\uac00-\ud7af]/.test(t))return 'ko';
  if(/[\u0600-\u06ff]/.test(t))return 'ar';
  if(/[\u0400-\u04ff]/.test(t))return 'ru';
  if(/[àèéìòù]/i.test(t)||/\b(che|cosa|quando|dove|perché|ciao)\b/i.test(t))return 'it';
  if(/[äöüß]/i.test(t))return 'de';
  if(/[ñ¿¡]/i.test(t))return 'es';
  if(/\b(what|when|where|the|and)\b/i.test(t))return 'en';
  return 'en';
}
async function translateClient(text, from, to){
  const q=String(text||'').trim().slice(0,450);
  if(!q||!to||to==='auto'||from===to)return q;
  try{
    const url='https://api.mymemory.translated.net/get?q='+encodeURIComponent(q)+'&langpair='+encodeURIComponent((from||'autodetect')+'|'+to);
    const res=await fetch(url);
    if(!res.ok)return q;
    const data=await res.json();
    const out=(data&&data.responseData&&data.responseData.translatedText)||'';
    if(!out||/INVALID|QUERY LENGTH|WARNING/i.test(out))return q;
    return String(out).trim();
  }catch(e){return q}
}
const langSel=document.getElementById('lang');
if(langSel){
  LANGS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;langSel.appendChild(o)});
  try{const sl=localStorage.getItem('wb_lang');if(sl)langSel.value=sl}catch(e){}
  langSel.onchange=()=>{try{localStorage.setItem('wb_lang',langSel.value)}catch(e){}};
}
function currentLang(){return (langSel&&langSel.value)||'auto'}

const qEl=document.getElementById('q');
const goBtn=document.getElementById('go');
const voiceBtn=document.getElementById('voice');
const clipBtn=document.getElementById('clip');
const fileInput=document.getElementById('file');
const allAgentsBtn=document.getElementById('allAgents');
const newChatBtn=document.getElementById('newChat');
const shareThreadBtn=document.getElementById('shareThread');
let allAgents=false;
try{allAgents=localStorage.getItem('wb_all_agents')==='1'}catch(e){}

function applyAllAgentsVisual(on){
  window.allMode=!!on;
  if(window.WBNet&&typeof window.WBNet.setAllMode==='function'){
    window.WBNet.setAllMode(!!on);
  }else if(window.WBNet){
    window.WBNet.allMode=!!on;
    window.allMode=!!on;
    if(!on){
      window.running=false;
      if(window.WBNet.dim)window.WBNet.dim();
    }
  }
}
if(allAgentsBtn){
  allAgentsBtn.textContent='Tutti gli agenti: '+(allAgents?'sì':'no');
  if(allAgents)allAgentsBtn.classList.add('on');
  allAgentsBtn.onclick=()=>{
    allAgents=!allAgents;
    allAgentsBtn.textContent='Tutti gli agenti: '+(allAgents?'sì':'no');
    allAgentsBtn.classList.toggle('on',allAgents);
    try{localStorage.setItem('wb_all_agents',allAgents?'1':'0')}catch(e){}
    applyAllAgentsVisual(allAgents);
  };
}
setTimeout(()=>applyAllAgentsVisual(allAgents),0);
applyAllAgentsVisual(allAgents);

if(clipBtn&&fileInput){
  clipBtn.onclick=()=>fileInput.click();
  fileInput.onchange=()=>{
    for(const f of fileInput.files||[])files.push({name:f.name,size:f.size,type:f.type,file:f});
    const chips=document.getElementById('chips');
    if(chips){
      chips.innerHTML='';
      files.forEach((f,i)=>{
        const c=document.createElement('span');
        c.className='chip';
        c.textContent=f.name+' ×';
        c.onclick=()=>{files.splice(i,1);fileInput.value='';clipBtn.click();clipBtn.blur();fileInput.onchange()};
        chips.appendChild(c);
      });
    }
  };
}

let recognition=null;
if(voiceBtn){
  voiceBtn.onclick=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){say('Sistema','Riconoscimento vocale non supportato');return}
    if(recognition){try{recognition.stop()}catch(e){}recognition=null;voiceBtn.classList.remove('rec');return}
    recognition=new SR();
    const vl=currentLang();
    const voiceMap={it:'it-IT',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-PT',ja:'ja-JP',zh:'zh-CN',ko:'ko-KR',ar:'ar-SA',ru:'ru-RU'};
    recognition.lang=voiceMap[vl]||(vl==='auto'?'it-IT':vl);
    recognition.interimResults=false;
    recognition.onresult=(ev)=>{
      const t=ev.results[0][0].transcript;
      if(qEl)qEl.value=(qEl.value?qEl.value+' ':'')+t;
    };
    recognition.onerror=()=>{voiceBtn.classList.remove('rec');recognition=null};
    recognition.onend=()=>{voiceBtn.classList.remove('rec');recognition=null};
    voiceBtn.classList.add('rec');
    recognition.start();
  };
}

function archiveCurrentThread(){
  if(!threadMessages.length)return;
  try{
    const hist=JSON.parse(localStorage.getItem('wb_history')||'[]');
    hist.unshift({id:Date.now(),at:Date.now(),preview:(threadMessages.find(m=>m.role==='user')||{}).text||'Chat',messages:threadMessages.slice()});
    localStorage.setItem('wb_history',JSON.stringify(hist.slice(0,30)));
  }catch(e){}
}

if(newChatBtn){
  newChatBtn.onclick=()=>{
    archiveCurrentThread();
    threadMessages=[];
    chatMemory.length=0;
    try{
      localStorage.removeItem('wb_thread');
      localStorage.removeItem('wb_chat_memory');
    }catch(e){}
    if(logEl){logEl.innerHTML='';updateLogTouchMode()}
    files.length=0;
    const chips=document.getElementById('chips');
    if(chips)chips.innerHTML='';
  };
}

if(shareThreadBtn){
  shareThreadBtn.onclick=()=>shareText('Widow Blue · chat',formatThreadPlain(),shareThreadBtn);
}

try{
  const th=JSON.parse(localStorage.getItem('wb_thread')||'[]');
  if(Array.isArray(th)&&th.length){
    threadMessages=th;
    th.forEach(m=>{
      if(m.role==='user'){
        const ud=document.createElement('div');
        ud.className='msg user';
        ud.textContent=m.text||'';
        if(logEl)logEl.appendChild(ud);
      }else{
        appendReply({plain:m.plain||m.text||'',html:m.html||null,imageUrl:m.imageUrl||null});
      }
    });
    updateLogTouchMode();
    scrollLog();
  }
}catch(e){}

async function sendQuery(){
  if(appBusy)return;
  const text=(qEl&&qEl.value||'').trim();
  const atts=files.slice();
  if(!text&&!atts.length)return;
  appBusy=true;
  if(goBtn)goBtn.disabled=true;
  if(qEl)qEl.value='';
  files.length=0;
  const chips=document.getElementById('chips');
  if(chips)chips.innerHTML='';

  const langSelVal=currentLang();
  const detected=detectInputLang(text||'');
  let displayText=text||'(allegati)';
  let queryForApi=text||'';
  if(langSelVal&&langSelVal!=='auto'&&text&&detected!==langSelVal){
    const tr=await translateClient(text, detected, langSelVal);
    if(tr){displayText=tr;queryForApi=tr}
  }
  const userDiv=document.createElement('div');
  userDiv.className='msg user';
  userDiv.textContent=displayText;
  if(text&&displayText!==text){
    const note=document.createElement('div');
    note.className='atts';
    note.textContent='← '+text;
    userDiv.appendChild(note);
  }
  if(atts.length){const ad=document.createElement('div');ad.className='atts';ad.textContent=atts.map(a=>a.name).join(', ');userDiv.appendChild(ad)}
  if(logEl){logEl.appendChild(userDiv);updateLogTouchMode();scrollLog()}
  if(window.WBNet&&window.WBNet.setRunning){
    window.WBNet.setRunning(true);
  }else if(window.WBNet&&window.WBNet.ignite){
    window.running=true;
    window.WBNet.ignite();
  }
  threadMessages.push({role:'user',text:displayText,original:text,at:Date.now()});
  pushMemory('user',displayText);

  const lang=langSelVal==='auto'?detected:langSelVal;
  const history=chatMemory.slice(-12).map(m=>({role:m.role,text:m.text,entity:m.entity}));
  try{
    if(typeof WB!=='undefined'&&WB.api){
      const body={
        query:queryForApi||text,
        prompt:queryForApi||text,
        deep:true,
        lang,
        history,
        allAgents:allAgents,
        attachments:atts.map(a=>({name:a.name,type:a.type,size:a.size}))
      };
      let data=null;
      try{
        data=await WB.api('/api/search',{method:'POST',body:JSON.stringify(body)});
      }catch(e1){
        try{
          data=await WB.api('/api/orchestrate',{method:'POST',body:JSON.stringify(body)});
          if(data&&data.search)data=data.search;
        }catch(e2){data=null}
      }
      if(data&&data.ok!==false){
        if(data.mode==='image'||(data.image&&data.image.url)){
          const msg=(data.answer&&data.answer.text)||(data.image&&data.image.message)||'Immagine generata.';
          const url=(data.image&&(data.image.url||data.image.imageUrl))||data.imageUrl;
          appendReply({plain:msg,html:'<div class="ans-text">'+esc(msg)+'</div>',imageUrl:url});
          pushMemory('assistant',msg);
        }else{
          const formatted=formatSearchAnswer(data);
          appendReply(formatted);
          pushMemory('assistant',formatted.plain,data.contextEntity||null);
        }
      }else{
        appendReply({plain:'Non è stato possibile completare la ricerca. Riprova.',html:null});
      }
    }else{
      appendReply({plain:'API non disponibile.',html:null});
    }
  }catch(err){
    appendReply({plain:'Errore di rete. Riprova.',html:null});
  }
  if(window.WBNet&&window.WBNet.setRunning){
    window.WBNet.setRunning(false);
  }else{
    window.running=false;
  }
  appBusy=false;
  if(goBtn)goBtn.disabled=false;
  scrollLog();
}

if(goBtn)goBtn.onclick=sendQuery;
if(qEl)qEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQuery()}});
updateLogTouchMode();
