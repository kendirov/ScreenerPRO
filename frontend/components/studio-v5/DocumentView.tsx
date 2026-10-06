"use client";
import {useState} from "react";
import type {StudioDocumentBlock} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "./MarketChart";
import {StudioMarketReplay} from "./MarketReplay";
import {blockHasPublicationBody,embedSrc,groupDocumentSections,interactiveView,resolveVideoEmbed} from "@/lib/studio-v6/document-model";

export function DocumentBlocksView({blocks,clean=false}:{blocks:StudioDocumentBlock[];clean?:boolean}){
 const groups=groupDocumentSections(blocks);
 return <div className={clean?"studio-clean-flow":"studio-doc-renderer"} data-publication={clean?"clean":"edit"}>
  {groups.map(group=>{
    const visible=group.blocks.filter(block=>!clean||blockHasPublicationBody(block));
    if(!visible.length)return null;
    return <section key={group.blocks[0]?.block_id||group.id} className="studio-doc-section" data-layout={group.layout} data-section-id={group.id}>
      {visible.map(block=><BlockView key={block.block_id} block={block} clean={clean}/>)}
    </section>;
  })}
 </div>
}

function BlockView({block,clean}:{block:StudioDocumentBlock;clean:boolean}){
 const c=block.content||{};
 const view=interactiveView(block);
 const tone=c.tone||c.accent;
 if(block.block_type==="divider")return <hr/>;
 if(block.block_type==="heading")return <h2>{c.text||""}</h2>;
 if(block.block_type==="rich_text")return <div className="studio-rich" dangerouslySetInnerHTML={{__html:c.html||""}}/>;
 if(["callout","quote","definition","example","warning","homework"].includes(block.block_type))return <aside className="studio-callout" data-accent={tone||"blue"} data-tone={tone||block.block_type}><small>{toneLabel(tone||block.block_type)}</small><p>{c.text||""}</p></aside>;
 if(block.block_type==="steps"||block.block_type==="roadmap"||block.block_type==="diagram")return <StepsView content={c}/>;
 if(block.block_type==="checklist"||block.block_type==="quiz"||block.block_type==="poll")return <CheckView content={c} kind={block.block_type}/>;
 if(block.block_type==="tabs")return <TabsView content={c}/>;
 if(block.block_type==="slider"||block.block_type==="toggle"||block.block_type==="before_after"||block.block_type==="filters")return <SwitchView content={c}/>;
 if(block.block_type==="calculator")return <Calculator content={c}/>;
 if(block.block_type==="comparison"||(block.block_type==="table"&&!view))return <TableView content={c} clean={clean}/>;
 if(view)return <InteractiveView block={block} clean={clean}/>;
 if(block.block_type==="image"||block.block_type==="gallery"||block.block_type==="hotspot"||block.block_type==="infographic")return <ImageView content={c} clean={clean}/>;
 if(block.block_type==="video"||block.block_type==="audio")return <VideoView content={c} clean={clean}/>;
 if(block.block_type==="pdf_excerpt"||block.block_type==="citation"||block.block_type==="file")return <blockquote className="studio-pdf-excerpt"><strong>{c.title||"Фрагмент"}</strong><p>{c.text||""}</p>{c.url?<a href={c.url}>{c.url}</a>:null}</blockquote>;
 if(block.block_type==="sources"||block.block_type==="source_card"||block.block_type==="drive_ref"||block.block_type==="link")return <section className="studio-sources"><h3>{c.title||"Источники"}</h3>{c.url?<a href={c.url}>{c.title||c.url}</a>:null}<ul>{(c.items||[]).map((item:any,index:number)=><li key={index}>{item.url?<a href={item.url} target="_blank" rel="noreferrer">{item.label||item.url}</a>:item.label||""}</li>)}</ul></section>;
 if(clean&&!blockHasPublicationBody(block))return null;
 return <div>{c.text||c.title||""}</div>;
}

function toneLabel(tone:string){
 if(tone==="practice"||tone==="callout"||tone==="blue")return "Практика";
 if(tone==="quote")return "Цитата";
 if(tone==="definition")return "Определение";
 if(tone==="example")return "Пример";
 if(tone==="warning"||tone==="rose")return "Осторожно";
 if(tone==="homework")return "Задание";
 return "Заметка";
}

function StepsView({content}:{content:any}){
 const items=content.items||[];
 const [open,setOpen]=useState(0);
 const current=items[open]||items[0];
 return <section className="studio-steps" data-interactive="steps">
  {content.title&&<h3>{content.title}</h3>}
  <ol>{items.map((item:any,index:number)=><li key={index}><button type="button" className={index===open?"is-on":""} onClick={()=>setOpen(index)}><b>{index+1}</b>{item.label||item.title}</button></li>)}</ol>
  {current&&<p>{current.text||current.label}</p>}
 </section>;
}

function CheckView({content,kind}:{content:any;kind:string}){
 const [items,setItems]=useState<any[]>(content.items||[]);
 const [picked,setPicked]=useState<number|null>(null);
 return <section className="studio-check" data-interactive={kind}>
  {content.title&&<h3>{content.title}</h3>}
  <ul>{items.map((item,index)=><li key={index}><button type="button" aria-pressed={kind==="checklist"?Boolean(item.done):picked===index} onClick={()=>{
    if(kind==="checklist")setItems(list=>list.map((row,rowIndex)=>rowIndex===index?{...row,done:!row.done}:row));
    else setPicked(index);
  }}><i/>{item.label||item.text}</button>{(kind!=="checklist"&&picked===index&&item.text)?<small>{item.text}</small>:null}</li>)}</ul>
 </section>;
}

function TabsView({content}:{content:any}){
 const items=content.items||[];
 const [open,setOpen]=useState(0);
 const current=items[open];
 return <section className="studio-tabs" data-interactive="tabs">
  <div>{items.map((item:any,index:number)=><button type="button" key={index} className={index===open?"is-on":""} onClick={()=>setOpen(index)}>{item.label}</button>)}</div>
  <p>{current?.text||""}</p>
 </section>;
}

function SwitchView({content}:{content:any}){
 const [on,setOn]=useState(false);
 return <section className="studio-switch" data-interactive="switch">
  <h3>{content.title||"Сравнение"}</h3>
  <button type="button" onClick={()=>setOn(value=>!value)}>{on?content.after||"После":content.before||"До"}</button>
  <p>{on?content.afterText||content.text||content.after:content.beforeText||content.prompt||content.before}</p>
 </section>;
}

function Calculator({content}:{content:any}){
 const [price,setPrice]=useState("100");
 const [qty,setQty]=useState("1");
 const value=Number(price.replace(",","."));
 const amount=Number(qty.replace(",","."));
 const total=Number.isFinite(value)&&Number.isFinite(amount)?value*amount:0;
 return <section className="studio-calc" data-interactive="calculator">
  <h3>{content.title||"Калькулятор"}</h3>
  <label>Цена<input value={price} onChange={event=>setPrice(event.target.value)}/></label>
  <label>Объём<input value={qty} onChange={event=>setQty(event.target.value)}/></label>
  <strong>{total.toLocaleString("ru-RU")}</strong>
 </section>;
}

function ImageView({content,clean}:{content:any;clean:boolean}){
 const src=content.url||content.previewUrl;
 const [hot,setHot]=useState<string|null>(null);
 const spots=Array.isArray(content.hotspots)?content.hotspots:[];
 const active=spots.find((spot:any)=>spot.id===hot);
 if(!src&&content.svg)return <figure dangerouslySetInnerHTML={{__html:String(content.svg)}}/>;
 if(!src)return clean?null:<div className="studio-doc-placeholder" data-empty-media="image">{content.title||"Изображение"}</div>;
 return <figure className="studio-hotspot">{src&&<img src={src} alt={content.alt||content.title||""}/>}{spots.map((spot:any)=><button type="button" key={spot.id} className={hot===spot.id?"is-on":""} style={{left:`${spot.x}%`,top:`${spot.y}%`}} onClick={()=>setHot(hot===spot.id?null:spot.id)}>{spot.title}</button>)}{active&&<figcaption><b>{active.title}</b> {active.text}</figcaption>}{!active&&content.caption?<figcaption>{content.caption}</figcaption>:null}</figure>;
}

function VideoView({content,clean}:{content:any;clean:boolean}){
 const raw=String(content.url||"").trim();
 if(!raw)return clean?null:<div className="studio-doc-placeholder" data-empty-media="video">{content.title||"Видео"}</div>;
 const embed=resolveVideoEmbed(raw);
 if(embed)return <section><iframe title={content.title||"Видео"} src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></section>;
 return <section>{content.title==="Аудио"||raw.includes("audio")?<audio controls src={raw}/>:<video controls src={raw}/>}</section>;
}

function InteractiveView({block,clean}:{block:StudioDocumentBlock;clean:boolean}){
 const view=interactiveView(block)||"chart";
 const c=block.content||{};
 if(view==="reveal")return <Reveal content={c}/>;
 if(view==="chart"){
  if(!block.data_spec)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">График ещё не настроен</div>;
  return <section className="studio-interactive" data-interactive-view="chart"><h3>{c.title||"График"}</h3><StudioMarketChart dataSpec={block.data_spec}/></section>;
 }
 if(view==="table")return <TableView content={c} clean={clean}/>;
 if(view==="timeline"){
  if(block.data_spec?.display?.renderer==="studio_market_replay"||block.block_type==="market_replay")return <section className="studio-interactive" data-interactive-view="timeline"><StudioMarketReplay dataSpec={block.data_spec}/></section>;
  const items=(c.items||[]).filter((item:any)=>!clean||item?.text||item?.label);
  if(!items.length)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">Таймлайн ещё пуст</div>;
  return <StepsView content={{title:c.title,items}}/>;
 }
 if(view==="visual")return <ImageView content={c} clean={clean}/>;
 const src=embedSrc(c.url||"");
 if(!src)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">Вставка ещё не задана</div>;
 return <section className="studio-interactive" data-interactive-view="embed"><iframe title={c.title||"Вставка"} src={src} allowFullScreen/></section>;
}

function Reveal({content}:{content:any}){
 const [open,setOpen]=useState(false);
 return <section className="studio-reveal" data-interactive="reveal">
  <h3>{content.title||"Проверка"}</h3>
  <p>{content.prompt}</p>
  <button type="button" onClick={()=>setOpen(value=>!value)}>{open?"Скрыть пояснение":"Показать пояснение"}</button>
  {open&&<p className="is-answer">{content.answer}</p>}
 </section>;
}

function TableView({content,clean}:{content:any;clean:boolean}){
 const columns=content.columns||[];
 const rows=content.rows||[];
 if(clean&&![...columns,...rows.flat()].some((cell:string)=>String(cell||"").trim()))return null;
 return <table data-interactive-view="table"><thead><tr>{columns.map((cell:string,index:number)=><th key={index}>{cell}</th>)}</tr></thead><tbody>{rows.map((row:string[],index:number)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}
