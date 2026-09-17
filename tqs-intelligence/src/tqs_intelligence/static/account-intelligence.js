(()=>{
const nav=document.getElementById('accountNav');
if(!nav)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>v===null||v===undefined||Number.isNaN(Number(v))?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d});
const pct=v=>v===null||v===undefined?'—':num(Number(v)*100,1)+'%';
async function api(url,opt={}){const r=await fetch(url,opt);if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json()}
function openView(){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='accounts'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===nav));
  const title=document.getElementById('pageTitle'); if(title)title.textContent='Счета / позиции';
  const sub=document.getElementById('pageSub'); if(sub)sub.textContent='Публичные позиции, fills и поведенческие профили. MOEX participant layer подключается отдельно.';
  load();
}
function profileCard(p){
  return `<div class="list-item account-profile click" data-source="${esc(p.source)}" data-account="${esc(p.account_id)}">
    <strong>${esc(p.label||p.account_id.slice(0,10)+'…')}</strong>
    <span class="sub mono">${esc(p.source)} · ${esc(p.account_id)}</span>
    <div class="row"><span class="tag">fills ${num(p.fills,0)}</span><span class="tag">позиции ${num(p.open_positions,0)}</span><span class="tag">win ${pct(p.realized_win_rate)}</span><span class="tag">taker ${pct(p.taker_share)}</span></div>
    <div class="sub">${(p.signatures||[]).map(esc).join(' · ')||'Профиль ещё накапливается'}</div>
  </div>`;
}
async function load(){
  try{
    const [a,p]=await Promise.all([api('/api/accounts'),api('/api/accounts/positions?limit=500')]);
    const s=a.status||{};
    document.getElementById('accTracked').textContent=num(s.tracked_accounts,0);
    document.getElementById('accPositions').textContent=num(s.open_positions,0);
    document.getElementById('accFills').textContent=num(s.fills,0);
    document.getElementById('accSync').textContent=num(s.sync_count,0);
    document.getElementById('accountStatus').textContent=s.last_action||'Ожидание';
    document.getElementById('accountProfiles').innerHTML=(a.profiles||[]).map(profileCard).join('')||'<div class="empty">Добавь публичный Hyperliquid-адрес. История fills и открытых позиций начнёт накапливаться автоматически.</div>';
    document.getElementById('accountPositions').innerHTML=p.length?`<table class="table"><thead><tr><th>Счёт</th><th>Инструмент</th><th>Сторона</th><th>Размер</th><th>Вход</th><th>Notional</th><th>uPnL</th><th>Плечо</th><th>Ликвидация</th></tr></thead><tbody>${p.map(x=>`<tr><td class="mono">${esc(String(x.account_id).slice(0,10))}…</td><td><b>${esc(x.symbol)}</b></td><td class="${x.side==='long'?'up':'down'}">${esc(x.side)}</td><td>${num(x.size,4)}</td><td>${num(x.entry_price,6)}</td><td>${num(x.notional,0)}</td><td>${num(x.unrealized_pnl,2)}</td><td>${num(x.leverage,1)}x</td><td>${num(x.liquidation_price,6)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Открытых позиций пока нет.</div>';
  }catch(err){document.getElementById('accountStatus').textContent='Ошибка: '+err.message}
}
nav.addEventListener('click',openView);
document.getElementById('accountReload')?.addEventListener('click',load);
document.getElementById('accountTrackForm')?.addEventListener('submit',async ev=>{
  ev.preventDefault(); const fd=new FormData(ev.target); const payload={source:'hyperliquid',account_id:String(fd.get('account_id')||'').trim(),label:String(fd.get('label')||'').trim()};
  const out=document.getElementById('accountTrackResult'); out.textContent='Добавляю и синхронизирую…';
  try{const r=await api('/api/accounts/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});out.textContent=r.sync?.ok?'Добавлено. История синхронизирована.':'Добавлено, но первый sync не прошёл: '+(r.sync?.error||'unknown');await load()}catch(err){out.textContent='Ошибка: '+err.message}
});
document.getElementById('accountProfiles')?.addEventListener('click',async ev=>{
  const row=ev.target.closest('.account-profile'); if(!row)return; const box=document.getElementById('accountDetail');box.innerHTML='<div class="empty">Загрузка профиля…</div>';
  try{const d=await api(`/api/accounts/${encodeURIComponent(row.dataset.source)}/${encodeURIComponent(row.dataset.account)}/profile`),p=d.profile||{};box.innerHTML=`<div class="panel-head"><b>${esc(p.label||p.account_id)}</b><button class="btn" id="syncOne">Синхронизировать сейчас</button></div><div class="panel-body"><div class="grid3"><div><span class="sub">LONG notional</span><h2>${num(p.open_long_notional,0)}</h2></div><div><span class="sub">SHORT notional</span><h2>${num(p.open_short_notional,0)}</h2></div><div><span class="sub">Realized PnL samples</span><h2>${num(p.realized_samples,0)}</h2></div></div><div class="sep"></div><b>Что видно по поведению</b><div>${(p.signatures||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')||'<span class="muted">Пока мало данных</span>'}</div><div class="sep"></div><b>Топ инструментов</b><div>${(p.top_instruments||[]).map(x=>`<div class="list-item"><strong>${esc(x.symbol)}</strong><span>${pct(x.share)} потока</span></div>`).join('')}</div><div class="sep"></div><div class="callout">${(p.limits_ru||[]).map(esc).join('<br>')}</div></div>`;document.getElementById('syncOne')?.addEventListener('click',async()=>{await api(`/api/accounts/${encodeURIComponent(row.dataset.source)}/${encodeURIComponent(row.dataset.account)}/sync`,{method:'POST'});await load()})}catch(err){box.innerHTML='<div class="empty">'+esc(err.message)+'</div>'}
});
})();
