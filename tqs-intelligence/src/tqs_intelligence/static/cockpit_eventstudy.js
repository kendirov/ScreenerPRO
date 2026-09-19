(()=>{
  const baseRenderInstrument=renderInstrument;
  function median(values){const a=values.filter(x=>Number.isFinite(Number(x))).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function mean(values){const a=values.filter(x=>Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
  function share(values,pred){const a=values.filter(x=>Number.isFinite(Number(x))).map(Number);return a.length?a.filter(pred).length/a.length*100:null}
  function outcomes(){return (state.instrument?.episodes||[]).map(x=>({episode:x.episode||{},outcome:x.outcome||{}})).filter(x=>x.outcome&&Object.keys(x.outcome.returns_pct||{}).length)}
  function valFor(x,key){const v=x.outcome?.returns_pct?.[key];return v==null?null:Number(v)}
  function horizonStats(rows,key){const vals=rows.map(x=>valFor(x,key)).filter(Number.isFinite);return {n:vals.length,median:median(vals),medianAbs:median(vals.map(Math.abs)),positive:share(vals,x=>x>0),negative:share(vals,x=>x<0),mean:mean(vals)}}
  function patternCards(rows){
    const groups={};for(const x of rows){const key=x.episode.pattern_key||'unknown';(groups[key]??=[]).push(x)}
    return Object.entries(groups).sort((a,b)=>b[1].length-a[1].length).slice(0,6).map(([key,g])=>{const h=horizonStats(g,'1h'),mfe=median(g.map(x=>x.outcome.mfe_pct)),mae=median(g.map(x=>x.outcome.mae_pct));return `<div class="patternCard"><b>${esc(key)}</b><small>N ${g.length} · 1ч median ${h.median==null?'—':num(h.median,2)+'%'} · +share ${h.positive==null?'—':num(h.positive,0)+'%'}<br>MFE ${mfe==null?'—':num(mfe,2)+'%'} · MAE ${mae==null?'—':num(mae,2)+'%'}</small></div>`}).join('')
  }
  function renderEventStudy(){
    const rows=outcomes();$('#instrumentEventStudy')?.remove();if(!state.instrument)return;
    const complete=rows.filter(x=>x.outcome.complete),base=complete.length?complete:rows;
    const mfe=median(base.map(x=>x.outcome.mfe_pct)),mae=median(base.map(x=>x.outcome.mae_pct));
    const opened=base.map(x=>Number(x.episode.opened_at_ms||0)).filter(Boolean);const span=opened.length>1?(Math.max(...opened)-Math.min(...opened))/86400_000:0;
    const horizons=[['5м','5m'],['15м','15m'],['1ч','1h'],['4ч','4h'],['24ч','24h']];
    const cards=horizons.map(([label,key])=>{const s=horizonStats(base,key);return `<div class="horizonCard"><strong>${label}</strong><div class="row"><span>N</span><b>${s.n}</b></div><div class="row"><span>median return</span><b class="${Number(s.median)>0?'up':Number(s.median)<0?'down':''}">${s.median==null?'—':`${s.median>0?'+':''}${num(s.median,2)}%`}</b></div><div class="row"><span>median |move|</span><b>${s.medianAbs==null?'—':num(s.medianAbs,2)+'%'}</b></div><div class="row"><span>выше / ниже</span><b>${s.positive==null?'—':num(s.positive,0)+' / '+num(s.negative,0)+'%'}</b></div></div>`}).join('');
    const html=`<div id="instrumentEventStudy" class="panel eventStudy"><div class="panelHead"><div><b>История после аномалий</b><small>описательный event study по сохранённым эпизодам этого venue-инструмента</small></div><span class="historyLimit">не торговый сигнал</span></div>${base.length?`<div class="eventStudySummary"><div class="eventStudyKpi"><span>СЛУЧАЕВ</span><b>${base.length}</b></div><div class="eventStudyKpi"><span>ПЕРИОД ВЫБОРКИ</span><b>${span?num(span,0)+' дн.':'—'}</b></div><div class="eventStudyKpi"><span>MEDIAN MFE</span><b class="up">${mfe==null?'—':num(mfe,2)+'%'}</b></div><div class="eventStudyKpi"><span>MEDIAN MAE</span><b class="down">${mae==null?'—':num(mae,2)+'%'}</b></div></div><div class="horizonGrid">${cards}</div><div class="patternGrid">${patternCards(base)}</div><div class="eventStudyNote">Знак return — фактическое изменение цены после события, а не LONG/SHORT рекомендация. Доля «выше/ниже» показывает направление последующего движения без подгонки под текущую историю. Для вывода об edge нужны controls, OOS/walk-forward, режимы ликвидности и costs.</div>`:`<div class="empty"><b>Недостаточно завершённых эпизодов.</b>TQS будет заполнять этот блок по мере накопления outcome-истории.</div>`}</div>`;
    const related=$('#relatedTable')?.closest('.panel');if(related)related.insertAdjacentHTML('beforebegin',html);else $('#instrumentWorkspace').insertAdjacentHTML('beforeend',html);
  }
  renderInstrument=function(){baseRenderInstrument();renderEventStudy()};
})();
