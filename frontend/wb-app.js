/* WidowBlue app – chat, voice, upload, agents, image, history, multi-lang */

const logEl=document.getElementById('log');
const qEl=document.getElementById('q');
const goBtn=document.getElementById('go');
const clipBtn=document.getElementById('clip');
const fileInput=document.getElementById('file');
const voiceBtn=document.getElementById('voice');
const chipsEl=document.getElementById('chips');
const newChatBtn=document.getElementById('newChat');
const shareThreadBtn=document.getElementById('shareThread');
const allAgentsBtn=document.getElementById('allAgents');

let files=[];
let appBusy=false;
let lastResult='';
let threadMessages=[];
let chatMemory=[];
let allAgents=false;
try{allAgents=localStorage.getItem('wb_all_agents')==='1'}catch(e){}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function updateLogTouchMode(){
  if(!logEl)return;
  const has=logEl.querySelector('.msg');
  if(has){logEl.classList.add('has-msgs');logEl.classList.remove('empty')}
  else{logEl.classList.add('empty');logEl.classList.remove('has-msgs')}
}
function scrollLog(){if(logEl)logEl.scrollTop=logEl.scrollHeight}

function pushMemory(role,text,entity,topic){
  chatMemory.push({role,text:String(text||'').slice(0,2000),entity:entity||null,topic:topic||null,at:Date.now()});
  if(chatMemory.length>40)chatMemory=chatMemory.slice(-40);
}

function formatSearchAnswer(data){
  const text=(data.answer&&data.answer.text)||data.text||'';
  const sources=(data.rag&&data.rag.sources)||data.results||[];
  let html='<div class="ans-text">'+esc(text)+'</div>';
  if(sources&&sources.length){
    html+='<div class="ans-h">Fonti</div><ol class="ans-src">';
    sources.slice(0,6).forEach(r=>{
      const t=esc(r.title||r.url||''); const u=esc(r.url||'#');
      const p=r.provider?(' <span class="prov">'+esc(r.provider)+'</span>'):'';
      html+='<li><a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>'+p+'</li>';
    });
    html+='</ol>';
  }
  const plain='Risposta\n'+text+(sources.length?'\n\nFonti:\n'+sources.map((r,i)=>(i+1)+'. '+(r.title||'')+'\n'+(r.url||'')).join('\n'):'');
  return {html,plain,imageUrl:(data.image&&data.image.url)||data.imageUrl||null};
}

function appendReply(body){
  const html=typeof body==='object'?body.html:null;
  const plain=typeof body==='object'?body.plain:String(body||'');
  const imageUrl=typeof body==='object'?body.imageUrl:null;
  lastResult=plain||'';
  const d=document.createElement('div');
  d.className='msg reply';
  const content=document.createElement('div');
  content.className='reply-body';
  if(html) content.innerHTML=html;
  else content.textContent=plain;
  d.appendChild(content);
  if(imageUrl){
    const img=document.createElement('img');
    img.className='gen-img'; img.src=imageUrl; img.alt='generated';
    d.appendChild(img);
  }
  const actions=document.createElement('div');
  actions.className='msg-actions';
  const copyBtn=document.createElement('button');
  copyBtn.type='button'; copyBtn.className='sec'; copyBtn.textContent='Copia';
  copyBtn.onclick=async()=>{
    try{
      await navigator.clipboard.writeText(plain||content.innerText||'');
      copyBtn.textContent='Copiato';
      setTimeout(()=>copyBtn.textContent='Copia',1200);
    }catch(e){}
  };
  const shareBtn=document.createElement('button');
  shareBtn.type='button'; shareBtn.className='sec'; shareBtn.textContent='Condividi';
  shareBtn.onclick=()=>shareText('Widow Blue',plain||content.innerText||'',shareBtn);
  actions.appendChild(copyBtn); actions.appendChild(shareBtn);
  d.appendChild(actions);
  if(logEl){logEl.appendChild(d);updateLogTouchMode();scrollLog()}
  threadMessages.push({role:'assistant',plain:plain,html:html,imageUrl:imageUrl,at:Date.now()});
}

async function shareText(title,text,btn){
  try{
    if(navigator.share){await navigator.share({title,text});return}
    await navigator.clipboard.writeText(text);
    if(btn){btn.textContent='Copiato'; setTimeout(()=>btn.textContent='Condividi',1200)}
  }catch(e){}
}

const LANGS=[['it','IT'],['en','EN'],['es','ES'],['fr','FR'],['de','DE'],['pt','PT'],
  ['ja','JA'],['zh','ZH'],['ko','KO'],['ar','AR'],['ru','RU'],['hi','HI'],['tr','TR'],['nl','NL'],['pl','PL'],['auto','AUTO']];

function detectInputLang(text){
  const t=String(text||'');
  if(!t.trim())return 'it';
  if(/[\u3040-\u30ff]/.test(t))return 'ja';
  if(/[\u4e00-\u9fff]/.test(t))return 'zh';
  if(/[\uac00-\ud7af]/.test(t))return 'ko';
  if(/[\u0600-\u06ff]/.test(t))return 'ar';
  if(/[\u0900-\u097f]/.test(t))return 'hi';
  if(/[\u0400-\u04ff]/.test(t))return /[іїєґ]/i.test(t)?'uk':'ru';
  if(/[ąćęłńóśźż]/i.test(t)||/\b(co|jak|gdzie|jest|nie|czy|oraz)\b/i.test(t))return 'pl';
  if(/[äöüß]/i.test(t)||/\b(was|wann|wie|nicht|der|die|das)\b/i.test(t))return 'de';
  if(/[ñ¿¡]/i.test(t)||/\b(qué|cuando|hola|está)\b/i.test(t))return 'es';
  if(/\b(quoi|quand|bonjour|avec|pour)\b/i.test(t))return 'fr';
  if(/\b(o que|quando|obrigado|também)\b/i.test(t))return 'pt';
  if(/\b(wat|hoe|waar|niet|het)\b/i.test(t))return 'nl';
  if(/\b(ne|ve|bir|için|nedir)\b/i.test(t))return 'tr';
  const it=(t.match(/\b(il|la|di|che|cosa|quando|dove|perché|ciao|sono|per|con)\b/gi)||[]).length;
  const en=(t.match(/\b(the|and|with|what|when|where|is|are|this|that)\b/gi)||[]).length;
  if(/[àèéìòù]/i.test(t)||it>=1)return 'it';
  if(en>=2)return 'en';
  return 'it';
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

async function clientForceLang(text, target){
  const t=String(text||'').trim();
  if(!t||!target||target==='auto') return t;
  try{
    const parts=[];
    let rest=t;
    while(rest.length){
      let cut=Math.min(420,rest.length);
      if(cut<rest.length){const sp=rest.lastIndexOf('. ',cut);const sp2=rest.lastIndexOf(' ',cut);if(sp>100)cut=sp+1;else if(sp2>100)cut=sp2;}
      parts.push(rest.slice(0,cut).trim());
      rest=rest.slice(cut).trimStart();
      if(parts.length>=8){if(rest)parts[parts.length-1]+=' '+rest;break;}
    }
    const out=[];
    for(const p of parts){
      const tr=await translateClient(p, 'autodetect', target);
      out.push(tr||p);
    }
    return out.join(' ').replace(/\s{2,}/g,' ').trim()||t;
  }catch(e){return t;}
}

const langSel=document.getElementById('lang');
if(langSel){
  LANGS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;langSel.appendChild(o)});
  try{const sl=localStorage.getItem('wb_lang');langSel.value=sl||'it'}catch(e){try{langSel.value='it'}catch(_){}}
  langSel.onchange=()=>{try{localStorage.setItem('wb_lang',langSel.value)}catch(e){}};
}
function currentLang(){return (langSel&&langSel.value)||'it'}

function applyAllAgentsVisual(on){
  try{
    window.allMode=!!on;
    if(window.WBNet&&typeof window.WBNet.setAllMode==='function') window.WBNet.setAllMode(!!on);
    else { window.WBNet=window.WBNet||{}; window.WBNet.allMode=!!on; window.allMode=!!on; }
  }catch(e){}
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
    files=Array.from(fileInput.files||[]);
    if(chipsEl){
      chipsEl.innerHTML='';
      files.forEach((f,i)=>{
        const c=document.createElement('span');c.className='chip';c.textContent=f.name;
        c.onclick=()=>{files.splice(i,1);fileInput.value='';fileInput.onchange()};
        chipsEl.appendChild(c);
      });
    }
  };
}

if(voiceBtn&&(window.SpeechRecognition||window.webkitSpeechRecognition)){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  voiceBtn.onclick=()=>{
    if(!recognition){
      recognition=new SR();
      recognition.continuous=false; recognition.interimResults=false;
      const vl=currentLang();
      const voiceMap={it:'it-IT',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-PT',pl:'pl-PL',nl:'nl-NL'};
      recognition.lang=voiceMap[vl]||(vl==='auto'?'it-IT':vl);
      recognition.onresult=(ev)=>{const t=ev.results[0][0].transcript; if(qEl)qEl.value=t; voiceBtn.classList.remove('rec');};
      recognition.onerror=()=>voiceBtn.classList.remove('rec');
      recognition.onend=()=>voiceBtn.classList.remove('rec');
    }
    try{recognition.start();voiceBtn.classList.add('rec')}catch(e){voiceBtn.classList.remove('rec')}
  };
}

if(newChatBtn){
  newChatBtn.onclick=()=>{
    threadMessages=[]; chatMemory=[]; lastResult='';
    if(logEl){logEl.innerHTML='';updateLogTouchMode()}
    if(window.WBNet&&window.WBNet.setRunning) window.WBNet.setRunning(false);
  };
}
if(shareThreadBtn){
  shareThreadBtn.onclick=()=>{
    const text=threadMessages.map(m=>m.role==='user'?('Tu: '+(m.text||'')):'WB: '+(m.plain||m.text||'')).join('\n\n');
    shareText('Widow Blue chat', text||lastResult||'', shareThreadBtn);
  };
}

async function sendQuery(){
  if(appBusy)return;
  const text=(qEl&&qEl.value||'').trim();
  const atts=files.slice();
  if(!text&&!atts.length)return;
  appBusy=true;
  if(goBtn)goBtn.disabled=true;
  if(qEl)qEl.value='';

  const langSelVal=currentLang();
  const detected=detectInputLang(text||'');
  let displayText=text||'(allegati)';
  let queryForApi=text;

  const userDiv=document.createElement('div');
  userDiv.className='msg user';
  userDiv.innerHTML='<i>Tu</i> '+esc(displayText);
  if(langSelVal!=='auto'&&detected!==langSelVal&&text){
    const note=document.createElement('div');
    note.className='atts';
    note.textContent='Lingua risposta: '+langSelVal.toUpperCase();
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
  const history=chatMemory.slice(-28).map(m=>({role:m.role,text:m.text,entity:m.entity||null,topic:m.topic||null}));
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
          pushMemory('assistant',msg,data.contextEntity||null,data.contextTopic||null);
        }else{
          let formatted=formatSearchAnswer(data);
          try{
            if(lang && lang!=='auto' && formatted && formatted.plain && formatted.plain.length>20){
              const det=detectInputLang(formatted.plain);
              const enLeak=lang==='it' && /\b(the|and|with|this|that|is|are|from|which|because|however)\b/i.test(formatted.plain);
              if(det!==lang || enLeak){
                const forced=await clientForceLang(formatted.plain, lang);
                if(forced && forced.length>15){
                  formatted={plain:forced, html:'<div class="ans-text">'+esc(forced)+'</div>', imageUrl:formatted.imageUrl||null};
                }
              }
            }
          }catch(_e){}
          appendReply(formatted);
          pushMemory('assistant',formatted.plain,data.contextEntity||data.contextTopic||null,data.contextTopic||null);
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
