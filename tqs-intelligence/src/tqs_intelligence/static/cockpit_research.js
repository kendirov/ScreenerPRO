async function loadResearch(){
  try{
    const rows=await Promise.all([
      api('/api/research/projects?limit=100'),
      api('/api/research/runs?limit=200'),
      api('/api/research/findings?limit=100'),
      api('/api/jobs?limit=200'),
      api('/api/strategies'),
      api('/api/strategies/runs?limit=200')
    ]);
    const projects=rows[0], researchRuns=rows[1], findings=rows[2], jobs=rows[3], strategies=rows[4], stratRuns=rows[5];
    const latest=new Map();
    researchRuns.forEach(function(r){if(!latest.has(r.research_id))latest.set(r.research_id,r)});
    $('#researchProjects').innerHTML=projects.length?projects.map(function(p){
      const r=latest.get(p.id), can=(p.instruments||[]).length>0;
      let html='<div class="researchCard"><div class="eyebrow">'+esc(String(p.status||'').toUpperCase())+' · '+esc(p.market||'multi')+'</div>';
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
    $('#researchJobs').innerHTML=jobs.length?'<table class="table"><thead><tr><th>Задача</th><th>Тип работы</th><th>Статус</th><th>Прогресс</th></tr></thead><tbody>'+jobs.map(function(x){
      return '<tr><td><b>'+esc(x.title_ru||x.id)+'</b></td><td>'+esc(x.kind||'')+'</td><td>'+esc(statusRu(x.status))+'</td><td>'+num(x.progress_pct??((x.progress||0)*100),0)+'%</td></tr>';
    }).join('')+'</tbody></table>':'<div class="empty">Очередь пуста.</div>';
    $('#researchFindings').innerHTML=findings.length?findings.map(function(x){
      return '<div class="researchCard"><b>'+esc(x.summary_ru||x.pattern_key||'Finding')+'</b><small>'+esc(x.status||'')+' · N '+num(x.sample_count,0)+' · '+esc(x.canonical_id||'')+'</small></div>';
    }).join(''):'<div class="empty">Подтверждённых выводов пока нет. Research Runs сохраняют и отрицательные результаты.</div>';
    $('#researchStrategies').innerHTML=strategies.length?strategies.map(function(st){
      const r=stratRuns.find(function(x){return x.strategy_id===st.id});
      return '<div class="researchCard"><b>'+esc(st.name_ru||st.id)+'</b><small>'+esc(st.status||'')+(r?' · '+esc(r.status||'')+' · N '+num(r.events,0):' · нет прогонов')+'</small></div>';
    }).join(''):'<div class="empty">Стратегий нет.</div>';
  }catch(e){toast('Research: '+esc(e.message))}
}

document.addEventListener('click',async function(e){
  const rb=e.target.closest('.researchRun');
  if(!rb||rb.disabled)return;
  try{
    rb.disabled=true; rb.textContent='В очереди...';
    const out=await api('/api/research/projects/'+encodeURIComponent(rb.dataset.id)+'/queue',{method:'POST'});
    toast(out.queued_job_ids&&out.queued_job_ids.length?'Research jobs: '+out.queued_job_ids.length:'Research already queued or no instruments');
    await loadResearch();
  }catch(err){toast('Research queue: '+esc(err.message));rb.disabled=false}
});
