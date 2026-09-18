(()=>{
  let participantQuery='';
  let symbolQuery='';

  const pMetric=(a,b,c)=>'<div class="metric"><span>'+esc(a)+'</span><b>'+esc(b)+'</b><small>'+esc(c||'')+'</small></div>';

  async function loadParticipants(){
    try{
      const [status,participants,pulseStatus,pulseProfiles]=await Promise.all([
        api('/api/moex/participants/lchi/status'),
        api('/api/moex/participants/lchi?limit=200'+(participantQuery?'&q='+encodeURIComponent(participantQuery):'')),
        api('/api/moex/participants/pulse/status'),
        api('/api/moex/participants/pulse?limit=200')
      ]);
      $('#participantMetrics').innerHTML=[
        pMetric('ЛЧИ найдено',compact(status.participants_discovered||0),'публичный каталог'),
        pMetric('Портфели прочитаны',compact(status.participants_with_portfolio||0),'публичные снимки'),
        pMetric('Изменений позиции',compact(status.position_events||0),'между наблюдениями TQS'),
        pMetric('Точных сделок ЛЧИ',compact(status.public_trades||0),(status.participants_with_trades||0)+' участников · CSV public history'),
        pMetric('Каталог',status.catalog_pages_total?((status.catalog_page||0)+' / '+status.catalog_pages_total):'запуск','страницы по 20 участников'),
        pMetric('Сбор',status.running?'Работает':'Ожидает',status.last_action||''),
        pMetric('Качество','Публичный счёт','ЛЧИ ≠ FUTOI ≠ Пульс')
      ].join('');
      renderParticipantList(participants);
      renderPulse(pulseStatus,pulseProfiles);
      if(symbolQuery)await loadSymbolPositions(symbolQuery);
    }catch(e){
      toast('Участники: '+esc(e.message),10000);
    }
  }

  function renderParticipantList(rows){
    const box=$('#lchiParticipants');
    if(!rows.length){box.innerHTML='<div class="empty">В локальном каталоге пока нет совпадений.</div>';return}
    box.innerHTML='<table class="table"><thead><tr><th>Участник</th><th>Брокер</th><th>Ранг</th><th>Доходность</th><th>Сделок</th><th>Портфель</th></tr></thead><tbody>'+
      rows.map(p=>'<tr class="click lchiAccount" data-user="'+esc(p.user_id)+'"><td><b>'+esc(p.login||p.user_id)+'</b><small>'+esc(p.user_id)+'</small></td><td>'+esc(p.broker_code||'—')+'</td><td>'+num(p.ranking,0)+'</td><td>'+pct(p.total_yield,2)+'</td><td>'+compact(p.total_deals)+'</td><td>'+compact(p.total_start_assets)+'</td></tr>').join('')+
      '</tbody></table>';
    $$('.lchiAccount').forEach(r=>r.onclick=()=>openParticipant(r.dataset.user));
  }

  async function loadSymbolPositions(symbol){
    symbolQuery=String(symbol||'').trim();
    const box=$('#lchiSymbolPositions');
    if(!symbolQuery){box.innerHTML='<div class="empty">Введи SBER, BR, Si или конкретный контракт.</div>';return}
    box.innerHTML='<div class="empty">Ищу публичные позиции ЛЧИ…</div>';
    try{
      const rows=await api('/api/moex/participants/lchi/positions?symbol='+encodeURIComponent(symbolQuery)+'&limit=1000');
      if(!rows.length){box.innerHTML='<div class="empty"><b>Пока нет наблюдаемых позиций.</b>Это означает только отсутствие в уже прочитанных публичных портфелях, а не отсутствие позиций на рынке.</div>';return}
      const long=rows.filter(x=>Number(x.quantity||0)>0),short=rows.filter(x=>Number(x.quantity||0)<0);
      box.innerHTML='<div class="participantInstrumentSummary"><span>Наблюдаемых счетов <b>'+rows.length+'</b></span><span>LONG <b class="sideLong">'+long.length+'</b></span><span>SHORT <b class="sideShort">'+short.length+'</b></span></div>'+
        '<table class="table"><thead><tr><th>Участник</th><th>Инструмент</th><th>Направление</th><th>Количество</th><th>Публичная цена</th><th>Оценка</th><th>Наблюдал TQS</th></tr></thead><tbody>'+
        rows.map(p=>{const qty=Number(p.quantity||0);return '<tr class="click lchiAccount" data-user="'+esc(p.user_id)+'"><td><b>'+esc(p.login||p.user_id)+'</b><small>'+esc(p.broker_code||'')+' · rank '+(p.ranking??'—')+'</small></td><td><b>'+esc(p.seccode)+'</b></td><td><b class="'+(qty>=0?'sideLong':'sideShort')+'">'+(qty>=0?'LONG':'SHORT')+'</b></td><td>'+num(Math.abs(qty),2)+'</td><td>'+num(p.price,4)+'</td><td>'+compact(p.estimated_value)+'</td><td>'+ts(p.observed_at_ms,true)+'</td></tr>'}).join('')+
        '</tbody></table>';
      $$('#lchiSymbolPositions .lchiAccount').forEach(r=>r.onclick=()=>openParticipant(r.dataset.user));
    }catch(e){box.innerHTML='<div class="empty">Ошибка: '+esc(e.message)+'</div>'}
  }

  async function openParticipant(userId){
    const box=$('#lchiAccountDetail');box.innerHTML='<div class="empty">Загружаю публичный профиль…</div>';
    try{
      const [d,trades]=await Promise.all([
        api('/api/moex/participants/lchi/account/'+encodeURIComponent(userId)),
        api('/api/moex/participants/lchi/trades?user_id='+encodeURIComponent(userId)+'&limit=500')
      ]);
      const p=d.participant||{},positions=d.positions||[],events=d.events||[];
      box.innerHTML='<div class="participantHeader"><div><span class="eyebrow">ПУБЛИЧНЫЙ СЧЁТ · ЛЧИ</span><h3>'+esc(p.login||p.user_id)+'</h3><small>'+esc(p.broker_code||'')+' · ранг '+(p.ranking??'—')+' · доходность '+num(p.total_yield,2)+'% · сделок '+compact(p.total_deals)+'</small></div><a class="btn small" target="_blank" rel="noopener" href="'+esc(p.source_url||'#')+'">Источник</a></div>'+
        '<div class="participantCaution">Это публичное наблюдение конкурса. TQS не приписывает участнику мотивы. Изменения портфеля имеют время наблюдения TQS; строки «Точные сделки» ниже используют публичный CSV конкурса и его время сделки.</div><div style="margin:8px 0"><button class="btn small lchiSyncTrades" data-user="'+esc(userId)+'">Обновить публичные сделки</button></div>'+
        '<h4>Текущие наблюдаемые позиции</h4>'+
        (positions.length?'<div class="positionRows">'+positions.map(x=>{const qty=Number(x.quantity||0);return '<div class="positionRow click participantPosition" data-symbol="'+esc(x.seccode)+'"><div class="acct"><b>'+esc(x.seccode)+'</b><small>'+esc(x.market||'')+' · '+ts(x.observed_at_ms,true)+'</small></div><b class="'+(qty>=0?'sideLong':'sideShort')+'">'+(qty>=0?'LONG':'SHORT')+'</b><span>'+num(Math.abs(qty),2)+' шт.</span><span>@ '+num(x.price,4)+'</span><span>'+compact(x.estimated_value)+'</span></div>'}).join('')+'</div>':'<div class="empty">Открытых позиций в последнем публичном snapshot нет.</div>')+
        '<h4>Точные публичные сделки</h4>'+
        (trades.length?'<div class="participantEvents">'+trades.slice(0,150).map(t=>'<div><time>'+ts(t.ts_ms,true)+'</time><b>'+esc(t.seccode)+' · '+esc(String(t.side||'').toUpperCase())+'</b><span>'+num(t.quantity,2)+' @ '+num(t.price,4)+' · public CSV</span></div>').join('')+'</div>':'<div class="empty">Точные сделки ещё не скачаны. В режиме МАКС TQS постепенно делает это автоматически; кнопку выше можно использовать для этого участника сейчас.</div>')+
        '<h4>Изменения портфеля, которые увидел TQS</h4>'+
        (events.length?'<div class="participantEvents">'+events.slice(0,100).map(e=>'<div><time>'+ts(e.ts_ms,true)+'</time><b>'+esc(e.seccode)+' · '+esc(e.event_type)+'</b><span>'+num(e.previous_qty,2)+' → '+num(e.current_qty,2)+' · Δ '+num(e.delta_qty,2)+'</span></div>').join('')+'</div>':'<div class="empty">Для истории изменений нужно минимум два наблюдения.</div>');
      $$('.participantPosition').forEach(r=>r.onclick=()=>{setView('instrument');$('#instrumentSearch').value=r.dataset.symbol;searchInstrument(r.dataset.symbol)});
      $$('.lchiSyncTrades').forEach(b=>b.onclick=async()=>{try{toast('ЛЧИ: готовлю публичный CSV сделок…');await api('/api/moex/participants/lchi/account/'+encodeURIComponent(b.dataset.user)+'/trades/sync',{method:'POST'});toast('ЛЧИ: сделки обновлены');openParticipant(b.dataset.user)}catch(e){toast('ЛЧИ сделки: '+esc(e.message),10000)}});
    }catch(e){box.innerHTML='<div class="empty">Не удалось открыть участника: '+esc(e.message)+'</div>'}
  }


  function renderPulse(status,rows){
    const s=$('#pulseStatus'),box=$('#pulseProfiles');
    if(s)s.innerHTML='<div class="participantInstrumentSummary"><span>Профилей <b>'+compact(status.profiles_tracked||0)+'</b></span><span>Синхронизировано <b>'+compact(status.profiles_synced||0)+'</b></span><span>Публичных операций <b>'+compact(status.events||0)+'</b></span><span>Сбор <b>'+(status.running?'работает':'ожидает')+'</b></span></div><div class="participantCaution">Пульс — более слабый уровень доказательности, чем ЛЧИ: если количество операции скрыто, TQS хранит только факт/направление/время/цену, которые реально доступны, и size_known=false.</div>';
    if(!box)return;
    box.innerHTML=(rows||[]).length?'<table class="table"><thead><tr><th>Профиль</th><th>Подписчики</th><th>Посты</th><th>Последняя синхронизация</th><th>Состояние</th></tr></thead><tbody>'+rows.map(p=>'<tr><td><b>'+esc(p.display_name||p.handle)+'</b><small>@'+esc(p.handle)+'</small></td><td>'+compact(p.followers)+'</td><td>'+compact(p.posts_count)+'</td><td>'+ts(p.last_sync_ms,true)+'</td><td>'+(p.last_error?'<span class="down">'+esc(String(p.last_error).slice(0,90))+'</span>':'публичный профиль')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty"><b>Профили Пульса пока не добавлены.</b>Добавь публичный ник справа. Это вторичный ручной вход; позже discovery можно расширить отдельным публичным каталогом, если источник его даст.</div>';
  }

  async function trackPulse(){
    const input=$('#pulseHandle'),handle=String(input?.value||'').trim().replace(/^@/,'');
    if(!handle)return;
    try{
      const r=await api('/api/moex/participants/pulse/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle})});
      toast(r.ok?'Пульс: профиль синхронизирован':'Пульс: профиль добавлен, но источник вернул ошибку',9000);
      if(input)input.value='';
      loadParticipants();
    }catch(e){toast('Пульс: '+esc(e.message),10000)}
  }

  function wireParticipants(){
    const find=$('#participantFind'),input=$('#participantSearch'),sf=$('#participantSymbolFind'),si=$('#participantSymbol'),pulse=$('#pulseTrack'),pulseInput=$('#pulseHandle');
    if(find)find.onclick=()=>{participantQuery=input.value.trim();loadParticipants()};
    if(input)input.addEventListener('keydown',e=>{if(e.key==='Enter'){participantQuery=input.value.trim();loadParticipants()}});
    if(sf)sf.onclick=()=>loadSymbolPositions(si.value);
    if(si)si.addEventListener('keydown',e=>{if(e.key==='Enter')loadSymbolPositions(si.value)});
    if(pulse)pulse.onclick=trackPulse;
    if(pulseInput)pulseInput.addEventListener('keydown',e=>{if(e.key==='Enter')trackPulse()});
  }

  window.loadParticipants=loadParticipants;
  setTimeout(wireParticipants,0);
})();