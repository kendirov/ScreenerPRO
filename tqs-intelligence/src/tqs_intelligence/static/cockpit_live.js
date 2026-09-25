(()=>{
  const timeout=(promise,ms=2500,label='request')=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' timeout')),ms))
  ]);
  const value=(r,fallback)=>r&&r.status==='fulfilled'?r.value:fallback;
  const mCard=(label,val,hint='')=>`<div class="metric"><span>${esc(label)}</span><b>${val}</b><small>${esc(hint)}</small></div>`;
  const progress=(label,done,total,hint='')=>{
    const d=Number(done||0),t=Number(total||0),p=t?Math.max(0,Math.min(100,d/t*100)):0;
    return `<div class="liveProgress"><div class="liveProgressTop"><span>${esc(label)}</span><b>${t?Math.round(p)+'%':'—'}</b></div><div class="liveProgressTrack"><i style="width:${p}%"></i></div><small>${compact(d)} / ${compact(t)}${hint?' · '+esc(hint):''}</small></div>`;
  };
  const safeText=x=>x==null?'—':String(x);

  function liveMachine(o,r){
    const rt=o.runtime||{},research=o.research_runtime||{},hist=research.auto_history||{},met=research.auto_metrics||{};
    const lchi=o.lchi_public||{},pulse=o.pulse_public||{},sys=r?.system||{},workers=r?.research?.workers||[],jobs=research.active_jobs||[];
    const top=(r?.top_processes||[]).slice(0,6);
    return `
      <div class="liveMachineGrid">
        <div class="contextCard">
          <div class="label">LIVE MARKET</div>
          <div class="value">${rt.refreshing?'СБОР ИДЁТ':'ГОТОВ'}</div>
          <div class="hint">циклов ${compact(rt.refresh_count||0)} · последний ${num((rt.last_refresh_duration_ms||0)/1000,1)} c · ${esc(rt.last_action||'ожидание')}</div>
        </div>
        <div class="contextCard">
          <div class="label">ПК СЕЙЧАС</div>
          <div class="value">CPU ${num(sys.cpu_percent??o.resources?.cpu_percent,0)}% · RAM ${num(sys.ram_percent??o.resources?.memory_percent,0)}%</div>
          <div class="hint">RAM ${num(sys.ram_used_gb??o.resources?.memory_used_gb,1)} / ${num(sys.ram_total_gb??o.resources?.memory_total_gb,1)} GB · disk R ${num(sys.disk_io?.read_mb_s,1)} / W ${num(sys.disk_io?.write_mb_s,1)} MB/s</div>
        </div>
        ${progress('История рынка',hist.done,hist.target_total,'очередь '+compact(hist.queued_running||0)+' · ошибок '+compact(hist.failed||0))}
        ${progress('OI / FUTOI / метрики',met.done,met.target_total,'очередь '+compact(met.queued_running||0)+' · ошибок '+compact(met.failed||0))}
        <div class="contextCard spanWide">
          <div class="label">RESEARCH WORKERS</div>
          <div class="liveJobList">${jobs.length?jobs.slice(0,5).map((j,i)=>`<div><b>W${i+1}</b><span>${esc(j.title||j.title_ru||j.kind||j.id||'job')}</span><em>${num((j.progress_pct??((j.progress||0)*100)),0)}%</em></div>`).join(''):'<div><span>Нет активной тяжёлой задачи</span></div>'}</div>
          <div class="hint">workers ${workers.filter(x=>String(x.state).toLowerCase()==='running').length}/${r?.policy?.heavy_workers||research.desired_workers||'-'} · ${research.resource_snapshot?.throttled?'THROTTLED: '+esc(research.resource_snapshot?.throttle_reason||'resources'):'ресурсный лимит не сработал'}</div>
        </div>
        <div class="contextCard">
          <div class="label">ЛЧИ</div>
          <div class="value">${compact(lchi.participants_discovered||0)} участников</div>
          <div class="hint">портфели ${compact(lchi.participants_with_portfolio||0)} · события ${compact(lchi.position_events||0)} · ${esc(lchi.last_action||'')}</div>
        </div>
        <div class="contextCard">
          <div class="label">ПУЛЬС</div>
          <div class="value">${compact(pulse.profiles_tracked||0)} профилей</div>
          <div class="hint">synced ${compact(pulse.profiles_synced||0)} · events ${compact(pulse.events||0)} · ${esc(pulse.last_action||'')}</div>
        </div>
        <div class="contextCard spanWide">
          <div class="label">КТО ГРУЗИТ WINDOWS</div>
          <div class="liveProcList">${top.length?top.map(p=>`<span><b>${esc(p.name||p.category||'process')}</b> CPU ${num(p.cpu_percent,1)}% · RAM ${num(p.memory_mb,0)} MB</span>`).join(''):'<span>Сэмпл процессов прогревается…</span>'}</div>
        </div>
      </div>`;
  }

  async function liveOverview(){
    const results=await Promise.allSettled([
      timeout(api('/api/overview'),2200,'overview'),
      timeout(api('/api/quotes?limit=250'),2200,'quotes'),
      timeout(api('/api/resources'),2200,'resources')
    ]);
    const o=value(results[0],state.overview||{}),quotes=value(results[1],[]),resources=value(results[2],null);
    state.overview=o;
    if(o&&Object.keys(o).length)renderTopState(o);
    const sys=resources?.system||{},research=o.research_runtime||{};
    const active=(research.active_jobs||[]).length;
    $('#overviewMetrics').innerHTML=[
      mCard('CPU',num(sys.cpu_percent??o.resources?.cpu_percent,0)+'%',(sys.logical_cores||'—')+' threads'),
      mCard('RAM',num(sys.ram_percent??o.resources?.memory_percent,0)+'%',num(sys.ram_used_gb??o.resources?.memory_used_gb,1)+' / '+num(sys.ram_total_gb??o.resources?.memory_total_gb,1)+' GB'),
      mCard('TQS RAM',num(o.resources?.process_memory_mb,0)+' MB','backend process'),
      mCard('Инструменты',compact(o.quote_count||quotes.length),'live universe'),
      mCard('Аномалии',compact(o.anomaly_count||0),'WHY NOW candidates'),
      mCard('Heavy workers',String(active),'очередь '+compact(o.lab?.queued_jobs||0))
    ].join('');
    $('#overviewAnomalies').innerHTML=anomalyRows(o.top_anomalies||[]);
    $('#overviewMarkets').innerHTML=Object.entries(o.asset_classes||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="marketCard"><span>${esc(k)}</span><b>${compact(v)}</b></div>`).join('')||'<div class="empty">Ждём первый live snapshot.</div>';
    $('#overviewSources').innerHTML=sourceRows(o.sources||[]);
    $('#overviewMachine').innerHTML=liveMachine(o,resources);
    $('#overviewMovers').innerHTML=quotes.length?quoteRows(quotes.slice(0,40)):'<div class="empty">Live quotes пока не пришли.</div>';
  }
  loadOverview=liveOverview;
  window.loadOverview=liveOverview;

  const coverageRow=(name,status,detail,cls='')=>`<div class="moexCoverageRow"><div><b>${esc(name)}</b><small>${esc(detail)}</small></div><em class="${esc(cls)}">${esc(status)}</em></div>`;
  const moexTable=(rows,isFuture)=>{
    if(!rows?.length)return '<div class="empty">Нет свежих данных.</div>';
    return `<table class="table"><thead><tr><th>Инструмент</th><th>Цена</th><th>Изм.</th><th>Оборот</th>${isFuture?'<th>OI</th>':''}</tr></thead><tbody>${rows.slice(0,80).map(x=>`<tr class="click liveMoexInstrument" data-cid="${esc(x.canonical_id)}"><td><b>${esc(x.name||x.symbol)}</b><small class="mono">${esc(x.symbol||'')}</small></td><td>${num(x.price,4)}</td><td>${pct(x.change_pct)}</td><td>${compact(x.turnover)}</td>${isFuture?'<td>'+compact(x.open_interest)+'</td>':''}</tr>`).join('')}</tbody></table>`;
  };
  async function liveMoex(){
    const results=await Promise.allSettled([
      timeout(api('/api/moex'),2200,'moex'),
      timeout(api('/api/quotes?provider=moex&limit=10000'),2500,'moex quotes'),
      timeout(api('/api/health'),1800,'health'),
      timeout(api('/api/moex/intelligence?limit=200'),1800,'moex intelligence'),
      timeout(api('/api/anomalies?provider=moex&limit=100&min_score=20'),1800,'moex anomalies')
    ]);
    const m=value(results[0],{}),quotes=value(results[1],[]),h=value(results[2],{}),intel=value(results[3],{}),generic=value(results[4],[]);
    const lchi=m.lchi_public||h.lchi_public||{},pulse=m.pulse_public||h.pulse_public||{},session=m.session||{};
    const counts={};quotes.forEach(q=>counts[q.market_type]=(counts[q.market_type]||0)+1);
    const hist=h.research_runtime?.auto_history||{},met=h.research_runtime?.auto_metrics||{},active=h.research_runtime?.active_jobs||[];
    $('#moexMetrics').innerHTML=[
      ['Сессия',session.status==='open'?'ОТКРЫТА':'НЕАКТИВНА',session.note||'MOEX session'],
      ['MOEX universe',m.count||quotes.length,'живые инструменты'],
      ['Акции',counts.shares||0,'shares'],
      ['Фьючерсы',counts.forts||0,'FORTS'],
      ['История',hist.target_total?Math.round((hist.done||0)/hist.target_total*100)+'%':'—',compact(hist.done||0)+' / '+compact(hist.target_total||0)],
      ['OI/FUTOI',met.target_total?Math.round((met.done||0)/met.target_total*100)+'%':'—',compact(met.done||0)+' / '+compact(met.target_total||0)]
    ].map(x=>mCard(x[0],esc(x[1]),x[2])).join('');
    $('#moexCoverage').innerHTML=[
      coverageRow('Живой рынок MOEX',quotes.length?'РАБОТАЕТ':'НЕТ SNAPSHOT',compact(quotes.length)+' live quotes · '+(session.note||''),quotes.length?'good':'warn'),
      coverageRow('История свечей',hist.target_total?compact(hist.done||0)+' / '+compact(hist.target_total):'ПРОГРЕВ','очередь '+compact(hist.queued_running||0)+' · ошибок '+compact(hist.failed||0),'good'),
      coverageRow('OI / FUTOI / производные',met.target_total?compact(met.done||0)+' / '+compact(met.target_total):'ПРОГРЕВ','очередь '+compact(met.queued_running||0)+' · ошибок '+compact(met.failed||0),met.failed?'warn':'good'),
      coverageRow('ЛЧИ 2026',lchi.running?'СОБИРАЕТ':'ПАУЗА',compact(lchi.participants_discovered||0)+' участников · '+compact(lchi.participants_with_portfolio||0)+' портфелей · '+compact(lchi.position_events||0)+' изменений',lchi.last_error?'warn':'good'),
      coverageRow('Т-Банк Пульс',pulse.running?'СОБИРАЕТ':'ГОТОВ',compact(pulse.profiles_tracked||0)+' профилей · '+compact(pulse.profiles_synced||0)+' synced · '+compact(pulse.events||0)+' public events',pulse.last_error?'warn':'plan')
    ].join('');
    $('#moexParticipantSources').innerHTML=[
      ['БИРЖА','MOEX ISS','котировки / оборот / OI / статус','good'],
      ['АГРЕГАТ','FUTOI','физлица / юрлица · provenance сохраняется',met.done?'good':'warn'],
      ['ПУБЛИЧНЫЙ СЧЁТ','ЛЧИ 2026',compact(lchi.participants_discovered||0)+' найдено · '+compact(lchi.participants_with_portfolio||0)+' портфелей',lchi.running?'good':'plan'],
      ['ПУБЛИЧНЫЙ ПРОФИЛЬ','Пульс',compact(pulse.profiles_tracked||0)+' tracked · скрытый размер не выдумывается',pulse.last_error?'warn':'plan']
    ].map(x=>`<div class="participantSource ${x[3]}"><span>${esc(x[0])}</span><div><b>${esc(x[1])}</b><small>${esc(x[2])}</small></div></div>`).join('');

    let rows=(intel.rows||[]).filter(x=>Number(x.attention_score||0)>=20).slice(0,50);
    if(!rows.length&&generic.length) rows=generic.map(a=>({
      canonical_id:a.canonical_id,symbol:a.symbol,name:a.quote?.display_symbol||a.symbol,
      attention_score:a.score,reasons:a.reasons||[],ret_15m_pct:null,turnover_tod_ratio:null,
      oi_15m_pct:null,baseline_days:0
    })).slice(0,50);
    $('#moexIntelligence').innerHTML=rows.length?`<table class="table"><thead><tr><th>Инструмент</th><th>WHY NOW</th><th>15м</th><th>Оборот/норма</th><th>OI 15м</th><th>TQS</th></tr></thead><tbody>${rows.map(x=>`<tr class="click liveMoexInstrument" data-cid="${esc(x.canonical_id)}"><td><b>${esc(x.name||x.symbol)}</b><small class="mono">${esc(x.symbol||'')}</small></td><td>${(x.reasons||[]).slice(0,3).map(y=>'<small>'+esc(y)+'</small>').join('')}</td><td>${x.ret_15m_pct==null?'—':pct(x.ret_15m_pct,2)}</td><td>${x.turnover_tod_ratio==null?'—':num(x.turnover_tod_ratio,1)+'x'}</td><td>${x.oi_15m_pct==null?'—':pct(x.oi_15m_pct,2)}</td><td><span class="score">${num(x.attention_score,0)}</span><small>${x.baseline_days||0} дн. baseline</small></td></tr>`).join('')}</tbody></table>`:`<div class="empty"><b>${session.status==='open'?'Сильных аномалий прямо сейчас нет.':'Основная сессия сейчас неактивна.'}</b>Система продолжает сбор и исторический backfill; пустота не считается ошибкой рынка.</div>`;

    const jobRows=active.filter(j=>/moex|futoi|forts|sber|ri|si/i.test(JSON.stringify(j))).slice(0,12);
    $('#moexJobs').innerHTML=`
      <div class="liveProgressGrid">${progress('История MOEX / market history',hist.done,hist.target_total,'queued '+compact(hist.queued_running||0))}${progress('OI / FUTOI / metrics',met.done,met.target_total,'queued '+compact(met.queued_running||0))}</div>
      ${jobRows.length?`<table class="table"><thead><tr><th>Worker</th><th>Что делает сейчас</th><th>Прогресс</th></tr></thead><tbody>${jobRows.map((j,i)=>`<tr><td>W${i+1}</td><td><b>${esc(j.title||j.title_ru||j.kind||j.id)}</b><small>${esc(j.canonical_id||j.provider||'')}</small></td><td>${num(j.progress_pct??((j.progress||0)*100),0)}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Сейчас heavy worker может быть занят другим рынком; MOEX очередь продолжает храниться в autopilot.</div>'}`;
    $('#moexStocks').innerHTML=moexTable(m.top_stocks||[],false);
    $('#moexFutures').innerHTML=moexTable(m.top_futures||[],true);
    $$('.liveMoexInstrument').forEach(x=>x.onclick=()=>openInstrument(x.dataset.cid));
  }
  window.loadMoex=liveMoex;

  async function liveOpenInstrument(cid){
    setView('instrument');
    $('#searchResults').innerHTML='';
    $('#instrumentWorkspace').innerHTML='<div class="empty"><b>Собираю инструмент…</b>Сначала цена/свечи/объём/аномалии; участники догружаются независимо.</div>';
    destroyCharts();
    try{
      const inst=await timeout(api('/api/instrument/'+encodeURIComponent(cid)),5000,'instrument');
      const q=inst.quote||{},sym=String(q.symbol||cid.split(':').pop()||'');
      state.selected=cid;state.instrument=inst;state.positions=[];state.profiles=[];state.fills=[];
      state.lchiPositions=[];state.lchiEvents=[];state.lchiTrades=[];state.pulseEvents=[];
      renderInstrument();
      if(q.provider==='moex'){
        Promise.allSettled([
          timeout(api('/api/moex/participants/lchi/positions?symbol='+encodeURIComponent(sym)+'&limit=500'),3500,'lchi positions'),
          timeout(api('/api/moex/participants/lchi/events?symbol='+encodeURIComponent(sym)+'&limit=500'),3500,'lchi events'),
          timeout(api('/api/moex/participants/lchi/trades?symbol='+encodeURIComponent(sym)+'&limit=500'),3500,'lchi trades'),
          timeout(api('/api/moex/participants/pulse/events?symbol='+encodeURIComponent(sym)+'&limit=500'),3500,'pulse events')
        ]).then(rs=>{
          state.lchiPositions=value(rs[0],[]);state.lchiEvents=value(rs[1],[]);
          state.lchiTrades=value(rs[2],[]);state.pulseEvents=value(rs[3],[]);
          renderAccounts();renderEvents();renderCharts();
        });
      }
    }catch(e){
      $('#instrumentWorkspace').innerHTML=`<div class="empty"><b>Не удалось открыть инструмент.</b>${esc(e.message)}</div>`;
    }
  }
  openInstrument=liveOpenInstrument;
  window.openInstrument=liveOpenInstrument;

  async function liveSystem(){
    const rs=await Promise.allSettled([
      timeout(api('/api/system'),2200,'system'),
      timeout(api('/api/logs?limit=180'),2200,'logs'),
      timeout(api('/api/resources'),2200,'resources'),
      timeout(api('/api/audit'),1800,'audit')
    ]);
    const s=value(rs[0],{}),logs=value(rs[1],[]),resources=value(rs[2],null),audit=value(rs[3],null);
    if(Object.keys(s).length)renderTopState(s);
    $('#systemIdentity').innerHTML=`<div class="contextList"><div class="contextCard"><div class="label">Version</div><div class="value">v${esc(s.version||'-')}</div><div class="hint mono">instance ${esc(s.identity?.runtime_instance_id||'-')}</div></div><div class="contextCard"><div class="label">Mode</div><div class="value">${esc(String(s.control?.mode||'-').toUpperCase())}</div><div class="hint">CPU ${num(resources?.system?.cpu_percent??s.resources?.cpu_percent,0)}% · RAM ${num(resources?.system?.ram_percent??s.resources?.memory_percent,0)}%</div></div><div class="contextCard"><div class="label">Data Lake</div><div class="value">${compact(s.data_lake?.files)} files</div><div class="hint">${esc(s.data_lake?.root||'')}</div></div></div>`;
    $('#systemLogs').textContent=logs.length?logs.map(x=>`[${ts(x.ts_ms||x.created_at_ms,true)}] ${String(x.level||'').toUpperCase()} ${x.component||''} · ${x.message||x.text||''}`).join('\n'):'Логи временно недоступны — live/runtime продолжает работать.';
    if(resources)renderResourceDashboard(resources);
    if(audit){
      const checks=audit.checks||[];
      $('#systemAudit').innerHTML=`<div class="participantInstrumentSummary"><span>Итог <b>${esc(audit.overall||'-')}</b></span><span>Snapshot <b>${esc(audit.snapshot?.fresh?'FRESH':'STALE')}</b></span><span>Quotes <b>${compact(audit.snapshot?.quotes||0)}</b></span></div><table class="table"><thead><tr><th>Статус</th><th>Слой</th><th>Что происходит</th></tr></thead><tbody>${checks.map(x=>`<tr><td><b>${esc(String(x.status||'').toUpperCase())}</b></td><td>${esc(x.title||x.key||'')}</td><td>${esc(x.detail||'')}</td></tr>`).join('')}</tbody></table>`;
    }else{
      $('#systemAudit').innerHTML='<div class="empty"><b>Глубокий audit занят.</b>Это не блокирует живой cockpit; ресурсы и market state выше продолжают обновляться.</div>';
    }
  }
  loadSystem=liveSystem;
  window.loadSystem=liveSystem;

  async function liveResearch(){
    const rs=await Promise.allSettled([
      timeout(api('/api/research/projects?limit=100'),2500,'projects'),
      timeout(api('/api/research/runs?limit=100'),2500,'research runs'),
      timeout(api('/api/jobs?limit=120'),2500,'jobs'),
      timeout(api('/api/strategies'),2500,'strategies'),
      timeout(api('/api/strategies/runs?limit=120'),2500,'strategy runs'),
      timeout(api('/api/research/findings?limit=50'),1800,'findings'),
      timeout(api('/api/paper-bots?limit=100'),1800,'paper bots')
    ]);
    const projects=value(rs[0],[]),runs=value(rs[1],[]),jobs=value(rs[2],[]);
    const strategies=value(rs[3],[]),stratRuns=value(rs[4],[]),findings=value(rs[5],[]);
    const paper=value(rs[6],{status:{},bots:[]});
    const latest=new Map();runs.forEach(r=>{if(!latest.has(r.research_id))latest.set(r.research_id,r)});
    $('#researchProjects').innerHTML=projects.length?projects.map(p=>{
      const r=latest.get(p.id),can=(p.instruments||[]).length>0;
      return `<div class="researchCard"><div class="eyebrow">${esc(String(p.status||'').toUpperCase())} · ${esc(p.market||'multi')}</div><b>${esc(p.title||p.id)}</b><small>${esc(p.hypothesis||'')}</small><div class="researchMeta">instruments ${(p.instruments||[]).length} · controls ${(p.controls||[]).length} · regimes ${(p.regimes||[]).length}</div>${r?'<div class="researchMeta"><b>'+esc(String(r.status||'').toUpperCase())+'</b> · N '+compact(r.sample_count||0)+' · '+esc(r.conclusion||'')+'</div>':''}<button class="btn small researchRun" data-id="${esc(p.id)}" ${can?'':'disabled'}>${can?'Запустить / продолжить':'Нет инструментов'}</button></div>`;
    }).join(''):'<div class="empty"><b>Research Registry пуст.</b>Новая гипотеза появится здесь после постановки задачи.</div>';
    $('#researchRuns').innerHTML=runs.length?`<table class="table"><thead><tr><th>Исследование</th><th>Инструмент</th><th>Статус</th><th>Sample</th><th>Вывод</th></tr></thead><tbody>${runs.slice(0,80).map(r=>`<tr><td><b>${esc(r.research_id)}</b></td><td class="mono">${esc(r.canonical_id||'')}</td><td>${esc(String(r.status||'').toUpperCase())}</td><td>${compact(r.sample_count||0)}</td><td>${esc(r.conclusion||r.next_action||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Готовых experiment runs пока нет.</div>';
    $('#researchJobs').innerHTML=jobs.length?`<table class="table"><thead><tr><th>Задача</th><th>Тип</th><th>Статус</th><th>Прогресс</th></tr></thead><tbody>${jobs.slice(0,80).map(j=>`<tr><td><b>${esc(j.title_ru||j.title||j.id)}</b></td><td>${esc(j.kind||'')}</td><td>${esc(statusRu(j.status))}</td><td>${num(j.progress_pct??((j.progress||0)*100),0)}%</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Очередь сейчас пуста.</div>';
    $('#researchStrategies').innerHTML=strategies.length?strategies.map(st=>{
      const r=stratRuns.find(x=>x.strategy_id===st.id);
      return `<div class="researchCard"><b>${esc(st.name_ru||st.id)}</b><small>${esc(st.status||'')}${r?' · last '+esc(r.status||'')+' · '+esc(r.canonical_id||''): ' · ещё без прогона'}</small></div>`;
    }).join(''):'<div class="empty">StrategySpec пока нет.</div>';
    $('#researchFindings').innerHTML=findings.length?findings.slice(0,20).map(f=>`<div class="researchCard"><b>${esc(f.summary_ru||f.pattern_key||'Finding')}</b><small>${esc(f.status||'')} · N ${compact(f.sample_count||0)}</small></div>`).join(''):`<div class="empty"><b>Глубокие findings не блокируют лабораторию.</b>${rs[5].status==='rejected'?'DuckDB сейчас занят backfill; проекты, очередь и стратегии выше уже доступны.':'Пока нет findings с достаточным evidence.'}</div>`;
    const bots=paper.bots||[],ps=paper.status||{};
    $('#paperBots').innerHTML=`<div class="participantInstrumentSummary"><span>MODE <b>PAPER</b></span><span>LIVE ORDERS <b>OFF</b></span><span>ARMED <b>${compact(ps.armed||0)}</b></span><span>OPEN <b>${compact(ps.open_trades||0)}</b></span></div>`+(bots.length?`<table class="table"><thead><tr><th>Bot</th><th>Strategy</th><th>Instrument</th><th>Status</th></tr></thead><tbody>${bots.map(b=>`<tr><td><b>${esc(b.name||b.id)}</b></td><td>${esc(b.strategy_id||'')}</td><td class="mono">${esc(b.canonical_id||'')}</td><td>${esc(String(b.status||'').toUpperCase())}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Paper bots пока не созданы.</div>');
  }
  loadResearch=liveResearch;
  window.loadResearch=liveResearch;

  if(window.__tqsCockpitLiveTimer)clearInterval(window.__tqsCockpitLiveTimer);
  window.__tqsCockpitLiveTimer=setInterval(()=>{
    if(state.view==='overview')liveOverview();
    else if(state.view==='moex')liveMoex();
    else if(state.view==='system')loadResourcesOnly();
  },5000);
  setTimeout(()=>{const p=new URLSearchParams(location.search);if(state.view==='overview')liveOverview();else if(state.view==='moex')liveMoex();else if(state.view==='research')liveResearch();else if(state.view==='instrument'&&p.get('cid'))liveOpenInstrument(p.get('cid'));},50);
})();
