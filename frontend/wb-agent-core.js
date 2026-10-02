/* WidowBlue Agent Core v0.1 */
(function(){
  const agents={
    supervisor:'Coordina gli agenti',
    planner:'Analizza requisiti e crea piano',
    programmer:'Genera codice',
    frontend:'Crea interfacce',
    backend:'Crea API',
    database:'Progetta database',
    cloud:'Gestisce deploy',
    security:'Controlla sicurezza',
    tester:'Esegue controlli'
  };

  window.WidowBlueCore={
    agents,
    async run(prompt){
      if(window.wbApi && window.wbApi.orchestrate){
        return await window.wbApi.orchestrate(prompt,{deep:true});
      }
      return {ok:false,data:{error:'agent_api_missing'}};
    }
  };

  window.wbSendMessage=async function(text){
    const log=document.getElementById('log');
    if(!log)return;
    const add=(msg)=>{const d=document.createElement('div');d.className='msg agent';d.innerHTML='<i>WidowBlue Agent</i> '+msg;log.appendChild(d);log.scrollTop=log.scrollHeight;};
    add('Supervisor Agent: analisi richiesta...');
    const result=await window.WidowBlueCore.run(text);
    if(result.ok && result.data){
      add(result.data.answer || result.data.message || 'Task completato');
    }else{
      add('Core online. Collegamento AI backend in attesa.');
    }
  };
})();
