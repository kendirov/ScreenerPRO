"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BatteryCharging, Camera, ChevronRight, CircleDot,
  Clock3, Command, Fan, Gamepad2, Gauge, Home, Laptop, LogOut, Monitor,
  Play, Power, RefreshCw, Router, Send, Server, ShieldCheck, Smartphone,
  Sparkles, Speaker, Square, Wifi
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type NodeRow = {
  id:string; family_id:string; child_id:string|null; node_key:string; display_name:string;
  node_type:string; platform:string; role:string; transport:string|null;
  expected_agent_version:string|null; metadata:Record<string,unknown>;
};
type Beat = {
  id:number; node_id:string; occurred_at:string; received_at:string; state:string;
  transport_online:boolean|null; agent_online:boolean|null; agent_version:string|null;
  current_app:string|null; payload:Record<string,unknown>;
};
type Usage = { node_id:string; local_date:string; app_id:string; app_name:string; category:string; seconds:number };
type Cmd = { id:string; node_id:string; command_type:string; status:string; created_at:string; result:Record<string,unknown> };
type Family = { id:string; name:string; timezone:string };
type Integration = {
  id:string; family_id:string; host_node_id:string|null; integration_key:string; display_name:string;
  provider:string; integration_type:string; state:string; capabilities:string[]; metadata:Record<string,unknown>;
  last_seen_at:string|null;
};
type Entity = {
  id:string; family_id:string; integration_id:string; entity_key:string; display_name:string;
  domain:string; room:string|null; provider:string|null; model:string|null; available:boolean|null;
  capabilities:string[]; metadata:Record<string,unknown>;
};
type EntityState = {
  id:number; entity_id:string; occurred_at:string; state:string; available:boolean|null;
  attributes:Record<string,unknown>; source:string; quality:string;
};
type EntityCmd = {
  id:string; entity_id:string; action:string; status:string; created_at:string; result:Record<string,unknown>;
};
type View = "overview" | "devices" | "activity" | "home" | "commands";

const fmt=(s:number)=>{
  if(!s) return "0 мин";
  const h=Math.floor(s/3600),m=Math.round((s%3600)/60);
  return h?`${h}ч ${m}м`:`${m} мин`;
};
const ago=(iso?:string|null)=>{
  if(!iso) return "нет данных";
  const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));
  if(sec<60) return `${sec} сек назад`;
  if(sec<3600) return `${Math.floor(sec/60)} мин назад`;
  if(sec<86400) return `${Math.floor(sec/3600)} ч назад`;
  return `${Math.floor(sec/86400)} дн назад`;
};
const stateLabel:Record<string,string>={
  ONLINE:"ONLINE",TRANSPORT_ONLY:"ТРАНСПОРТ",OFFLINE:"OFFLINE",UNKNOWN:"НЕИЗВЕСТНО",
  DEGRADED:"DEGRADED",DEFERRED:"ОТЛОЖЕНО"
};
const iconFor=(n:NodeRow)=>n.node_type==="child_device"
  ?(n.platform==="android"?Smartphone:Laptop)
  :n.node_type==="home_computer"?Home:Monitor;
const value=(v:unknown,fallback="—")=>v===null||v===undefined||v===""?fallback:String(v);
export default function Page(){
  const [session,setSession]=useState<Session|null>(null);
  const [email,setEmail]=useState("");
  const [loginSent,setLoginSent]=useState(false);
  const [view,setView]=useState<View>("overview");
  const [family,setFamily]=useState<Family|null>(null);
  const [nodes,setNodes]=useState<NodeRow[]>([]);
  const [beats,setBeats]=useState<Beat[]>([]);
  const [usage,setUsage]=useState<Usage[]>([]);
  const [commands,setCommands]=useState<Cmd[]>([]);
  const [integrations,setIntegrations]=useState<Integration[]>([]);
  const [entities,setEntities]=useState<Entity[]>([]);
  const [entityStates,setEntityStates]=useState<EntityState[]>([]);
  const [entityCommands,setEntityCommands]=useState<EntityCmd[]>([]);
  const [loading,setLoading]=useState(true);
  const [messageNode,setMessageNode]=useState("");
  const [message,setMessage]=useState("");
  const [commandBusy,setCommandBusy]=useState(false);
  const [entityBusy,setEntityBusy]=useState("");

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return()=>data.subscription.unsubscribe();
  },[]);

  async function signIn(e:FormEvent){
    e.preventDefault();
    const {error}=await supabase.auth.signInWithOtp({
      email,options:{emailRedirectTo:window.location.origin}
    });
    if(!error)setLoginSent(true);
  }

  async function load(){
    if(!session)return;
    setLoading(true);
    await supabase.rpc("claim_unowned_family");
    const {data:memberships}=await supabase.from("family_memberships")
      .select("family_id, families(id,name,timezone)").limit(1);
    const raw=memberships?.[0]?.families as unknown as Family|null;
    if(!raw){setLoading(false);return}
    setFamily(raw);
    const since=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
    const [n,h,u,c,i,e,s,ec]=await Promise.all([
      supabase.from("control_nodes").select("*").eq("family_id",raw.id).order("display_name"),
      supabase.from("control_heartbeats").select("*").order("occurred_at",{ascending:false}).limit(300),
      supabase.from("control_usage_daily").select("*").gte("local_date",since).order("local_date"),
      supabase.from("control_commands").select("*").eq("family_id",raw.id).order("created_at",{ascending:false}).limit(40),
      supabase.from("control_integrations").select("*").eq("family_id",raw.id).order("display_name"),
      supabase.from("control_entities").select("*").eq("family_id",raw.id).order("display_name"),
      supabase.from("control_entity_states").select("*").order("occurred_at",{ascending:false}).limit(500),
      supabase.from("control_entity_commands").select("*").eq("family_id",raw.id).order("created_at",{ascending:false}).limit(40),
    ]);
    setNodes((n.data||[]) as NodeRow[]);setBeats((h.data||[]) as Beat[]);
    setUsage((u.data||[]) as Usage[]);setCommands((c.data||[]) as Cmd[]);
    setIntegrations((i.data||[]) as Integration[]);setEntities((e.data||[]) as Entity[]);
    setEntityStates((s.data||[]) as EntityState[]);setEntityCommands((ec.data||[]) as EntityCmd[]);
    if(!messageNode&&n.data?.[0])setMessageNode(n.data[0].id);
    setLoading(false);
  }

  useEffect(()=>{load()},[session]);
  useEffect(()=>{
    if(!session)return;
    const ch=supabase.channel("family-control-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"control_heartbeats"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"control_commands"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"control_integrations"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"control_entity_states"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"control_entity_commands"},load)
      .subscribe();
    const timer=setInterval(load,60000);
    return()=>{clearInterval(timer);supabase.removeChannel(ch)};
  },[session]);
  const latest=useMemo(()=>{
    const m=new Map<string,Beat>();
    for(const b of beats)if(!m.has(b.node_id))m.set(b.node_id,b);
    return m;
  },[beats]);
  const latestEntity=useMemo(()=>{
    const m=new Map<string,EntityState>();
    for(const s of entityStates)if(!m.has(s.entity_id))m.set(s.entity_id,s);
    return m;
  },[entityStates]);
  const today=new Date().toISOString().slice(0,10);
  const todayUsage=usage.filter(x=>x.local_date===today);
  const gameSeconds=todayUsage.filter(x=>x.category==="game").reduce((a,b)=>a+b.seconds,0);
  const problemCount=nodes.filter(n=>(latest.get(n.id)?.state||"UNKNOWN")!=="ONLINE").length;
  const onlineCount=nodes.filter(n=>latest.get(n.id)?.state==="ONLINE").length;
  const smartActive=entities.filter(e=>latestEntity.get(e.id)?.available===true).length;
  const integrationProblems=integrations.filter(i=>!["ONLINE","DEFERRED"].includes(i.state)).length;
  const pendingAll=commands.filter(c=>["pending","sent"].includes(c.status)).length+
    entityCommands.filter(c=>["pending","sent"].includes(c.status)).length;
  const usageByNode=useMemo(()=>{
    const m=new Map<string,Usage[]>();
    for(const u of todayUsage)m.set(u.node_id,[...(m.get(u.node_id)||[]),u]);
    for(const arr of m.values())arr.sort((a,b)=>b.seconds-a.seconds);
    return m;
  },[todayUsage]);

  async function sendCommand(type:string,nodeId=messageNode,payload:Record<string,unknown>={}){
    if(!session||!family||!nodeId)return;
    setCommandBusy(true);
    await supabase.from("control_commands").insert({
      family_id:family.id,node_id:nodeId,command_type:type,payload,created_by:session.user.id
    });
    setMessage("");await load();setCommandBusy(false);
  }

  async function sendEntityCommand(entity:Entity,action:string,payload:Record<string,unknown>={}){
    if(!session||!family)return;
    const key=entity.id+action+JSON.stringify(payload);
    setEntityBusy(key);
    await supabase.from("control_entity_commands").insert({
      family_id:family.id,entity_id:entity.id,action,payload,created_by:session.user.id
    });
    await load();setEntityBusy("");
  }

  if(loading&&!session)return <div className="boot"><Sparkles size={20}/> Family Core</div>;
  if(!session)return(
    <main className="login-shell"><section className="login-card">
      <div className="brand-mark"><ShieldCheck size={22}/></div>
      <p className="eyebrow">PRIVATE FAMILY SYSTEM</p>
      <h1>Family Control Center</h1>
      <p className="muted">Устройства, дети, умный дом и домашняя инфраструктура в одном защищённом пульте.</p>
      {loginSent?<div className="notice">Ссылка для входа отправлена. Откройте письмо на этом устройстве.</div>:
      <form onSubmit={signIn}>
        <input type="email" required placeholder="Email родителя" value={email} onChange={e=>setEmail(e.target.value)}/>
        <button className="primary" type="submit">Получить ссылку для входа <ChevronRight size={17}/></button>
      </form>}
    </section></main>
  );

  const nav=[
    ["overview","Обзор",Activity],["devices","Устройства",Router],
    ["activity","Активность",Gamepad2],["home","Умный дом",Home],["commands","Команды",Command],
  ] as const;
  const title=view==="overview"?"Контрольный центр":view==="devices"?"Устройства":
    view==="activity"?"Активность":view==="home"?"Умный дом":"Команды";
  return <main className="shell">
    <aside className="sidebar">
      <div className="logo"><div className="logo-dot"/><span>FAMILY CORE</span></div>
      <nav>{nav.map(([id,label,Icon])=>
        <button key={id} className={view===id?"nav active":"nav"} onClick={()=>setView(id)}>
          <Icon size={18}/><span>{label}</span>
        </button>)}
      </nav>
      <div className="side-bottom">
        <div className="sync"><CircleDot size={14}/><span>Family Core синхронизирован</span></div>
        <button className="nav" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Выйти</button>
      </div>
    </aside>

    <section className="content">
      <header className="topbar">
        <div><p className="eyebrow">{family?.name||"Turbo Family"}</p><h2>{title}</h2></div>
        <div className="top-actions"><span className="live"><span/> LIVE</span>
          <button className="icon-btn" onClick={load}><RefreshCw size={17}/></button></div>
      </header>

      {view==="overview"&&<>
        <section className="metrics metrics-five">
          <Metric label="Устройства online" value={`${onlineCount} / ${nodes.length}`}
            sub={problemCount?`${problemCount} требует внимания`:"Все в норме"} icon={Wifi}/>
          <Metric label="Игры сегодня" value={fmt(gameSeconds)} sub="foreground usage" icon={Gamepad2}/>
          <Metric label="Умный дом" value={`${smartActive} active`} sub={`${entities.length} сущностей`} icon={Home}/>
          <Metric label="Интеграции" value={`${integrations.filter(i=>i.state==="ONLINE").length} / ${integrations.length}`}
            sub={integrationProblems?"есть деградация":"без ошибок"} icon={Server}/>
          <Metric label="Команды" value={String(pendingAll)} sub="ожидают выполнения" icon={Command}/>
        </section>

        <section className="grid-two">
          <div className="panel"><PanelHead title="Устройства" sub="живой статус транспорта и агента"/>
            <div className="device-list">{nodes.map(n=>
              <DeviceRow key={n.id} node={n} beat={latest.get(n.id)} top={usageByNode.get(n.id)?.[0]}/>)}</div>
          </div>
          <div className="panel"><PanelHead title="Дом прямо сейчас" sub="последние состояния Family Core"/>
            <HomeSnapshot entities={entities} states={latestEntity}/>
          </div>
        </section>

        <section className="grid-two lower">
          <div className="panel"><PanelHead title="Активность сегодня" sub="самые используемые приложения"/>
            <UsageBars rows={todayUsage.slice().sort((a,b)=>b.seconds-a.seconds).slice(0,7)}/>
          </div>
          <div className="panel"><PanelHead title="Быстрое сообщение" sub="очередь команд Device Hub"/>
            <CommandBox nodes={nodes} node={messageNode} setNode={setMessageNode}
              message={message} setMessage={setMessage} busy={commandBusy}
              send={()=>sendCommand("MESSAGE",messageNode,{text:message,seconds:12})}/>
          </div>
        </section>
      </>}
      {view==="devices"&&<section className="device-grid">{nodes.map(n=>{
        const b=latest.get(n.id),Icon=iconFor(n),top=usageByNode.get(n.id)?.[0];
        return <article className="device-card" key={n.id}>
          <div className="device-title"><div className="device-icon"><Icon size={22}/></div>
            <div><h3>{n.display_name}</h3><p>{n.platform} · {n.transport||"local"}</p></div>
            <Status state={b?.state||"UNKNOWN"}/></div>
          <div className="facts">
            <Fact label="Tailscale" value={b?.transport_online===true?"online":b?.transport_online===false?"offline":"нет данных"}/>
            <Fact label="Агент" value={b?.agent_online===true?"online":b?.agent_online===false?"offline":"нет данных"}/>
            <Fact label="Версия" value={b?.agent_version||n.expected_agent_version||"—"}/>
            <Fact label="Сейчас" value={b?.current_app||top?.app_name||"—"}/>
          </div>
          <div className="card-foot"><span><Clock3 size={14}/>{ago(b?.occurred_at)}</span>
            <button onClick={()=>sendCommand("REFRESH_STATUS",n.id)}><RefreshCw size={14}/>Проверить</button></div>
        </article>})}</section>}

      {view==="activity"&&<ActivityView nodes={nodes} usage={usage}/>}

      {view==="home"&&<HomeView integrations={integrations} entities={entities}
        states={latestEntity} entityCommands={entityCommands} busy={entityBusy}
        send={sendEntityCommand}/>}

      {view==="commands"&&<section className="grid-two">
        <div className="panel"><PanelHead title="Команда устройству" sub="без произвольного shell-доступа"/>
          <CommandBox nodes={nodes} node={messageNode} setNode={setMessageNode}
            message={message} setMessage={setMessage} busy={commandBusy}
            send={()=>sendCommand("MESSAGE",messageNode,{text:message,seconds:12})}/>
          <div className="quick-actions">
            <button onClick={()=>sendCommand("REFRESH_STATUS")}><RefreshCw size={16}/>Обновить статус</button>
            <button onClick={()=>sendCommand("USAGE_SYNC")}><Activity size={16}/>Синхр. usage</button>
          </div>
        </div>
        <div className="panel"><PanelHead title="Журнал устройств" sub="последние команды"/>
          <CommandList rows={commands} nodes={nodes}/></div>
        <div className="panel command-span"><PanelHead title="Журнал умного дома" sub="действия через allow-list домашнего bridge"/>
          <EntityCommandList rows={entityCommands} entities={entities}/></div>
      </section>}
    </section>
  </main>;
}
function Metric({label,value:metricValue,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Wifi}){
  return <article className="metric"><div className="metric-icon"><Icon size={19}/></div>
    <p>{label}</p><strong>{metricValue}</strong><span>{sub}</span></article>;
}
function PanelHead({title,sub}:{title:string;sub:string}){
  return <div className="panel-head"><div><h3>{title}</h3><p>{sub}</p></div></div>;
}
function Status({state}:{state:string}){
  return <span className={`status ${state.toLowerCase()}`}><i/>{stateLabel[state]||state}</span>;
}
function DeviceRow({node,beat,top}:{node:NodeRow;beat?:Beat;top?:Usage}){
  const Icon=iconFor(node);
  return <div className="device-row"><div className="device-icon"><Icon size={19}/></div>
    <div className="device-main"><b>{node.display_name}</b><span>{beat?.current_app||top?.app_name||"Нет текущей активности"}</span></div>
    <div className="device-meta"><Status state={beat?.state||"UNKNOWN"}/><small>{ago(beat?.occurred_at)}</small></div></div>;
}
function UsageBars({rows}:{rows:Usage[]}){
  const max=Math.max(...rows.map(x=>x.seconds),1);
  if(!rows.length)return <div className="empty">Данные ещё не поступили</div>;
  return <div className="bars">{rows.map((x,i)=><div className="bar-row" key={x.node_id+x.app_id+i}>
    <div className="bar-name"><span>{x.app_name}</span><b>{fmt(x.seconds)}</b></div>
    <div className="bar-track"><div className={`bar-fill ${x.category}`} style={{width:`${Math.max(3,x.seconds/max*100)}%`}}/></div>
  </div>)}</div>;
}
function Fact({label,value:factValue}:{label:string;value:string}){
  return <div className="fact"><span>{label}</span><b>{factValue}</b></div>;
}
function CommandBox({nodes,node,setNode,message,setMessage,busy,send}:{nodes:NodeRow[];node:string;setNode:(v:string)=>void;message:string;setMessage:(v:string)=>void;busy:boolean;send:()=>void}){
  return <div className="command-box"><label>Устройство<select value={node} onChange={e=>setNode(e.target.value)}>
    {nodes.filter(n=>n.node_type==="child_device").map(n=><option value={n.id} key={n.id}>{n.display_name}</option>)}
  </select></label>
  <label>Сообщение<textarea rows={3} placeholder="Например: Рома, пора собираться гулять" value={message} onChange={e=>setMessage(e.target.value)}/></label>
  <button className="primary" disabled={busy||!message.trim()} onClick={send}><Send size={16}/>{busy?"Отправка…":"Отправить"}</button></div>;
}
function CommandList({rows,nodes}:{rows:Cmd[];nodes:NodeRow[]}){
  const names=new Map(nodes.map(n=>[n.id,n.display_name]));
  if(!rows.length)return <div className="empty">Команд пока нет</div>;
  return <div className="command-list">{rows.map(c=><div className="command-row" key={c.id}>
    <div className="command-ico"><Command size={15}/></div><div><b>{c.command_type}</b><span>{names.get(c.node_id)||"Устройство"}</span></div>
    <div className={`cmd-state ${c.status}`}>{c.status}</div></div>)}</div>;
}
function ActivityView({nodes,usage}:{nodes:NodeRow[];usage:Usage[]}){
  const dates=[...new Set(usage.map(x=>x.local_date))].sort();
  const childNodes=nodes.filter(n=>n.node_type==="child_device");
  return <section className="activity-layout">{childNodes.map(n=>{
    const rows=usage.filter(x=>x.node_id===n.id);
    const total=rows.reduce((a,b)=>a+b.seconds,0);
    const roblox=rows.filter(x=>x.app_id.toLowerCase().includes("roblox")||x.app_name.toLowerCase().includes("roblox"));
    return <article className="panel activity-card" key={n.id}>
      <PanelHead title={n.display_name} sub={`7 дней · всего ${fmt(total)}`}/>
      <div className="week-chart">{dates.map(d=>{
        const all=rows.filter(x=>x.local_date===d).reduce((a,b)=>a+b.seconds,0);
        const game=rows.filter(x=>x.local_date===d&&x.category==="game").reduce((a,b)=>a+b.seconds,0);
        const maxDay=Math.max(...dates.map(dd=>rows.filter(x=>x.local_date===dd).reduce((a,b)=>a+b.seconds,0)),1);
        return <div className="day" key={d}><div className="day-bar"><div style={{height:`${Math.max(4,all/maxDay*100)}%`}}><i style={{height:`${all?game/all*100:0}%`}}/></div></div><span>{d.slice(8)}</span></div>
      })}</div>
      <div className="activity-summary"><span><Gamepad2 size={15}/>Roblox</span><b>{fmt(roblox.reduce((a,b)=>a+b.seconds,0))}</b></div>
      <UsageBars rows={rows.slice().sort((a,b)=>b.seconds-a.seconds).slice(0,6)}/>
    </article>})}</section>;
}

function entityIcon(domain:string){
  if(domain==="vacuum")return Router;
  if(domain==="air_purifier")return Fan;
  if(domain==="camera")return Camera;
  if(domain==="speaker_hub")return Speaker;
  if(domain==="network"||domain==="service"||domain==="media")return Server;
  return Home;
}
function HomeSnapshot({entities,states}:{entities:Entity[];states:Map<string,EntityState>}){
  const wanted=entities.filter(e=>["vacuum","air_purifier","speaker_hub"].includes(e.domain)).slice(0,5);
  if(!wanted.length)return <div className="empty">Умный дом ещё не синхронизирован</div>;
  return <div className="home-snapshot">{wanted.map(e=>{
    const s=states.get(e.id),Icon=entityIcon(e.domain);
    return <div className="snapshot-row" key={e.id}><div className="device-icon"><Icon size={18}/></div>
      <div><b>{e.display_name}</b><span>{e.room||e.provider||"Дом"}</span></div>
      <div className="snapshot-state"><strong>{s?.state||"unknown"}</strong><small>{ago(s?.occurred_at)}</small></div></div>
  })}</div>;
}
function HomeView({integrations,entities,states,entityCommands,busy,send}:{
  integrations:Integration[];entities:Entity[];states:Map<string,EntityState>;entityCommands:EntityCmd[];
  busy:string;send:(entity:Entity,action:string,payload?:Record<string,unknown>)=>void;
}){
  const robot=entities.find(e=>e.entity_key==="xiaomi:1140089590");
  const purifier=entities.find(e=>e.entity_key==="xiaomi:684026998");
  const station=entities.find(e=>e.domain==="speaker_hub");
  const cameras=entities.filter(e=>e.domain==="camera");
  const services=entities.filter(e=>["service","network","media"].includes(e.domain));
  const state=(e?:Entity)=>e?states.get(e.id):undefined;
  const rs=state(robot),ps=state(purifier);
  const ra=rs?.attributes||{},pa=ps?.attributes||{};
  const ha=integrations.find(i=>i.integration_key==="home-assistant");
  const btn=(e:Entity|undefined,action:string,payload:Record<string,unknown>={})=>{
    if(!e)return false;return busy===e.id+action+JSON.stringify(payload);
  };

  return <section className="home-layout">
    <div className="integration-strip">{integrations.map(i=><article className="integration-card" key={i.id}>
      <div><p>{i.provider}</p><h3>{i.display_name}</h3></div><Status state={i.state}/>
      <small>{i.state==="DEFERRED"?value(i.metadata?.reason):ago(i.last_seen_at)}</small>
    </article>)}</div>

    <section className="home-grid">
      {robot&&<article className="panel smart-card">
        <div className="smart-head"><div className="smart-icon"><Router size={22}/></div>
          <div><p className="eyebrow">XIAOMI · VACUUM</p><h3>{robot.display_name}</h3></div>
          <span className={`availability ${rs?.available===true?"ok":"bad"}`}>{rs?.state||"unknown"}</span></div>
        <div className="smart-kpis">
          <SmartKpi icon={BatteryCharging} label="Батарея" value={`${value(ra.battery_pct,"?")}%`}/>
          <SmartKpi icon={Gauge} label="Режим" value={value(ra.mode)}/>
          <SmartKpi icon={Power} label="Зарядка" value={value(ra.charging)}/>
        </div>
        <div className="smart-actions">
          <button disabled={btn(robot,"START")} onClick={()=>send(robot,"START")}><Play size={15}/>Старт</button>
          <button disabled={btn(robot,"STOP")} onClick={()=>send(robot,"STOP")}><Square size={15}/>Стоп</button>
          <button disabled={btn(robot,"DOCK")} onClick={()=>send(robot,"DOCK")}><Home size={15}/>На базу</button>
          <button disabled={btn(robot,"REFRESH")} onClick={()=>send(robot,"REFRESH")}><RefreshCw size={15}/>Обновить</button>
        </div>
        <div className="mode-actions">
          {["Silent","Basic","Strong","Turbo"].map(m=><button key={m} onClick={()=>send(robot,"SET_MODE",{mode:m})}>{m}</button>)}
        </div>
        <footer><span>{robot.room||"Дом Кендировых"}</span><span>{ago(rs?.occurred_at)}</span></footer>
      </article>}

      {purifier&&<article className="panel smart-card">
        <div className="smart-head"><div className="smart-icon"><Fan size={22}/></div>
          <div><p className="eyebrow">XIAOMI · AIR</p><h3>{purifier.display_name}</h3></div>
          <span className={`availability ${ps?.available===true?"ok":"bad"}`}>{ps?.state||"unknown"}</span></div>
        <div className="smart-kpis">
          <SmartKpi icon={Gauge} label="PM2.5" value={value(pa.pm2_5)}/>
          <SmartKpi icon={Fan} label="Режим" value={value(pa.mode)}/>
          <SmartKpi icon={Activity} label="Фильтр" value={`${value(pa.filter_life_pct,"?")}%`}/>
          <SmartKpi icon={Gauge} label="Температура" value={`${value(pa.temperature_c,"?")}°`}/>
        </div>
        <div className="smart-actions">
          <button disabled={btn(purifier,"TURN_ON")} onClick={()=>send(purifier,"TURN_ON")}><Power size={15}/>Вкл</button>
          <button disabled={btn(purifier,"TURN_OFF")} onClick={()=>send(purifier,"TURN_OFF")}><Power size={15}/>Выкл</button>
          <button disabled={btn(purifier,"REFRESH")} onClick={()=>send(purifier,"REFRESH")}><RefreshCw size={15}/>Обновить</button>
        </div>
        <div className="mode-actions">
          {["Auto","Sleep","Low","Medium","High"].map(m=><button key={m} onClick={()=>send(purifier,"SET_MODE",{mode:m})}>{m}</button>)}
        </div>
        <footer><span>{purifier.room||"Дом"}</span><span>{value(pa.air_quality)} · {ago(ps?.occurred_at)}</span></footer>
      </article>}
      <article className="panel smart-card compact">
        <PanelHead title="Голос и камеры" sub="Яндекс + Xiaomi inventory"/>
        {station&&<HomeMini entity={station} state={state(station)}/>}
        {cameras.map(c=><HomeMini key={c.id} entity={c} state={state(c)}/>)}
      </article>

      <article className="panel smart-card compact">
        <PanelHead title="Домашние сервисы" sub="kendirov-home"/>
        {services.map(s=><HomeMini key={s.id} entity={s} state={state(s)}/>)}
      </article>

      <article className="panel smart-card compact ha-card">
        <div className="smart-head"><div className="smart-icon"><Home size={22}/></div>
          <div><p className="eyebrow">NEXT ADAPTER</p><h3>Home Assistant</h3></div>
          <Status state={ha?.state||"DEFERRED"}/></div>
        <p className="ha-copy">Family Core уже готов принимать Home Assistant сущности без изменения интерфейса.
          После установки на домашнем узле adapter читает <code>/api/states</code>, вызывает разрешённые
          <code>/api/services</code> и принимает ESP32/датчики через MQTT Discovery.</p>
        <div className="ha-flow"><span>HA</span><i>→</i><span>Family Core</span><i>→</i><span>Сайт / ChatGPT / Алиса</span></div>
        <footer><span>MQTT уже online</span><span>HA ждёт SVM/виртуализацию</span></footer>
      </article>

      <article className="panel smart-card compact command-history-card">
        <PanelHead title="Последние действия" sub="аудит умного дома"/>
        <EntityCommandList rows={entityCommands.slice(0,8)} entities={entities}/>
      </article>
    </section>
  </section>;
}

function SmartKpi({icon:Icon,label,value:kpiValue}:{icon:typeof Gauge;label:string;value:string}){
  return <div className="smart-kpi"><Icon size={15}/><span>{label}</span><b>{kpiValue}</b></div>;
}
function HomeMini({entity,state}:{entity:Entity;state?:EntityState}){
  const Icon=entityIcon(entity.domain);
  return <div className="home-mini"><div className="device-icon"><Icon size={17}/></div>
    <div><b>{entity.display_name}</b><span>{entity.room||entity.model||entity.provider}</span></div>
    <div className="mini-right"><strong>{state?.state||"unknown"}</strong>
      <small>{state?.available===false?"offline":ago(state?.occurred_at)}</small></div></div>;
}
function EntityCommandList({rows,entities}:{rows:EntityCmd[];entities:Entity[]}){
  const names=new Map(entities.map(e=>[e.id,e.display_name]));
  if(!rows.length)return <div className="empty">Действий пока нет</div>;
  return <div className="command-list">{rows.map(c=><div className="command-row" key={c.id}>
    <div className="command-ico"><Home size={15}/></div><div><b>{c.action}</b><span>{names.get(c.entity_id)||"Умный дом"}</span></div>
    <div className={`cmd-state ${c.status}`}>{c.status}</div></div>)}</div>;
}
