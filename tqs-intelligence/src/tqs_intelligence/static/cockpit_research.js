async function loadResearch(){
  try{
    const rows=await Promise.all([
      api('/api/research/projects?limit=100'),
      api('/api/research/runs?limit=200'),
      api('/api/research/findings?limit=100'),
      api('/api/jobs?limit=200'),
      api('/api/strategies'),
      api('/api/strategies/runs?limit=200'),
      api('/api/paper-bots?limit=200'),
      api('/api/paper-bots/trades?limit=500')
    ]);
    const projects=rows[0], researchRuns=rows[1], findings=rows[2], jobs=rows[3];
    const strategies=rows[4], stratRuns=rows[5], paper=rows[6], paperTrades=rows[7];
    const latest=new Map();
    researchRuns.forEach(function(r){if(!latest.has(r.research_id))latest.set(r.research_id,r)});
    $('#researchProjects').innerHTML=projects.length?projects.map(function(p){
      const r=latest.get(p.id), can=(p.instruments||[]).length>0;
      let html='<div class="researchCard"><div class="eyebrow">V'+esc(p.version||1)+' · '+esc(String(p.status||'').toUpperCase())+' · '+esc(p.market||'multi')+'</div>';
      html+='<b>'+esc(p.title||p.id)+'</b><small>'+esc(p.hypothesis||'')+'</small>';
      html+='<div class="tagRow">'+(p.data_requirements||[]).slice(0,5).map(function(x){return '<span class="tag">'+esc(x)+'</span>'}).join('')+'</div>';
      html+='<div class="researchMeta">instruments '+(p.instruments||[]).length+' · controls '+(p.controls||[]).length+' · regimes '+(p.regimes||[]).length+'</div>';
      if(r)html+='<div class="researchMeta"><b>'+esc(String(r.status||'').toUpperCase())+'</b> · N '+compact(r.sample_count)+' / ctl '+compact(r.control_count)+'<br>'+esc(r.conclusion||'')+'</div>';
      html+='<button class="btn small researchRun" data-id="'+esc(p.id)+'" '+(can?'':'disabled')+'>'+(can?'Запустить':'Нужны инструменты')+'</button></div>';
      return html;
    }).join(''):'<div class="empty">Research Registry empty.</div>';
    $('#researchRuns').innerHTML=researchRuns.length?'<table class="table"><thead><tr><th>Research</th><th>Instrument</th><th>Status</th><th>Sample</th><th>Control</th><th>Conclusion / next</th></tr></thead><tbody>'+researchRuns.map(function(r){
      return '<tr><td><b>'+esc(r.research_id)+'</b><small>'+esc(r.family||'')+'</small></td><td class="mono">'+esc(r.canonical_id)+'</td><td><b>'+esc(String(r.status||'').toUpperCase())+'</b></td><td>'+compact(r.sample_count)+'</td><td>'+compact(r.control_count)+'</td><td>'+esc(r.conclusion||'')+'<small>'+esc(r.next_action||'')+'</small></td></tr>';
    }).join('')+'</tbody></table>':'<div class="empty">Прогонов пока нет.</div>';

    const ps=paper.status||{}, bots=paper.bots||[];
    let paperHead='<div class="participantInstrumentSummary"><span>MODE <b>PAPER</b></span><span>LIVE ORDERS <b>OFF</b></span><span>ARMED <b>'+compact(ps.armed||0)+'</b></span><span>OPEN TRADES <b>'+compact(ps.open_trades||0)+'</b></span><span>CLOSED <b>'+compact(ps.closed_trades||0)+'</b></span></div>';
    if(bots.length){
      paperHead+='<table class="table"><thead><tr><th>Bot</th><th>Strategy / run</th><th>Instrument</th><th>Status</th><th>Paper trades</th><th>Control</th></tr></thead><tbody>'+bots.map(function(b){
        const trades=paperTrades.filter(function(t){return t.bot_id===b.id}), open=trades.filter(function(t){return t.status==='open'}).length, closed=trades.filter(function(t){return t.status==='closed'}).length;
        let action='';
        if(b.status==='draft'||b.status==='paused')action='<button class="btn small paperStatus" data-id="'+esc(b.id)+'" data-status="armed">ARM PAPER</button>';
        else if(b.status==='armed')action='<button class="btn small paperStatus" data-id="'+esc(b.id)+'" data-status="paused">PAUSE</button>';
        else action='<span class="down">'+esc(b.block_reason||'blocked')+'</span>';
        return '<tr><td><b>'+esc(b.name||b.id)+'</b><small>'+esc(b.id)+'</small></td><td>'+esc(b.strategy_id)+'<small>'+esc(b.strategy_run_id)+'</small></td><td class="mono">'+esc(b.canonical_id)+'</td><td><b>'+esc(String(b.status||'').toUpperCase())+'</b><small>live_allowed='+esc(String(b.live_allowed))+'</small></td><td>'+open+' open · '+closed+' closed</td><td>'+action+'</td></tr>';
      }).join('')+'</tbody></table>';
    }else paperHead+='<div class="empty">Paper bots пока нет. Создание доступно только из candidate/validated StrategyRun.</div>';
    $('#paperBots').innerHTML=paperHead;
    $('#researchJobs').innerHTML=jobs.length?'<table class="table"><thead><tr><th>Задача</th><th>Тип работы</th><th>Статус</th><th>Прогресс</th></tr></thead><tbody>'+jobs.slice(0,80).map(function(x){
      return '<tr><td><b>'+esc(x.title_ru||x.id)+'</b></td><td>'+esc(x.kind||'')+'</td><td>'+esc(statusRu(x.status))+'</td><td>'+num(x.progress_pct??((x.progress||0)*100),0)+'%</td></tr>';
    }).join('')+'</tbody></table>':'<div class="empty">Очередь пуста.</div>';
    $('#researchFindings').innerHTML=findings.length?findings.map(function(x){
      return '<div class="researchCard"><b>'+esc(x.summary_ru||x.pattern_key||'Finding')+'</b><small>'+esc(x.status||'')+' · N '+num(x.sample_count,0)+' · '+esc(x.canonical_id||'')+'</small></div>';
    }).join(''):'<div class="empty">Legacy findings пока нет. Research Runs выше сохраняют и положительные, и отрицательные результаты.</div>';
    $('#researchStrategies').innerHTML=strategies.length?strategies.map(function(st){
      const r=stratRuns.find(function(x){return x.strategy_id===st.id});
      const promotable=r&&['candidate','validated'].includes(String(r.status||'').toLowerCase());
      let action='';
      if(r&&promotable)action='<button class="btn small paperFromRun" data-run="'+esc(r.run_id)+'">Создать paper bot</button>';
      else if(r)action='<span class="researchMeta">paper gate: '+esc(r.status||'')+'</span>';
      return '<div class="researchCard"><b>'+esc(st.name_ru||st.id)+'</b><small>'+esc(st.status||'')+(r?' · '+esc(r.status||'')+' · N '+num(r.events,0):' · нет прогонов')+'</small>'+action+'</div>';
    }).join(''):'<div class="empty">Стратегий нет.</div>';
  }catch(e){toast('Research: '+esc(e.message))}
}
document.addEventListener('click',async function(e){
  const rb=e.target.closest('.researchRun');
  if(rb&&!rb.disabled){
    try{
      rb.disabled=true; rb.textContent='В очереди...';
      const out=await api('/api/research/projects/'+encodeURIComponent(rb.dataset.id)+'/queue',{method:'POST'});
      toast(out.queued_job_ids&&out.queued_job_ids.length?'Research jobs: '+out.queued_job_ids.length:'Research already queued or no instruments');
      await loadResearch();
    }catch(err){toast('Research queue: '+esc(err.message));rb.disabled=false}
    return;
  }
  const pf=e.target.closest('.paperFromRun');
  if(pf){
    try{
      const bot=await api('/api/paper-bots/from-run/'+encodeURIComponent(pf.dataset.run),{method:'POST'});
      toast('Paper bot '+esc(bot.id)+' · '+esc(String(bot.status).toUpperCase()));
      await loadResearch();
    }catch(err){toast('Paper bot: '+esc(err.message))}
    return;
  }
  const ps=e.target.closest('.paperStatus');
  if(ps){
    try{
      const bot=await api('/api/paper-bots/'+encodeURIComponent(ps.dataset.id)+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:ps.dataset.status})});
      toast('Paper bot '+esc(bot.id)+' → '+esc(String(bot.status).toUpperCase()));
      await loadResearch();
    }catch(err){toast('Paper status: '+esc(err.message))}
  }
});

(()=>{
const el=id=>document.getElementById(id);
const n=(id)=>{const raw=el(id)?.value?.trim();return raw===''||raw==null?null:Number(raw)};
const ints=value=>String(value||'').split(',').map(x=>Number(x.trim())).filter(Number.isInteger);
function preset(name){
  ['discoveryHours','discoveryRsi','discoveryReturn','discoveryRound','discoveryVolume'].forEach(id=>{if(el(id))el(id).value=''});
  if(name==='rsi')el('discoveryRsi').value='30';
  if(name==='drop')el('discoveryReturn').value='-0.5';
  if(name==='round')el('discoveryRound').value='10';
  if(name==='volume')el('discoveryVolume').value='3';
  el('discoveryStatus').textContent=name==='baseline'?'Baseline: вход после каждой завершённой минуты.':'Preset заполнен. Запуск создаст отдельный frozen StrategySpec.';
}
document.addEventListener('click',async e=>{
  const p=e.target.closest('.discoveryPreset'); if(p){preset(p.dataset.preset);return}
  const b=e.target.closest('#discoveryRun'); if(!b)return;
  const symbol=(el('discoverySymbol')?.value||'').trim();
  if(!symbol){toast('Укажите инструмент');return}
  b.disabled=true; const status=el('discoveryStatus'); status.textContent='Ищу инструмент и фиксирую StrategySpec…';
  try{
    const quotes=await api('/api/quotes?q='+encodeURIComponent(symbol)+'&limit=30');
    const quote=quotes.find(x=>x.provider==='moex'&&['shares','forts'].includes(x.market_type))||quotes[0];
    if(!quote)throw new Error('инструмент не найден в свежем snapshot');
    const filters={auto_run:false,return_lookback_bars:15,rsi_period:14,volume_z_window:30};
    const hours=ints(el('discoveryHours')?.value); if(hours.length)filters.hours_msk=hours;
    const rsi=n('discoveryRsi'); if(Number.isFinite(rsi))filters.rsi_lte=rsi;
    const ret=n('discoveryReturn'); if(Number.isFinite(ret))filters.return_lte_pct=ret;
    const round=n('discoveryRound'); if(Number.isFinite(round))filters.round_distance_bps_lte=round;
    const volume=n('discoveryVolume'); if(Number.isFinite(volume))filters.volume_z_gte=volume;
    const horizon=Math.max(1,Math.min(240,Math.round(n('discoveryHorizon')||30)));
    const costs=Math.max(0,n('discoveryCosts')??8);
    const id='TQS-STRAT-DISCOVERY-'+Date.now();
    const labels=[];
    if(hours.length)labels.push('часы '+hours.join(','));
    if(Number.isFinite(rsi))labels.push('RSI≤'+rsi);
    if(Number.isFinite(ret))labels.push('ret15≤'+ret+'%');
    if(Number.isFinite(round))labels.push('round≤'+round+'bp');
    if(Number.isFinite(volume))labels.push('vol z≥'+volume);
    const name=labels.length?'MOEX discovery · '+labels.join(' · '):'Каждую минуту · baseline';
    const spec={id,name_ru:name,version:1,status:'exploratory',origin:'artem-ui',idea:'Систематически проверить условие против matched time-shift control без post-hoc promotion.',universe:['MOEX stocks','MOEX futures'],interval:'1m',event:{type:'conditional_entry',control_offset_bars:30},entry:{type:'next_bar_open',side:'long'},exit:{type:'time',horizon_bars:horizon},filters,costs:{round_trip_bps:costs},validation:{exploration_fraction:.6,validation_fraction:.2,holdout_fraction:.2,walk_forward_folds:4,min_events:40},notes:['Создано через TQS Strategy Discovery Builder.','Найденный новый фильтр требует отдельного frozen run.']};
    await api('/api/strategies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(spec)});
    const job=await api('/api/strategies/'+encodeURIComponent(id)+'/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({canonical_id:quote.canonical_id})});
    status.textContent='В очереди: '+name+' · '+(quote.display_symbol||quote.symbol)+' · job '+job.id;
    toast('Strategy run поставлен в очередь');
    await loadResearch();
  }catch(err){status.textContent='Ошибка: '+err.message;toast('Discovery: '+esc(err.message))}
  finally{b.disabled=false}
});
})();
