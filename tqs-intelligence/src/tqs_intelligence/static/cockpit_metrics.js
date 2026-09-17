(()=>{
  const baseRenderRelated=renderRelated;
  const baseRenderCoverage=renderCoverage;
  const baseRenderCharts=renderCharts;

  function metricRows(name){return state.instrument?.metrics?.[name]||[]}
  function latest(name){const x=metricRows(name);return x.length?x[x.length-1]:null}
  function lineData(name,mult=1){return metricRows(name).filter(x=>x.ts_ms&&x.value!=null).map(x=>({time:Math.floor(Number(x.ts_ms)/1000),value:Number(x.value)*mult}))}

  renderCoverage=function(){
    baseRenderCoverage();
    const d=state.instrument,c=d?.coverage||{},box=$('#backfillBox');
    if(!box)return;
    const hist=[];
    if(c.historical_oi_points)hist.push(`OI: ${compact(c.historical_oi_points)} точек`);
    if(c.historical_funding_points)hist.push(`funding: ${compact(c.historical_funding_points)} точек`);
    if(c.participant_metric_points)hist.push(`FUTOI: ${compact(c.participant_metric_points)} точек`);
    if(hist.length)box.insertAdjacentHTML('beforeend',`<div class="participantNote">Metric Lake · ${esc(hist.join(' · '))}</div>`);
    if(d?.suggested_metrics_backfill && !d?.suggested_backfill){
      const p=d.suggested_metrics_backfill;
      box.insertAdjacentHTML('beforeend',`<div class="coverageAction"><button id="metricBackfillNow" class="btn small">Дозагрузить derivative context через ${esc(String(p.provider).toUpperCase())}</button></div>`);
      $('#metricBackfillNow').onclick=async()=>{
        try{
          if(p.provider==='binance'){
            const payload={provider:'binance',symbol:p.symbol,market_type:'usdt-futures',interval:'5m',start_ms:p.start_ms};
            const r=await api('/api/backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
            toast(`Derivatives поставлены в очередь: ${esc(r.title||r.id||'job')}`);
          }
        }catch(e){toast('Metrics: '+esc(e.message))}
      };
    }
  };

  renderRelated=function(){
    const rows=(state.instrument?.venue_context||state.instrument?.related||[]).slice(0,40),target=$('#relatedTable');
    if(!target)return;
    target.innerHTML=rows.length?`<table class="table"><thead><tr><th>Инструмент</th><th>Площадка</th><th>Тип</th><th>Цена</th><th>Δ venue</th><th>24ч</th><th>Funding</th><th>OI</th><th>Оборот</th></tr></thead><tbody>${rows.map(x=>`<tr class="click relatedRow" data-cid="${esc(x.canonical_id)}"><td><b>${esc(x.display_symbol||x.symbol)}</b></td><td>${esc(x.venue||x.provider)}</td><td>${esc(x.market_type)}</td><td>${num(x.last,6)}</td><td class="venueDeviation ${Number(x.venue_deviation_bps)>0?'up':Number(x.venue_deviation_bps)<0?'down':''}">${x.venue_deviation_bps==null?'—':`${Number(x.venue_deviation_bps)>0?'+':''}${num(x.venue_deviation_bps,1)} bp`}</td><td>${pct(x.change_24h_pct)}</td><td>${x.funding_rate==null?'—':pct(Number(x.funding_rate)*100,4)}</td><td>${compact(x.open_interest)}</td><td>${compact(x.turnover_24h)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Экономически связанные инструменты пока не найдены.</div>';
    $$('.relatedRow').forEach(r=>r.onclick=()=>openInstrument(r.dataset.cid));
  };

  function addMetricPanel(){
    const d=state.instrument;if(!d)return null;
    const hasCrypto=['open_interest','funding_rate','basis_rate'].some(k=>metricRows(k).length);
    const hasFutoi=Object.keys(d.metrics||{}).some(k=>k.startsWith('futoi_'));
    if(!hasCrypto&&!hasFutoi)return null;
    const existing=$('#metricHistoryPanel');if(existing)existing.remove();
    const workspace=$('#instrumentWorkspace');
    const html=`<div id="metricHistoryPanel" class="panel" style="margin-top:10px"><div class="panelHead"><div><b>Derivative / participant history</b><small>канонические ряды Metric Lake · синхронизируются с ценой по времени</small></div><div>${hasFutoi?'<span class="delayPill">MOEX public: delayed 15d</span>':''}${hasCrypto?'<span class="historyLimit" style="margin-left:5px">Binance OI/basis: latest 1 month</span>':''}</div></div><div class="panelBody">${hasFutoi?participantSummary():''}<div class="derivativeGrid">${hasCrypto?'<div class="derivativePane"><div class="derivativePaneHead"><b>Open Interest</b><span>official history</span></div><div id="histOi" class="derivativeChart"></div></div><div class="derivativePane"><div class="derivativePaneHead"><b>Funding</b><span>% per funding event</span></div><div id="histFunding" class="derivativeChart"></div></div><div class="derivativePane"><div class="derivativePaneHead"><b>Basis</b><span>perpetual vs index</span></div><div id="histBasis" class="derivativeChart"></div></div>':''}${hasFutoi?'<div class="derivativePane" style="grid-column:1/-1"><div class="derivativePaneHead"><b>MOEX FUTOI · направленная позиция</b><span class="metricLegend"><span><i class="fiz"></i>физлица</span><span><i class="yur"></i>юрлица</span></span></div><div id="histFutoi" class="derivativeChart"></div></div>':''}</div></div></div>`;
    workspace.insertAdjacentHTML('beforeend',html);return {hasCrypto,hasFutoi};
  }

  function participantSummary(){
    const p=state.instrument?.participant_context||{};
    const val=k=>p[k]?.value;
    const when=p.futoi_fiz_long_contracts?.ts_ms||p.futoi_yur_long_contracts?.ts_ms;
    return `<div class="participantStrip"><div class="participantCell"><span>ФИЗ · LONG / SHORT</span><b><span class="sideLong">${compact(val('futoi_fiz_long_contracts'))}</span> / <span class="sideShort">${compact(val('futoi_fiz_short_contracts'))}</span></b></div><div class="participantCell"><span>ФИЗ · NET</span><b class="${Number(val('futoi_fiz_net_contracts'))>=0?'sideLong':'sideShort'}">${compact(val('futoi_fiz_net_contracts'))}</b></div><div class="participantCell"><span>ЮР · LONG / SHORT</span><b><span class="sideLong">${compact(val('futoi_yur_long_contracts'))}</span> / <span class="sideShort">${compact(val('futoi_yur_short_contracts'))}</span></b></div><div class="participantCell"><span>ЮР · NET</span><b class="${Number(val('futoi_yur_net_contracts'))>=0?'sideLong':'sideShort'}">${compact(val('futoi_yur_net_contracts'))}</b></div></div><div class="participantStrip"><div class="participantCell"><span>ФИЗ лиц LONG</span><b>${compact(val('futoi_fiz_long_accounts'))}</b></div><div class="participantCell"><span>ФИЗ лиц SHORT</span><b>${compact(val('futoi_fiz_short_accounts'))}</b></div><div class="participantCell"><span>ЮР лиц LONG</span><b>${compact(val('futoi_yur_long_accounts'))}</b></div><div class="participantCell"><span>ЮР лиц SHORT</span><b>${compact(val('futoi_yur_short_accounts'))}</b></div></div><div class="participantNote">Последний доступный public snapshot: ${ts(when,true)}. FUTOI агрегирует все активные серии одного базового инструмента; public ISS без авторизации задержан на 15 дней.</div>`;
  }

  function oneLineChart(id,data,color,formatter=null){
    const el=$('#'+id);if(!el)return;if(!data.length){el.innerHTML='<div class="empty">Ряд пока не загружен.</div>';return}
    const c=chartBase(el,180),s=addSeries(c,'LineSeries',{color,lineWidth:2,crosshairMarkerVisible:false,priceFormat:formatter||undefined});s.setData(data);c.timeScale().fitContent();
  }
  function futoiChart(){
    const el=$('#histFutoi');if(!el)return;const fiz=lineData('futoi_fiz_net_contracts'),yur=lineData('futoi_yur_net_contracts');
    if(!fiz.length&&!yur.length){el.innerHTML='<div class="empty">FUTOI ещё не загружен.</div>';return}
    const c=chartBase(el,180);
    if(fiz.length)addSeries(c,'LineSeries',{color:COLORS.green,lineWidth:2,crosshairMarkerVisible:false}).setData(fiz);
    if(yur.length)addSeries(c,'LineSeries',{color:COLORS.red,lineWidth:2,crosshairMarkerVisible:false}).setData(yur);
    c.timeScale().fitContent();
  }
  function renderMetricHistory(){
    const flags=addMetricPanel();if(!flags)return;
    if(flags.hasCrypto){
      oneLineChart('histOi',lineData('open_interest_value').length?lineData('open_interest_value'):lineData('open_interest'),COLORS.amber);
      oneLineChart('histFunding',lineData('funding_rate',100),COLORS.violet,{type:'price',precision:5,minMove:0.00001});
      oneLineChart('histBasis',lineData('basis_rate',100),COLORS.blue,{type:'price',precision:4,minMove:0.0001});
    }
    if(flags.hasFutoi)futoiChart();
  }

  renderCharts=function(){baseRenderCharts();renderMetricHistory()};
})();
