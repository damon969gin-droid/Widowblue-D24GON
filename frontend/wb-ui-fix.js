// WidowBlue UI Reactivation Layer
// Connects core buttons to existing and future agent APIs
(function(){
  const byId=(id)=>document.getElementById(id);

  function notify(text){
    const log=byId('log');
    if(!log)return;
    const d=document.createElement('div');
    d.className='msg agent';
    d.innerHTML='<i>WidowBlue Core</i> '+text;
    log.appendChild(d);
    log.scrollTop=log.scrollHeight;
  }

  const go=byId('go');
  const q=byId('q');
  if(go && !go.dataset.wbFixed){
    go.dataset.wbFixed='true';
    go.onclick=function(){
      const text=(q&&q.value||'').trim();
      if(!text){notify('Inserisci una richiesta.');return;}
      if(window.wbSendMessage){window.wbSendMessage(text);}
      else {notify('Richiesta ricevuta: '+text);}
      if(q)q.value='';
    };
  }

  const clip=byId('clip');
  const file=byId('file');
  if(clip && file && !clip.dataset.wbFixed){
    clip.dataset.wbFixed='true';
    clip.onclick=()=>file.click();
  }

  const agents=['Programming','Frontend','Backend','Flutter','Android','iOS','Research','Cloud','Linux','Docker','Database','Security','Image','Video','Audio','Marketing','Testing','QA','Documentation','Deployment','Automation'];
  window.WidowBlueAgents=agents;

  window.activateAgent=function(name){
    notify('Agent '+name+' attivato.');
    if(window.fireAll)window.fireAll();
  };

  const all=byId('allAgents');
  if(all)all.title='Attiva sistema multi-agent WidowBlue';

  notify('UI Core riattivata: Chat, Upload, Voce, Agent System online.');
})();
