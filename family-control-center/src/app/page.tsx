"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bot, ChevronRight, CircleDot, Clock3,
  Command, Cpu, Gamepad2, HardDrive, Home, Laptop, LogOut,
  MessageSquare, Monitor, RefreshCw, Router, Send, ShieldCheck,
  Smartphone, Sparkles, Wifi, WifiOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type NodeRow = {
  id: string; family_id: string; child_id: string | null; node_key: string;
  display_name: string; node_type: string; platform: string; role: string;
  transport: string | null; expected_agent_version: string | null; metadata: Record<string, unknown>;
};
type Beat = {
  id: number; node_id: string; occurred_at: string; received_at: string; state: string;
  transport_online: boolean | null; agent_online: boolean | null; agent_version: string | null;
  current_app: string | null; payload: Record<string, unknown>;
};
type Usage = { node_id: string; local_date: string; app_id: string; app_name: string; category: string; seconds: number };
type Cmd = { id: string; node_id: string; command_type: string; status: string; created_at: string; result: Record<string, unknown> };
type Family = { id: string; name: string; timezone: string };
type View = "overview" | "devices" | "activity" | "commands";
const fmt = (s: number) => {
  if (!s) return "0 мин";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}ч ${m}м` : `${m} мин`;
};
const ago = (iso?: string) => {
  if (!iso) return "нет данных";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec} сек назад`;
  if (sec < 3600) return `${Math.floor(sec / 60)} мин назад`;
  return `${Math.floor(sec / 3600)} ч назад`;
};
const stateLabel: Record<string, string> = {
  ONLINE: "ONLINE", TRANSPORT_ONLY: "ТРАНСПОРТ", OFFLINE: "OFFLINE", UNKNOWN: "НЕИЗВЕСТНО"
};
const iconFor = (n: NodeRow) => n.node_type === "child_device"
  ? (n.platform === "android" ? Smartphone : Laptop)
  : n.node_type === "home_computer" ? Home : Monitor;

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [family, setFamily] = useState<Family | null>(null);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageNode, setMessageNode] = useState("");
  const [message, setMessage] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (!error) setLoginSent(true);
  }

  async function load() {
    if (!session) return;
    setLoading(true);
    await supabase.rpc("claim_unowned_family");
    const { data: memberships } = await supabase.from("family_memberships")
      .select("family_id, families(id,name,timezone)").limit(1);
    const raw = memberships?.[0]?.families as unknown as Family | null;
    if (!raw) { setLoading(false); return; }
    setFamily(raw);
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const [n, h, u, c] = await Promise.all([
      supabase.from("control_nodes").select("*").eq("family_id", raw.id).order("display_name"),
      supabase.from("control_heartbeats").select("*").order("occurred_at", { ascending: false }).limit(250),
      supabase.from("control_usage_daily").select("*").gte("local_date", since).order("local_date"),
      supabase.from("control_commands").select("*").eq("family_id", raw.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setNodes((n.data || []) as NodeRow[]); setBeats((h.data || []) as Beat[]);
    setUsage((u.data || []) as Usage[]); setCommands((c.data || []) as Cmd[]);
    if (!messageNode && n.data?.[0]) setMessageNode(n.data[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); }, [session]);
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel("family-control-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "control_heartbeats" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "control_commands" }, load)
      .subscribe();
    const timer = setInterval(load, 60000);
    return () => { clearInterval(timer); supabase.removeChannel(ch); };
  }, [session]);

  const latest = useMemo(() => {
    const m = new Map<string, Beat>();
    for (const b of beats) if (!m.has(b.node_id)) m.set(b.node_id, b);
    return m;
  }, [beats]);
  const today = new Date().toISOString().slice(0, 10);
  const todayUsage = usage.filter(x => x.local_date === today);
  const gameSeconds = todayUsage.filter(x => x.category === "game").reduce((a, b) => a + b.seconds, 0);
  const problemCount = nodes.filter(n => (latest.get(n.id)?.state || "UNKNOWN") !== "ONLINE").length;
  const onlineCount = nodes.filter(n => latest.get(n.id)?.state === "ONLINE").length;
  const usageByNode = useMemo(() => {
    const m = new Map<string, Usage[]>();
    for (const u of todayUsage) m.set(u.node_id, [...(m.get(u.node_id) || []), u]);
    for (const arr of m.values()) arr.sort((a,b) => b.seconds-a.seconds);
    return m;
  }, [todayUsage]);

  async function sendCommand(type: string, nodeId = messageNode, payload: Record<string, unknown> = {}) {
    if (!session || !family || !nodeId) return;
    setCommandBusy(true);
    await supabase.from("control_commands").insert({
      family_id: family.id, node_id: nodeId, command_type: type,
      payload, created_by: session.user.id
    });
    setMessage(""); await load(); setCommandBusy(false);
  }
  if (loading && !session) return <div className="boot"><Sparkles size={20}/> Family Core</div>;
  if (!session) return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><ShieldCheck size={22}/></div>
        <p className="eyebrow">PRIVATE FAMILY SYSTEM</p>
        <h1>Family Control Center</h1>
        <p className="muted">Единый пульт устройств, активности и семейной инфраструктуры.</p>
        {loginSent ? <div className="notice">Ссылка для входа отправлена. Откройте письмо на этом устройстве.</div> :
        <form onSubmit={signIn}>
          <input type="email" required placeholder="Email родителя" value={email} onChange={e=>setEmail(e.target.value)}/>
          <button className="primary" type="submit">Получить ссылку для входа <ChevronRight size={17}/></button>
        </form>}
      </section>
    </main>
  );

  const nav = [
    ["overview","Обзор",Activity], ["devices","Устройства",Router],
    ["activity","Активность",Gamepad2], ["commands","Команды",Command],
  ] as const;

  return <main className="shell">
    <aside className="sidebar">
      <div className="logo"><div className="logo-dot"/><span>FAMILY CORE</span></div>
      <nav>{nav.map(([id,label,Icon]) =>
        <button key={id} className={view===id ? "nav active":"nav"} onClick={()=>setView(id)}>
          <Icon size={18}/><span>{label}</span>
        </button>)}
      </nav>
      <div className="side-bottom">
        <div className="sync"><CircleDot size={14}/><span>Облако синхронизировано</span></div>
        <button className="nav" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Выйти</button>
      </div>
    </aside>
    <section className="content">
      <header className="topbar">
        <div><p className="eyebrow">{family?.name || "Turbo Family"}</p>
          <h2>{view==="overview"?"Контрольный центр":view==="devices"?"Устройства":view==="activity"?"Активность":"Команды"}</h2></div>
        <div className="top-actions"><span className="live"><span/> LIVE</span>
          <button className="icon-btn" onClick={load}><RefreshCw size={17}/></button></div>
      </header>

      {view==="overview" && <>
        <section className="metrics">
          <Metric label="Устройства online" value={`${onlineCount} / ${nodes.length}`} sub={problemCount ? `${problemCount} требует внимания`:"Все в норме"} icon={Wifi}/>
          <Metric label="Игры сегодня" value={fmt(gameSeconds)} sub="по foreground usage" icon={Gamepad2}/>
          <Metric label="Проблемы" value={String(problemCount)} sub="агент / транспорт" icon={AlertTriangle}/>
          <Metric label="Команды" value={String(commands.filter(c=>c.status==="pending"||c.status==="sent").length)} sub="в очереди" icon={Command}/>
        </section>
        <section className="grid-two">
          <div className="panel"><PanelHead title="Устройства" sub="живой статус сети и агента"/>
            <div className="device-list">{nodes.map(n=><DeviceRow key={n.id} node={n} beat={latest.get(n.id)} top={usageByNode.get(n.id)?.[0]}/>)}</div>
          </div>
          <div className="panel"><PanelHead title="Активность сегодня" sub="самые используемые приложения"/>
            <UsageBars rows={todayUsage.slice().sort((a,b)=>b.seconds-a.seconds).slice(0,7)}/>
          </div>
        </section>
        <section className="grid-two lower">
          <div className="panel"><PanelHead title="Быстрое действие" sub="команда уйдёт через Family Core"/>
            <CommandBox nodes={nodes} node={messageNode} setNode={setMessageNode} message={message} setMessage={setMessage}
              busy={commandBusy} send={()=>sendCommand("MESSAGE", messageNode,{text:message,seconds:12})}/>
          </div>
          <div className="panel"><PanelHead title="Последние команды" sub="аудит исполнения"/>
            <CommandList rows={commands.slice(0,6)} nodes={nodes}/>
          </div>
        </section>
      </>}
      {view==="devices" && <section className="device-grid">{nodes.map(n=>{
        const b=latest.get(n.id), Icon=iconFor(n), top=usageByNode.get(n.id)?.[0];
        return <article className="device-card" key={n.id}>
          <div className="device-title"><div className="device-icon"><Icon size={22}/></div>
            <div><h3>{n.display_name}</h3><p>{n.platform} · {n.transport || "local"}</p></div>
            <Status state={b?.state || "UNKNOWN"}/></div>
          <div className="facts">
            <Fact label="Tailscale" value={b?.transport_online===true?"online":b?.transport_online===false?"offline":"нет данных"}/>
            <Fact label="Агент" value={b?.agent_online===true?"online":b?.agent_online===false?"offline":"нет данных"}/>
            <Fact label="Версия" value={b?.agent_version || n.expected_agent_version || "—"}/>
            <Fact label="Сейчас" value={b?.current_app || top?.app_name || "—"}/>
          </div>
          <div className="card-foot"><span><Clock3 size={14}/>{ago(b?.occurred_at)}</span>
            <button onClick={()=>sendCommand("REFRESH_STATUS",n.id)}><RefreshCw size={14}/>Проверить</button></div>
        </article>})}</section>}

      {view==="activity" && <ActivityView nodes={nodes} usage={usage}/>}
      {view==="commands" && <section className="grid-two">
        <div className="panel"><PanelHead title="Отправить команду" sub="без произвольного shell-доступа"/>
          <CommandBox nodes={nodes} node={messageNode} setNode={setMessageNode} message={message} setMessage={setMessage}
            busy={commandBusy} send={()=>sendCommand("MESSAGE",messageNode,{text:message,seconds:12})}/>
          <div className="quick-actions">
            <button onClick={()=>sendCommand("REFRESH_STATUS")}><RefreshCw size={16}/>Обновить статус</button>
            <button onClick={()=>sendCommand("USAGE_SYNC")}><Activity size={16}/>Синхр. usage</button>
          </div>
        </div>
        <div className="panel"><PanelHead title="Журнал" sub="последние 30 команд"/><CommandList rows={commands} nodes={nodes}/></div>
      </section>}
    </section>
  </main>;
}
function Metric({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:typeof Wifi}) {
  return <article className="metric"><div className="metric-icon"><Icon size={19}/></div>
    <p>{label}</p><strong>{value}</strong><span>{sub}</span></article>;
}
function PanelHead({title,sub}:{title:string;sub:string}) {
  return <div className="panel-head"><div><h3>{title}</h3><p>{sub}</p></div></div>;
}
function Status({state}:{state:string}) {
  return <span className={`status ${state.toLowerCase()}`}><i/>{stateLabel[state] || state}</span>;
}
function DeviceRow({node,beat,top}:{node:NodeRow;beat?:Beat;top?:Usage}) {
  const Icon=iconFor(node);
  return <div className="device-row"><div className="device-icon"><Icon size={19}/></div>
    <div className="device-main"><b>{node.display_name}</b><span>{beat?.current_app || top?.app_name || "Нет текущей активности"}</span></div>
    <div className="device-meta"><Status state={beat?.state || "UNKNOWN"}/><small>{ago(beat?.occurred_at)}</small></div></div>;
}
function UsageBars({rows}:{rows:Usage[]}) {
  const max=Math.max(...rows.map(x=>x.seconds),1);
  if(!rows.length) return <div className="empty">Данные ещё не поступили</div>;
  return <div className="bars">{rows.map((x,i)=><div className="bar-row" key={x.node_id+x.app_id+i}>
    <div className="bar-name"><span>{x.app_name}</span><b>{fmt(x.seconds)}</b></div>
    <div className="bar-track"><div className={`bar-fill ${x.category}`} style={{width:`${Math.max(3,x.seconds/max*100)}%`}}/></div>
  </div>)}</div>;
}
function Fact({label,value}:{label:string;value:string}) {
  return <div className="fact"><span>{label}</span><b>{value}</b></div>;
}
function CommandBox({nodes,node,setNode,message,setMessage,busy,send}:{nodes:NodeRow[];node:string;setNode:(v:string)=>void;message:string;setMessage:(v:string)=>void;busy:boolean;send:()=>void}) {
  return <div className="command-box"><label>Устройство<select value={node} onChange={e=>setNode(e.target.value)}>
    {nodes.filter(n=>n.node_type==="child_device").map(n=><option value={n.id} key={n.id}>{n.display_name}</option>)}
  </select></label>
  <label>Сообщение<textarea rows={3} placeholder="Например: Рома, пора собираться гулять" value={message} onChange={e=>setMessage(e.target.value)}/></label>
  <button className="primary" disabled={busy||!message.trim()} onClick={send}><Send size={16}/>{busy?"Отправка…":"Отправить"}</button></div>;
}
function CommandList({rows,nodes}:{rows:Cmd[];nodes:NodeRow[]}) {
  const names=new Map(nodes.map(n=>[n.id,n.display_name]));
  if(!rows.length) return <div className="empty">Команд пока нет</div>;
  return <div className="command-list">{rows.map(c=><div className="command-row" key={c.id}>
    <div className="command-ico"><Command size={15}/></div><div><b>{c.command_type}</b><span>{names.get(c.node_id) || "Устройство"}</span></div>
    <div className={`cmd-state ${c.status}`}>{c.status}</div></div>)}</div>;
}
function ActivityView({nodes,usage}:{nodes:NodeRow[];usage:Usage[]}) {
  const dates=[...new Set(usage.map(x=>x.local_date))].sort();
  const childNodes=nodes.filter(n=>n.node_type==="child_device");
  return <section className="activity-layout">
    {childNodes.map(n=>{
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
      </article>})}
  </section>;
}
