/* WidowBlue Agent Core v0.2 */
(function(){
  const agents={
    supervisor:{status:'ready'},
    planner:{status:'ready'},
    programmer:{status:'ready'},
    frontend:{status:'ready'},
    backend:{status:'ready'},
    database:{status:'ready'},
    cloud:{status:'ready'},
    security:{status:'ready'},
    tester:{status:'ready'}
  };

  function setStatus(name,status){
    if(agents[name]) agents[name].status=status;
    window.dispatchEvent(new CustomEvent('widowblue-agent',{detail:{name,status}}));
  }

  async function run(prompt){
    setStatus('supervisor','working');
    const selected=/app|software|codice|programma|sito|dashboard/i.test(prompt)
      ? ['planner','programmer','frontend','backend']
      : ['planner'];

    selected.forEach(a=>setStatus(a,'working'));

    let result=null;
    if(window.wbApi && window.wbApi.orchestrate){
      result=await window.wbApi.orchestrate(prompt,{deep:true});
    }

    selected.forEach(a=>setStatus(a,'completed'));
    setStatus('supervisor','completed');
    return result || {ok:true,data:{message:'WidowBlue Agent Core online'}};
  }

  window.WidowBlueCore={agents,run,setStatus};

  window.wbSendMessage=async function(text){
    const log=document.getElementById('log');
    const add=(msg)=>{
      if(!log)return;
      const d=document.createElement('div');
      d.className='msg agent';
      d.innerHTML='<i>WidowBlue Agent</i> '+msg;
      log.appendChild(d);
      log.scrollTop=log.scrollHeight;
    };
    add('Supervisor Agent: analisi richiesta...');
    const result=await run(text);
    add(result?.data?.answer || result?.data?.message || 'Task completato');
  };
})();
