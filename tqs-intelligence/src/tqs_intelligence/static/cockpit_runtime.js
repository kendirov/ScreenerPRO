(()=>{
  let lastHealthOkMs=0,lastHealth=null;
  const STALE_MS=180000;

  function ensureBanner(){
    if($('#runtimeBanner'))return;
    $('.topbar').insertAdjacentHTML('afterend',`<div id="runtimeBanner" class="runtimeBanner"><div><b id="runtimeBannerTitle">—</b> <span id="runtimeBannerText"></span></div><div class="runtimeMeta"><span id="runtimeBannerMeta"></span><button id="runtimeRetry">проверить</button></div></div>`);
    $('#runtimeRetry').onclick=()=>runtimeTruthCheck(true);
  }
  function ageLabel(ms){if(ms==null)return 'нет snapshot';const sec=Math.max(0,Math.round(ms/1000));if(sec<60)return `${sec}с`;const min=Math.round(sec/60);if(min<60)return `${min}м`;return `${Math.round(min/60)}ч`}
  function setBanner(kind,title,text,meta=''){
    ensureBanner();const b=$('#runtimeBanner');b.className=`runtimeBanner show ${kind}`;$('#runtimeBannerTitle').textContent=title;$('#runtimeBannerText').textContent=text;$('#runtimeBannerMeta').textContent=meta;$('#instrumentWorkspace')?.classList.toggle('instrumentStale',kind==='offline'||kind==='stale');
  }
  function clearBanner(){ensureBanner();$('#runtimeBanner').className='runtimeBanner';$('#instrumentWorkspace')?.classList.remove('instrumentStale')}
  async function runtimeTruthCheck(force=false){
    ensureBanner();
    try{
      const h=await api('/api/health');lastHealth=h;lastHealthOkMs=Date.now();renderTopState(h);
      if(h.initializing){setBanner('initializing','TQS ЗАПУСКАЕТСЯ','Первый market snapshot ещё не завершён. Старые значения не считаются live.',`v${h.version||'—'} · ${h.identity?.runtime_instance_id||''}`);return}
      const generated=Number(h.generated_at_ms||0),age=generated?Date.now()-generated:null;
      if(age==null||age>STALE_MS){setBanner('stale','LAST SNAPSHOT / НЕ LIVE',`Backend отвечает, но market snapshot устарел: ${ageLabel(age)} назад.`, `v${h.version||'—'} · ${String(h.control?.mode||'').toUpperCase()} · cycles ${h.runtime?.refresh_count||0}`);return}
      if(h.runtime?.last_error){setBanner('stale','TQS DEGRADED',String(h.runtime.last_error).slice(0,220),`snapshot ${ageLabel(age)} · cycles ${h.runtime?.refresh_count||0}`);return}
      clearBanner();
    }catch(e){
      const since=lastHealthOkMs?Date.now()-lastHealthOkMs:null;
      setBanner('offline','BACKEND OFFLINE / ДАННЫЕ НЕ LIVE',`Графики ниже — последняя доступная история. Новые данные сейчас не подтверждены.`, `health ${since==null?'никогда':ageLabel(since)+' назад'} · ${String(e.message||e).slice(0,80)}`);
      $('#healthDot').className='dot err';$('#healthText').textContent='offline';
    }
  }
  window.runtimeTruthCheck=runtimeTruthCheck;
  ensureBanner();runtimeTruthCheck();setInterval(runtimeTruthCheck,10000);
})();
