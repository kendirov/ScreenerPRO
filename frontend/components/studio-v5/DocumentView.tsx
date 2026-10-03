"use client";
import type {StudioDocumentBlock} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "./MarketChart";
import {StudioMarketReplay} from "./MarketReplay";

export function DocumentBlocksView({blocks,clean=false}:{blocks:StudioDocumentBlock[];clean?:boolean}){
 return <div className={clean?"studio-clean-flow":"studio-doc-renderer"}>
  {[...blocks].sort((a,b)=>a.ordinal-b.ordinal).map(b=>{
   const c=b.content||{};
   if(b.block_type==="divider")return <hr key={b.block_id}/>;
   if(b.block_type==="heading")return <h2 key={b.block_id}>{c.text||""}</h2>;
   if(b.block_type==="rich_text")return <div key={b.block_id} className="studio-rich" dangerouslySetInnerHTML={{__html:c.html||""}}/>;
   if(b.block_type==="callout")return <aside key={b.block_id} className="studio-callout">{c.text||""}</aside>;
   if(b.block_type==="interactive_chart"||b.block_type==="live_data")return <section key={b.block_id} className="studio-interactive"><h3>{c.title||"Интерактивный график"}</h3><StudioMarketChart dataSpec={b.data_spec}/></section>;
   if(b.block_type==="market_replay")return <section key={b.block_id} className="studio-interactive"><StudioMarketReplay dataSpec={b.data_spec}/></section>;
   if(b.block_type==="image")return <figure key={b.block_id}>{c.url?<img src={c.url} alt={c.alt||""}/>:<div className="studio-doc-placeholder">Изображение · {c.asset_id||b.asset_id||"не выбрано"}</div>}{c.caption&&<figcaption>{c.caption}</figcaption>}</figure>;
   if(b.block_type==="video")return <section key={b.block_id}>{c.url?<video controls src={c.url}/>:<div className="studio-doc-placeholder">Видео · reference</div>}</section>;
   if(b.block_type==="table")return <table key={b.block_id}><thead><tr>{(c.columns||[]).map((x:string,i:number)=><th key={i}>{x}</th>)}</tr></thead><tbody>{(c.rows||[]).map((r:string[],i:number)=><tr key={i}>{r.map((x,j)=><td key={j}>{x}</td>)}</tr>)}</tbody></table>;
   if(b.block_type==="pdf_excerpt")return <blockquote key={b.block_id} className="studio-pdf-excerpt"><strong>{c.title||"PDF / Document excerpt"}</strong><p>{c.text||""}</p><small>{c.page?("стр. "+c.page):""}</small></blockquote>;
   if(b.block_type==="sources")return <section key={b.block_id} className="studio-sources"><h3>Источники</h3><ul>{(c.items||[]).map((x:any,i:number)=><li key={i}>{x.url?<a href={x.url} target="_blank" rel="noreferrer">{x.label||x.url}</a>:x.label||x.driveId||""}</li>)}</ul></section>;
   return <div key={b.block_id}>{c.text||c.title||""}</div>;
  })}
 </div>
}