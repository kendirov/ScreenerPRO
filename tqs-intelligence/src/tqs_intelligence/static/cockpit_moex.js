(()=>{
  const provider=j=>String((j&&j.payload&&j.payload.provider)||'').toLowerCase();
  const market=j=>String((j&&j.payload&&j.payload.market_type)||'').toLowerCase();
  const doneSymbols=(jobs,kind,marketType)=>{
    const set=new Set();
    jobs.forEach(j=>{
      if(j.kind===kind&&provider(j)==='moex'&&(!marketType||market(j)===marketType)&&j.status==='done')set.add(String((j.payload&&j.payload.symbol)||''));
    });
    return set.size;
  };
  const countJobs=(jobs,kind,marketType,statuses)=>jobs.filter(j=>j.kind===kind&&provider(j)==='moex'&&(!marketType||market(j)===marketType)&&statuses.includes(j.status)).length;
  const coverageRow=(name,status,detail,cls)=>'<div class="moexCoverageRow"><div><b>'+esc(name)+'</b><small>'+esc(detail)+'</small></div><em class="'+esc(cls||'')+'">'+esc(status)+'</em></div>';
  const table=(rows,isFuture)=>{
    if(!rows||!rows.length)return '<div class="empty">Нет свежих данных.</div>';
    let head='<table class="table"><thead><tr><th>Инструмент</th><th>Цена</th><th>Изм.</th><th>Оборот</th>';
    if(isFuture)head+='<th>OI</th>';
    head+='</tr></thead><tbody>';
    const body=rows.slice(0,60).map(x=>{
      let row='<tr class="click moexInstrument" data-cid="'+esc(x.canonical_id)+'"><td><b>'+esc(x.name||x.symbol)+'</b><small class="mono">'+esc(x.symbol)+'</small></td><td>'+num(x.price,4)+'</td><td>'+pct(x.change_pct)+'</td><td>'+compact(x.turnover)+'</td>';
      if(isFuture)row+='<td>'+compact(x.open_interest)+'</td>';
      return row+'</tr>';
    }).join('');
    return head+body+'</tbody></table>';
  };

  async function loadMoex(){
    try{
      const result=await Promise.all([
        api('/api/moex'),
        api('/api/quotes?provider=moex&limit=10000'),
        api('/api/jobs?limit=2000'),
        api('/api/overview')
      ]);
      const m=result[0],quotes=result[1],jobs=result[2],o=result[3];
      const counts={shares:0,forts:0,index:0,selt:0,bonds:0};
      quotes.forEach(q=>{counts[q.market_type]=(counts[q.market_type]||0)+1});
      const src=(o.sources||[]).find(x=>x.provider==='moex');
      const metricRows=[
        ['Всего MOEX сейчас',m.count||quotes.length,'инструментов в свежем universe'],
        ['Акции',counts.shares||0,'живой поиск и котировки'],
        ['Фьючерсы',counts.forts||0,'FORTS'],
        ['Индексы',counts.index||0,'IMOEX / RTS / секторные'],
        ['Валюты',counts.selt||0,'биржевой FX'],
        ['Источник',src&&src.status==='ok'?'Работает':statusRu(src&&src.status),src?('обновлено · '+compact(src.instruments)+' инструментов'):'нет статуса']
      ];
      $('#moexMetrics').innerHTML=metricRows.map(x=>'<div class="metric"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></div>').join('');

      const shDone=doneSymbols(jobs,'historical_backfill','shares');
      const shQ=countJobs(jobs,'historical_backfill','shares',['queued','running']);
      const shF=countJobs(jobs,'historical_backfill','shares',['failed']);
      const fuDone=doneSymbols(jobs,'historical_backfill','forts');
      const fuQ=countJobs(jobs,'historical_backfill','forts',['queued','running']);
      const fuF=countJobs(jobs,'historical_backfill','forts',['failed']);
      const fmDone=doneSymbols(jobs,'derivative_metric_backfill','forts');
      const fmQ=countJobs(jobs,'derivative_metric_backfill','forts',['queued','running']);
      const fmF=countJobs(jobs,'derivative_metric_backfill','forts',['failed']);

      $('#moexCoverage').innerHTML=[
        coverageRow('Живой рынок MOEX',src&&src.status==='ok'?'РАБОТАЕТ':statusRu(src&&src.status),(m.count||quotes.length)+' инструментов · акции '+(counts.shares||0)+' · фьючерсы '+(counts.forts||0),src&&src.status==='ok'?'good':'warn'),
        coverageRow('История акций',shDone+' из '+(counts.shares||0),'готово '+shDone+' · очередь/работа '+shQ+' · ошибок '+shF+' · цель: весь доступный universe с 2021',shF?'warn':shDone?'good':''),
        coverageRow('История фьючерсов',fuDone+' из '+(counts.forts||0),'готово '+fuDone+' · очередь/работа '+fuQ+' · ошибок '+fuF+' · цель: весь FORTS с 2021',fuF?'warn':fuDone?'good':''),
        coverageRow('FUTOI физлица / юрлица',fmDone?(fmDone+' корней'):'НЕТ ГОТОВЫХ','очередь/работа '+fmQ+' · ошибок '+fmF+' · задержка/лицензия сохраняются в provenance',fmF?'warn':fmDone?'good':''),
        coverageRow('ЛЧИ 2026 — публичные участники','ПОДКЛЮЧАЕМ','автообнаружение → позиции → сделки → изменения → маркеры на графике','plan'),
        coverageRow('Т‑Банк Пульс — публичные профили','ПЛАН','состав/сделки доступны частично; точный размер операции скрыт и не будет выдумываться','plan'),
        coverageRow('Новости / события',(o.news_count||0)+' сейчас','официальные MOEX/эмитенты/ЦБ + выбранные новости будут отдельными источниками','plan')
      ].join('');

      const sourceRows=[
        ['БИРЖА','MOEX ISS','котировки, оборот, статус торгов, свечи, OI где доступно','good'],
        ['АГРЕГАТ','MOEX FUTOI','физлица/юрлица long/short и число участников; задержка/лицензия обязательны',fmDone?'good':'warn'],
        ['ПУБЛИЧНЫЙ СЧЁТ','ЛЧИ 2026','позиции, количество, средняя цена, P&L и сделки — только опубликованные данные','plan'],
        ['ПУБЛИЧНЫЙ ПРОФИЛЬ','Пульс','состав и недавние сделки; размер операции скрыт','plan']
      ];
      $('#moexParticipantSources').innerHTML=sourceRows.map(x=>'<div class="participantSource '+x[3]+'"><span>'+esc(x[0])+'</span><div><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></div></div>').join('');

      const mj=jobs.filter(j=>provider(j)==='moex'||/MOEX|FUTOI/i.test(j.title_ru||j.title||'')).slice(0,80);
      if(mj.length){
        $('#moexJobs').innerHTML='<table class="table"><thead><tr><th>Что делает</th><th>Данные</th><th>Статус</th><th>Прогресс</th></tr></thead><tbody>'+
          mj.map(j=>{
            const kind=j.kind==='historical_backfill'?'История свечей':j.kind==='derivative_metric_backfill'?'OI / FUTOI':'Исследование';
            const progress=Math.round(Math.max(0,Math.min(1,Number(j.progress||0)))*100);
            const err=j.error?'<small class="down">'+esc(String(j.error).split('\n')[0].slice(0,130))+'</small>':'';
            return '<tr><td><b>'+esc(j.title_ru||j.title||j.id)+'</b>'+err+'</td><td>'+esc(kind)+'</td><td>'+esc(statusRu(j.status))+'</td><td>'+progress+'%</td></tr>';
          }).join('')+'</tbody></table>';
      }else{
        $('#moexJobs').innerHTML='<div class="empty"><b>MOEX-задач в журнале пока нет.</b>В режиме МАКС автопилот создаёт их сам.</div>';
      }

      $('#moexStocks').innerHTML=table(m.top_stocks||[],false);
      $('#moexFutures').innerHTML=table(m.top_futures||[],true);
      $$('.moexInstrument').forEach(r=>r.onclick=()=>openInstrument(r.dataset.cid));
      $$('[data-moex-symbol]').forEach(b=>b.onclick=()=>{setView('instrument');$('#instrumentSearch').value=b.dataset.moexSymbol;searchInstrument(b.dataset.moexSymbol)});
    }catch(e){
      toast('Мосбиржа: '+esc(e.message),10000);
    }
  }
  window.loadMoex=loadMoex;
})();