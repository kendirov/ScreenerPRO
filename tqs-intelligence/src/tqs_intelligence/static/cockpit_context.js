(()=>{
  addAnomalyMarkers=function(series){
    const markers=[];
    if(state.layers.anomalies){
      for(const x of (state.instrument?.scores||[]).filter(x=>Number(x.score)>=75).slice(-100)){
        markers.push({time:Math.floor(Number(x.ts_ms)/1000),position:'aboveBar',color:COLORS.amber,shape:'circle',text:`A${Math.round(Number(x.score))}`});
      }
    }
    if(state.layers.accounts){
      for(const f of (state.fills||[]).slice(0,120)){
        const dir=String(f.direction||'').toLowerCase(),side=String(f.side||'').toLowerCase();
        const isLong=dir.includes('long')||(side==='buy'&&!dir.includes('close'));
        const isClose=dir.includes('close');
        const notional=Math.abs(Number(f.qty||0)*Number(f.price||0));
        markers.push({
          time:Math.floor(Number(f.ts_ms)/1000),
          position:isLong?'belowBar':'aboveBar',
          color:isClose?COLORS.blue:(isLong?COLORS.green:COLORS.red),
          shape:isLong?'arrowUp':'arrowDown',
          text:`${isClose?'EXIT':isLong?'LONG':'SHORT'} ${compact(notional)}`,
        });
      }
    }
    markers.sort((a,b)=>a.time-b.time);
    const compacted=[];let lastKey='';let same=0;
    for(const m of markers){
      const key=`${m.time}:${m.position}`;same=key===lastKey?same+1:0;lastKey=key;
      if(same>2)continue;compacted.push(m);
    }
    try{
      if(LightweightCharts.createSeriesMarkers)LightweightCharts.createSeriesMarkers(series,compacted.slice(-200));
      else if(series.setMarkers)series.setMarkers(compacted.slice(-200));
    }catch{}
  };

  loadData=async function(){
    try{
      const [lake,caps]=await Promise.all([api('/api/data-lake'),api('/api/capabilities')]);
      const ms=lake.metrics||{},bad=(lake.bad_files||[]).length+(ms.bad_files||[]).length;
      $('#dataMetrics').innerHTML=[
        ['Свечи',lake.rows,'Parquet history rows'],['Metric Lake',ms.rows,'OI · funding · basis · FUTOI'],['Всего',lake.all_rows??((lake.rows||0)+(ms.rows||0)),'канонических time-series rows'],
        ['Parquet files',(lake.files||0)+(ms.files||0),'history + metrics'],['Свободно',lake.free_gb,'GB'],['Ошибки файлов',bad,bad?'нужна проверка':'структура читается']
      ].map(([a,b,c])=>`<div class="metric"><span>${esc(a)}</span><b>${compact(b)}</b><small>${esc(c)}</small></div>`).join('');
      const metricRows=Object.entries(ms.metrics||{}).sort((a,b)=>b[1]-a[1]);
      const old=$('#metricLakePanel');if(old)old.remove();
      const metricBlock=metricRows.length?`<div id="metricLakePanel" class="panel" style="margin-bottom:10px"><div class="panelHead"><div><b>Metric Lake</b><small>временные ряды вне свечей</small></div></div><div class="tableWrap"><table class="table"><thead><tr><th>Метрика</th><th>Точек</th><th>Роль</th></tr></thead><tbody>${metricRows.map(([k,v])=>`<tr><td class="mono">${esc(k)}</td><td>${compact(v)}</td><td>${esc(metricRole(k))}</td></tr>`).join('')}</tbody></table></div></div>`:'';
      const capBlock=caps.map(x=>`<div class="researchCard"><b>${esc(x.name)}</b><small>${x.enabled?'ВКЛ':'ЗАРЕЗЕРВИРОВАНО'} · ${esc((x.markets||[]).join(', '))}<br>${esc(x.description||'')}<br><span class="mono">${esc(x.access||'')}</span></small></div>`).join('');
      if(metricBlock)$('#capabilities').parentElement.insertAdjacentHTML('beforebegin',metricBlock);
      $('#capabilities').innerHTML=capBlock;
    }catch(e){toast('Data: '+esc(e.message))}
  };

  function metricRole(k){
    if(k.includes('funding'))return 'стоимость удержания perpetual / экстремумы';
    if(k.includes('open_interest'))return 'позиционирование деривативов / изменение участия';
    if(k.includes('basis'))return 'расхождение futures/perpetual с индексом';
    if(k.includes('futoi_fiz'))return 'MOEX: физические лица';
    if(k.includes('futoi_yur'))return 'MOEX: юридические лица';
    return 'исследовательский временной ряд';
  }
})();
