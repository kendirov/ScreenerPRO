(()=>{
  let activityHours=24;
  const baseLoadOverview=loadOverview;

  function ensureActivityPanel(){
    if($('#activityPanel'))return;
    $('#overviewMetrics').insertAdjacentHTML('afterend',`
      <div id="activityPanel" class="panel activityPanel">
        <div class="panelHead activityHead"><div><b>Что машина сделала</b><small>полезная работа и ошибки, а не загрузка CPU</small></div><div class="scope"><button class="activityScope" data-hours="6">6ч</button><button class="activityScope active" data-hours="24">24ч</button><button class="activityScope" data-hours="72">72ч</button></div></div>
        <div id="activitySummary" class="activitySummary"></div>
        <div class="activityGrid"><div id="activityJobs" class="activityJobs"></div><div id="activityNow" class="activityNow"></div></div>
      </div>`);
    $$('.activityScope').forEach(b=>b.onclick=()=>{activityHours=Number(b.dataset.hours);$$('.activityScope').forEach(x=>x.classList.toggle('active',x===b));loadActivityLedger()});
  }

  function jobMetric(job){
    const r=job.result||{},kind=String(job.kind||'');
    if(kind==='historical_backfill'){
      const candles=Number(r.rows||0),d=r.derivative_metrics||{};
      const metricPoints=Number(d.points||0)||Object.values(d.points_written||{}).reduce((s,x)=>s+Number(x||0),0);
      return {main:candles,unit:'свечей',sub:metricPoints?`+ ${compact(metricPoints)} metrics`:''};
    }
    if(kind==='derivative_metric_backfill'){
      const points=typeof r.points_written==='number'?r.points_written:Object.values(r.points_written||{}).reduce((s,x)=>s+Number(x||0),0)+(Number(r.points)||0);
      return {main:points,unit:'metric points',sub:[r.oi_rows?`${compact(r.oi_rows)} OI`:null,r.funding_rows?`${compact(r.funding_rows)} funding`:null].filter(Boolean).join(' · ')};
    }
    if(kind==='historical_replay')return {main:Number(r.events||0),unit:'эпизодов',sub:String(r.status||'')};
    if(kind==='strategy_run')return {main:Number(r.events||0),unit:'событий',sub:String(r.status||'')};
    if(kind==='verify_lake')return {main:Number(r.all_rows||r.rows||0),unit:'rows проверено',sub:(r.bad_files||[]).length?'есть ошибки':'OK'};
    return {main:0,unit:kind||'job',sub:''};
  }

  function aggregate(jobs){
    let candles=0,metricPoints=0,replays=0,strategyRuns=0,failed=0,done=0;
    for(const j of jobs){
      const m=jobMetric(j);
      if(j.status==='done')done++;
      if(j.status==='failed')failed++;
      if(j.kind==='historical_backfill')candles+=Number(j.result?.rows||0);
      if(j.kind==='derivative_metric_backfill')metricPoints+=Number(m.main||0);
      if(j.kind==='historical_backfill'){
        const d=j.result?.derivative_metrics||{};
        metricPoints+=Number(d.points||0)||Object.values(d.points_written||{}).reduce((s,x)=>s+Number(x||0),0);
      }
      if(j.kind==='historical_replay'&&j.status==='done')replays++;
      if(j.kind==='strategy_run'&&j.status==='done')strategyRuns++;
    }
    return {candles,metricPoints,replays,strategyRuns,failed,done};
  }

  function renderActivityJobs(jobs){
    const target=$('#activityJobs');if(!target)return;
    if(!jobs.length){target.innerHTML='<div class="empty"><b>В выбранном окне jobs нет.</b>Live market collection идёт отдельно и показана справа.</div>';return}
    target.innerHTML=jobs.slice(0,80).map(j=>{
      const m=jobMetric(j),status=String(j.status||'queued');
      const title=j.title_ru||j.title||j.id;
      const detail=j.error?String(j.error).split('\n')[0].slice(0,180):(m.sub||`${num(Number(j.progress||0)*100,0)}%`);
      return `<div class="activityJob"><time>${ts(j.created_at_ms,true)}</time><div><b>${esc(title)}</b><small>${esc(detail)}</small></div><em class="${esc(status)}">${esc(status.toUpperCase())}${m.main?` · ${compact(m.main)} ${esc(m.unit)}`:''}</em></div>`;
    }).join('');
  }

  async function loadActivityLedger(){
    ensureActivityPanel();
    try{
      const [day,o,accounts,lake,logs]=await Promise.all([
        api(`/api/activity-summary?hours=${activityHours}`),api('/api/overview'),api('/api/accounts'),api('/api/data-lake'),api('/api/logs?limit=120')
      ]);
      const rr=o.research_runtime||{},rt=o.runtime||{},ai=accounts.status||{},disc=ai.discovery||{},metrics=lake.metrics||{};
      const st=day.status||{};
      $('#activitySummary').innerHTML=[
        ['Market cycles',rt.refresh_count||0,'текущая runtime-сессия'],
        ['Свечи +',day.candles_added||0,`${activityHours}ч durable jobs`],
        ['Metric points +',day.metric_points_added||0,'OI / funding / basis / FUTOI'],
        ['Replay',day.replay_runs_done||0,'завершено'],
        ['Strategies',day.strategy_runs_done||0,'прогонов'],
        ['Failed',day.failed||0,day.failed?'требуют внимания':'нет job failures']
      ].map(([x,y,z])=>`<div class="activityKpi"><span>${esc(x)}</span><b class="${x==='Failed'&&Number(y)?'down':''}">${compact(y)}</b><small>${esc(z)}</small></div>`).join('');
      const errorRows=(day.recent_errors||[]).map(x=>({id:x.id,kind:'failed',status:'failed',created_at_ms:x.finished_at_ms,title_ru:x.title_ru,error:x.error,result:{}}));
      const seen=new Set(),ledger=[...(day.current||[]),...(day.recent_done||[]),...errorRows].filter(x=>x?.id&&!seen.has(x.id)&&seen.add(x.id));
      renderActivityJobs(ledger);
      const recentErrors=logs.filter(x=>String(x.level||'').toLowerCase()==='error').slice(0,4);
      $('#activityNow').innerHTML=`
        <div class="nowRow"><span>СЕЙЧАС</span><b>${esc(rr.last_action||'Research ожидает')}</b></div>
        <div class="nowRow"><span>ОЧЕРЕДЬ</span><b>${day.unfinished||0} queued/running · ${esc(String(o.control?.mode||'—').toUpperCase())}</b></div>
        <div class="nowRow"><span>ЗА ${activityHours}Ч</span><b>${st.done||0} done · ${st.failed||0} failed · ${day.jobs_touched||0} jobs touched</b></div>
        <div class="nowRow"><span>AUTO HISTORY</span><b>${compact(rr.auto_history?.done||0)} done / ${compact(rr.auto_history?.target_total||0)} target · ${compact(rr.auto_history?.remaining||0)} remaining</b></div>
        <div class="nowRow"><span>AUTO METRICS</span><b>${compact(rr.auto_metrics?.done||0)} done / ${compact(rr.auto_metrics?.target_total||0)} target · ${compact(rr.auto_metrics?.remaining||0)} remaining</b></div>
        <div class="nowRow"><span>PUBLIC ACCOUNTS</span><b>${compact(disc.discovered_accounts||0)} discovered · ${compact(ai.tracked_accounts||0)} hot · ${compact(ai.open_positions||0)} positions · ${compact(ai.fills||0)} fills</b></div>
        <div class="nowRow"><span>DATA LAKE</span><b>${compact(lake.rows||0)} candle rows · ${compact(metrics.rows||0)} metric rows · ${num(lake.free_gb,1)} GB free</b></div>
        ${day.failed||recentErrors.length?`<div class="activityWarning">Есть ${day.failed||0} failed jobs и ${recentErrors.length} свежих runtime error-событий. Детали сохранены в журнале и диагностическом пакете.</div>`:`<div class="activityGood">В выбранном окне нет job failures/runtime errors в доступной выборке.</div>`}`;
    }catch(e){$('#activityNow').innerHTML=`<div class="activityWarning">Activity Ledger не загрузился: ${esc(e.message)}</div>`}
  }

  loadOverview=async function(){await baseLoadOverview();await loadActivityLedger()};
})();
