/* WidowBlue app – chat, allegati, link cliccabili, voice, agents, multi-lang */

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
/** Escape + converte URL http(s) in <a> cliccabili */
function linkify(s){
  const e=esc(s);
  return e.replace(
    /(https?:\/\/[^\s<>"'`\]\)]+[^\s<>"'`\]\)\.,;:!?])/g,
    function(url){
      const clean=url.replace(/[),.]+$/,'');
      const trail=url.slice(clean.length);
      return '<a href="'+clean+'" target="_blank" rel="noopener noreferrer" class="chat-link">'+clean+'</a>'+trail;
    }
  );
}
function answerHtml(text){
  return '<div class="ans-text">'+linkify(text)+'</div>';
}
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
  let html=answerHtml(text);
  if(sources&&sources.length){
    html+='<div class="ans-h">Fonti</div><ol class="ans-src">';
    sources.slice(0,6).forEach(r=>{
      const t=esc(r.title||r.url||''); const u=esc(r.url||'#');
      const p=r.provider?(' <span class="prov">'+esc(r.provider)+'</span>'):'';
      html+='<li><a href="'+u+'" target="_blank" rel="noopener noreferrer" class="chat-link">'+t+'</a>'+p+'</li>';
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
  const videoUrl=typeof body==='object'?body.videoUrl:null;
  lastResult=plain||'';
  const d=document.createElement('div');
  d.className='msg reply';
  const content=document.createElement('div');
  content.className='reply-body';
  if(html) content.innerHTML=html;
  else content.innerHTML=answerHtml(plain);
  d.appendChild(content);
  if(videoUrl){
    const v=document.createElement('video');
    v.className='gen-video'; v.src=videoUrl; v.controls=true; v.playsInline=true;
    v.style.maxWidth='100%'; v.style.borderRadius='8px'; v.style.marginTop='8px';
    d.appendChild(v);
    const a=document.createElement('a');
    a.href=videoUrl; a.target='_blank'; a.rel='noopener noreferrer'; a.className='chat-link'; a.textContent='Apri video';
    a.style.display='inline-block'; a.style.marginTop='6px'; a.style.color='var(--cy)';
    d.appendChild(a);
  } else if(imageUrl){
    const img=document.createElement('img');
    img.className='gen-img'; img.src=imageUrl; img.alt='generated';
    d.appendChild(img);
  }
  const actions=document.createElement('div');
  actions.className='msg-actions';
  const copyBtn=document.createElement('button');
  copyBtn.type='button'; copyBtn.className='sec'; copyBtn.textContent='Copia';
  copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(plain||content.innerText||'');copyBtn.textContent='Copiato';setTimeout(()=>copyBtn.textContent='Copia',1200)}catch(e){}};
  const shareBtn=document.createElement('button');
  shareBtn.type='button'; shareBtn.className='sec'; shareBtn.textContent='Condividi';
  shareBtn.onclick=()=>shareText('Widow Blue',plain||content.innerText||'',shareBtn);
  actions.appendChild(copyBtn); actions.appendChild(shareBtn);
  d.appendChild(actions);
  if(logEl){logEl.appendChild(d);updateLogTouchMode();scrollLog()}
  threadMessages.push({role:'assistant',plain,html,imageUrl,videoUrl,at:Date.now()});
}

async function shareText(title,text,btn){
  try{
    if(navigator.share){await navigator.share({title,text});return}
    await navigator.clipboard.writeText(text);
    if(btn){btn.textContent='Copiato';setTimeout(()=>btn.textContent='Condividi',1200)}
  }catch(e){}
}

const LANGS=[['it','IT'],['en','EN'],['es','ES'],['fr','FR'],['de','DE'],['pt','PT'],['ja','JA'],['zh','ZH'],['ko','KO'],['ar','AR'],['ru','RU'],['hi','HI'],['tr','TR'],['nl','NL'],['pl','PL'],['auto','AUTO']];

function detectInputLang(text){
  const t=String(text||'');
  if(!t.trim())return 'it';
  if(/[\u3040-\u30ff]/.test(t))return 'ja';
  if(/[\u4e00-\u9fff]/.test(t))return 'zh';
  if(/[\uac00-\ud7af]/.test(t))return 'ko';
  if(/[\u0600-\u06ff]/.test(t))return 'ar';
  if(/[\u0900-\u097f]/.test(t))return 'hi';
  if(/[\u0400-\u04ff]/.test(t))return /[іїєґ]/i.test(t)?'uk':'ru';
  if(/[ąćęłńóśźż]/i.test(t)||/\b(co|jak|gdzie|jest|nie)\b/i.test(t))return 'pl';
  if(/[äöüß]/i.test(t)||/\b(was|wann|wie|nicht)\b/i.test(t))return 'de';
  if(/[ñ¿¡]/i.test(t)||/\b(qué|cuando|hola)\b/i.test(t))return 'es';
  if(/\b(quoi|quand|bonjour)\b/i.test(t))return 'fr';
  const it=(t.match(/\b(il|la|di|che|cosa|quando|ciao|sono|video|genera)\b/gi)||[]).length;
  const en=(t.match(/\b(the|and|with|what|when|is|are)\b/gi)||[]).length;
  if(/[àèéìòù]/i.test(t)||it>=1)return 'it';
  if(en>=2)return 'en';
  return 'it';
}

async function translateClient(text, from, to){
  const q=String(text||'').trim().slice(0,450);
  if(!q||!to||to==='auto')return q;
  let f=String(from||'autodetect').toLowerCase();
  const t=String(to).slice(0,2).toLowerCase();
  if(f==='auto')f='autodetect';
  if(f===t||(f!=='autodetect'&&f.slice(0,2)===t))return q;
  try{
    const url='https://api.mymemory.translated.net/get?q='+encodeURIComponent(q)+'&langpair='+encodeURIComponent(f+'|'+t);
    const res=await fetch(url);
    if(!res.ok)return q;
    const data=await res.json();
    const out=(data&&data.responseData&&data.responseData.translatedText)||'';
    if(!out)return q;
    const s=String(out).trim();
    if(/PLEASE SELECT TWO DISTINCT LANGUAGES/i.test(s)||/INVALID|WARNING|NOT SUPPORTED/i.test(s))return q;
    return s;
  }catch(e){return q}
}

async function clientForceLang(text, target){
  const t=String(text||'').trim();
  if(!t||!target||target==='auto') return t;
  try{if(detectInputLang(t)===target) return t}catch(_e){}
  try{
    const parts=[]; let rest=t;
    while(rest.length){
      let cut=Math.min(420,rest.length);
      if(cut<rest.length){const sp=rest.lastIndexOf('. ',cut);const sp2=rest.lastIndexOf(' ',cut);if(sp>100)cut=sp+1;else if(sp2>100)cut=sp2;}
      parts.push(rest.slice(0,cut).trim()); rest=rest.slice(cut).trimStart();
      if(parts.length>=8){if(rest)parts[parts.length-1]+=' '+rest;break;}
    }
    const out=[];
    for(const p of parts){const tr=await translateClient(p,'autodetect',target); out.push(tr&&!/PLEASE SELECT TWO DISTINCT/i.test(tr)?tr:p)}
    const joined=out.join(' ').replace(/\s{2,}/g,' ').trim();
    return /PLEASE SELECT TWO DISTINCT/i.test(joined)?t:(joined||t);
  }catch(e){return t}
}

const langSel=document.getElementById('lang');
if(langSel){
  LANGS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;langSel.appendChild(o)});
  try{langSel.value=localStorage.getItem('wb_lang')||'it'}catch(e){try{langSel.value='it'}catch(_){}}
  langSel.onchange=()=>{try{localStorage.setItem('wb_lang',langSel.value)}catch(e){}};
}
function currentLang(){return (langSel&&langSel.value)||'it'}

function applyAllAgentsVisual(on){
  try{
    window.allMode=!!on;
    if(window.WBNet&&typeof window.WBNet.setAllMode==='function') window.WBNet.setAllMode(!!on);
    else {window.WBNet=window.WBNet||{}; window.WBNet.allMode=!!on; window.allMode=!!on}
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

async function fileToAttachment(f){
  const att={name:f.name,type:f.type||'application/octet-stream',size:f.size};
  if(f.type&&f.type.startsWith('image/')&&f.size<4*1024*1024){
    try{
      att.dataUrl=await new Promise((resolve,reject)=>{
        const r=new FileReader();
        r.onload=()=>resolve(r.result);
        r.onerror=reject;
        r.readAsDataURL(f);
      });
    }catch(_e){}
  }
  return att;
}

function renderAttachChips(){
  if(!chipsEl)return;
  chipsEl.innerHTML='';
  files.forEach((f,i)=>{
    const c=document.createElement('span');
    c.className='chip attach-chip';
    c.style.cssText='display:inline-flex;align-items:center;gap:4px;cursor:pointer';
    c.title='Rimuovi allegato';
    if(f._preview){
      const img=document.createElement('img');
      img.src=f._preview; img.alt=f.name||'img';
      img.style.cssText='width:36px;height:36px;object-fit:cover;border-radius:4px';
      c.appendChild(img);
    }
    const lab=document.createElement('span');
    const nm=f.name||'file';
    lab.textContent=nm.length>28?nm.slice(0,24)+'\u2026':nm;
    c.appendChild(lab);
    c.onclick=()=>{files.splice(i,1);if(fileInput)fileInput.value='';renderAttachChips()};
    chipsEl.appendChild(c);
  });
}

if(clipBtn&&fileInput){
  try{fileInput.setAttribute('accept','image/*,.pdf,.txt,.md,.json,video/*,audio/*')}catch(_e){}
  clipBtn.onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{
    const picked=Array.from(fileInput.files||[]);
    for(const f of picked){
      if(f.type&&f.type.startsWith('image/')){
        try{
          f._preview=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
        }catch(_e){}
      }
      files.push(f);
    }
    try{fileInput.value=''}catch(_e){}
    renderAttachChips();
  };
}

if(qEl){
  qEl.addEventListener('paste',async(e)=>{
    const items=(e.clipboardData&&e.clipboardData.items)||[];
    let added=false;
    for(const it of items){
      if(it.type&&it.type.startsWith('image/')){
        e.preventDefault();
        const blob=it.getAsFile();
        if(!blob)continue;
        const f=new File([blob],'incolla-'+Date.now()+'.png',{type:blob.type||'image/png'});
        try{
          f._preview=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
        }catch(_e){}
        files.push(f);
        added=true;
      }
    }
    if(added) renderAttachChips();
  });
}

if(voiceBtn&&(window.SpeechRecognition||window.webkitSpeechRecognition)){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  voiceBtn.onclick=()=>{
    if(!recognition){
      recognition=new SR(); recognition.continuous=false; recognition.interimResults=false;
      const voiceMap={it:'it-IT',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-PT',pl:'pl-PL',nl:'nl-NL'};
      recognition.lang=voiceMap[currentLang()]||'it-IT';
      recognition.onresult=(ev)=>{if(qEl)qEl.value=ev.results[0][0].transcript; voiceBtn.classList.remove('rec')};
      recognition.onerror=()=>voiceBtn.classList.remove('rec');
      recognition.onend=()=>voiceBtn.classList.remove('rec');
    }
    try{recognition.start();voiceBtn.classList.add('rec')}catch(e){voiceBtn.classList.remove('rec')}
  };
}

if(newChatBtn){newChatBtn.onclick=()=>{threadMessages=[];chatMemory=[];lastResult='';files=[];renderAttachChips();if(logEl){logEl.innerHTML='';updateLogTouchMode()}if(window.WBNet&&window.WBNet.setRunning)window.WBNet.setRunning(false)}};
if(shareThreadBtn){shareThreadBtn.onclick=()=>{const text=threadMessages.map(m=>m.role==='user'?('Tu: '+(m.text||'')):'WB: '+(m.plain||m.text||'')).join('\n\n');shareText('Widow Blue chat',text||lastResult||'',shareThreadBtn)}};

async function sendQuery(){
  if(appBusy)return;
  const text=(qEl&&qEl.value||'').trim();
  const attsFiles=files.slice();
  if(!text&&!attsFiles.length)return;
  appBusy=true; if(goBtn)goBtn.disabled=true; if(qEl)qEl.value='';
  const atts=[];
  for(const f of attsFiles){
    atts.push(await fileToAttachment(f));
  }
  files=[]; renderAttachChips();
  const langSelVal=currentLang();
  const detected=detectInputLang(text||'');
  const displayText=text||'(allegati)';
  const userDiv=document.createElement('div');
  userDiv.className='msg user';
  const head=document.createElement('div');
  head.innerHTML='<i>Tu</i> '+esc(displayText);
  userDiv.appendChild(head);
  if(atts.length){
    const row=document.createElement('div');
    row.className='msg-atts';
    row.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:6px';
    atts.forEach(a=>{
      if(a.dataUrl&&a.type&&a.type.startsWith('image/')){
        const img=document.createElement('img');
        img.src=a.dataUrl; img.alt=a.name||'allegato';
        img.style.cssText='max-width:140px;max-height:140px;border-radius:8px;border:1px solid rgba(77,225,255,.35);object-fit:cover';
        row.appendChild(img);
      }else{
        const chip=document.createElement('span');
        chip.className='chip';
        chip.textContent=(a.name||'file')+' ('+Math.round((a.size||0)/1024)+' KB)';
        row.appendChild(chip);
      }
    });
    userDiv.appendChild(row);
  }
  if(logEl){logEl.appendChild(userDiv);updateLogTouchMode();scrollLog()}
  if(window.WBNet&&window.WBNet.setRunning) window.WBNet.setRunning(true);
  else if(window.WBNet&&window.WBNet.ignite){window.running=true;window.WBNet.ignite()}
  threadMessages.push({role:'user',text:displayText,attachments:atts.map(a=>({name:a.name,type:a.type,size:a.size})),at:Date.now()});
  pushMemory('user',displayText+(atts.length?' [+'+atts.length+' allegati]':''));
  const lang=langSelVal==='auto'?detected:langSelVal;
  const history=chatMemory.slice(-28).map(m=>({role:m.role,text:m.text,entity:m.entity||null,topic:m.topic||null}));
  try{
    if(typeof WB!=='undefined'&&WB.api){
      const body={query:text,prompt:text,deep:true,lang,history,allAgents:allAgents,attachments:atts.map(a=>({name:a.name,type:a.type,size:a.size,dataUrl:a.dataUrl||null}))};
      let data=null;
      try{data=await WB.api('/api/search',{method:'POST',body:JSON.stringify(body)})}
      catch(e1){try{data=await WB.api('/api/orchestrate',{method:'POST',body:JSON.stringify(body)});if(data&&data.search)data=data.search}catch(e2){data=null}}
      if(data&&data.ok!==false){
        if(data.mode==='video'||(data.video&&(data.video.url||data.video.project||data.video.error))){
          let msg=(data.answer&&data.answer.text)||(data.video&&data.video.message)||'Video in elaborazione.';
          let url=data.videoUrl||(data.video&&(data.video.url||data.video.videoUrl))||null;
          const project=(data.video&&data.video.project)||data.project||null;
          if(data.video&&data.video.error==='missing_json2video_key'){
            appendReply({plain:msg,html:answerHtml(msg),videoUrl:null});
          }else if(!url && project){
            appendReply({plain:msg+' Attendo il render…',html:answerHtml(msg)+' <i>Attendo il render…</i>',videoUrl:null});
            for(let i=0;i<24 && !url;i++){
              await new Promise(r=>setTimeout(r,i===0?3000:5000));
              try{
                const st=await WB.api('/api/video/status?project='+encodeURIComponent(project),{method:'GET'});
                if(st&&st.status==='done'&&(st.url||st.videoUrl)){url=st.url||st.videoUrl;msg=lang==='it'?'Video pronto.':'Video ready.';break}
                if(st&&(st.status==='error'||st.status==='timeout')){msg=st.message||'Errore render video.';break}
              }catch(_e){}
            }
            if(url) appendReply({plain:msg,html:answerHtml(msg),videoUrl:url});
            else appendReply({plain:msg.includes('Errore')?msg:('Video ancora in elaborazione. ID: '+project),html:answerHtml(msg.includes('Errore')?msg:('Video ancora in elaborazione. ID: '+project)),videoUrl:null});
          }else{
            appendReply({plain:msg,html:answerHtml(msg),videoUrl:url});
          }
          pushMemory('assistant',msg,null,null);
        }else if(data.mode==='image'||(data.image&&data.image.url)){
          const msg=(data.answer&&data.answer.text)||(data.image&&data.image.message)||'Immagine generata.';
          const url=(data.image&&(data.image.url||data.image.imageUrl))||data.imageUrl;
          appendReply({plain:msg,html:answerHtml(msg),imageUrl:url});
          pushMemory('assistant',msg,null,null);
        }else{
          let formatted=formatSearchAnswer(data);
          try{
            if(lang&&lang!=='auto'&&formatted&&formatted.plain&&formatted.plain.length>20){
              const det=detectInputLang(formatted.plain);
              const enLeak=lang==='it'&&/\b(the|and|with|this|that|is|are)\b/i.test(formatted.plain);
              if(det!==lang||enLeak){
                const forced=await clientForceLang(formatted.plain,lang);
                if(forced&&forced.length>15&&!/PLEASE SELECT TWO DISTINCT/i.test(forced)){
                  const srcMatch=formatted.html&&formatted.html.match(/<div class="ans-h">[\s\S]*$/);
                  formatted={
                    plain:forced,
                    html:answerHtml(forced)+(srcMatch?srcMatch[0]:''),
                    imageUrl:formatted.imageUrl||null
                  };
                }
              }
            }
          }catch(_e){}
          appendReply(formatted);
          pushMemory('assistant',formatted.plain,data.contextEntity||null,data.contextTopic||null);
        }
      }else{
        const errMsg=(data&&data.video&&data.video.message)||(data&&data.message)||'Non è stato possibile completare. Riprova.';
        appendReply({plain:errMsg,html:answerHtml(errMsg)});
      }
    }else appendReply({plain:'API non disponibile.',html:answerHtml('API non disponibile.')});
  }catch(err){appendReply({plain:'Errore di rete. Riprova.',html:answerHtml('Errore di rete. Riprova.')})}
  if(window.WBNet&&window.WBNet.setRunning) window.WBNet.setRunning(false);
  else window.running=false;
  appBusy=false; if(goBtn)goBtn.disabled=false; scrollLog();
}

if(goBtn)goBtn.onclick=sendQuery;
if(qEl)qEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQuery()}});
updateLogTouchMode();
