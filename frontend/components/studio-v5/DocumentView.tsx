"use client";
import type {StudioDocumentBlock} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "./MarketChart";
import {StudioMarketReplay} from "./MarketReplay";
import {blockHasPublicationBody,embedSrc,interactiveView,resolveVideoEmbed} from "@/lib/studio-v6/document-model";

export function DocumentBlocksView({blocks,clean=false}:{blocks:StudioDocumentBlock[];clean?:boolean}){
 const ordered=[...blocks].sort((a,b)=>a.ordinal-b.ordinal);
 return <div className={clean?"studio-clean-flow":"studio-doc-renderer"} data-publication={clean?"clean":"edit"}>
  {ordered.map(block=>{
    if(clean&&!blockHasPublicationBody(block))return null;
    return <BlockView key={block.block_id} block={block} clean={clean}/>;
  })}
 </div>
}

function BlockView({block,clean}:{block:StudioDocumentBlock;clean:boolean}){
 const c=block.content||{};
 const view=interactiveView(block);
 if(block.block_type==="divider")return <hr/>;
 if(block.block_type==="heading")return <h2>{c.text||""}</h2>;
 if(block.block_type==="rich_text")return <div className="studio-rich" dangerouslySetInnerHTML={{__html:c.html||""}}/>;
 if(block.block_type==="callout")return <aside className="studio-callout" data-accent={c.accent||"blue"}>{c.text||""}</aside>;
 if(view)return <InteractiveView block={block} clean={clean}/>;
 if(block.block_type==="image")return <ImageView content={c} clean={clean}/>;
 if(block.block_type==="video")return <VideoView content={c} clean={clean}/>;
 if(block.block_type==="pdf_excerpt")return <blockquote className="studio-pdf-excerpt"><strong>{c.title||"Фрагмент"}</strong><p>{c.text||""}</p>{c.page?<small>стр. {c.page}</small>:null}</blockquote>;
 if(block.block_type==="sources")return <section className="studio-sources"><h3>Источники</h3><ul>{(c.items||[]).map((item:any,index:number)=><li key={index}>{item.url?<a href={item.url} target="_blank" rel="noreferrer">{item.label||item.url}</a>:item.label||""}</li>)}</ul></section>;
 if(clean&&!blockHasPublicationBody(block))return null;
 return <div>{c.text||c.title||""}</div>;
}

function ImageView({content,clean}:{content:any;clean:boolean}){
 const src=content.url||content.previewUrl;
 if(!src&&content.svg)return <figure dangerouslySetInnerHTML={{__html:String(content.svg)}}/>;
 if(!src)return clean?null:<div className="studio-doc-placeholder" data-empty-media="image">{content.title||"Изображение"}</div>;
 return <figure><img src={src} alt={content.alt||content.title||""}/>{content.caption?<figcaption>{content.caption}</figcaption>:null}</figure>;
}

function VideoView({content,clean}:{content:any;clean:boolean}){
 const raw=String(content.url||"").trim();
 if(!raw)return clean?null:<div className="studio-doc-placeholder" data-empty-media="video">{content.title||"Видео"}</div>;
 const embed=resolveVideoEmbed(raw);
 if(embed)return <section><iframe title={content.title||"Видео"} src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></section>;
 return <section><video controls src={raw}/></section>;
}

function InteractiveView({block,clean}:{block:StudioDocumentBlock;clean:boolean}){
 const view=interactiveView(block)||"chart";
 const c=block.content||{};
 if(view==="chart"){
  if(!block.data_spec)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">График ещё не настроен</div>;
  return <section className="studio-interactive" data-interactive-view="chart"><h3>{c.title||"График"}</h3><StudioMarketChart dataSpec={block.data_spec}/></section>;
 }
 if(view==="table")return <TableView content={c} clean={clean}/>;
 if(view==="timeline"){
  if(block.data_spec?.display?.renderer==="studio_market_replay"||block.block_type==="market_replay")return <section className="studio-interactive" data-interactive-view="timeline"><StudioMarketReplay dataSpec={block.data_spec}/></section>;
  const items=(c.items||[]).filter((item:any)=>!clean||item?.text||item?.label);
  if(!items.length)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">Таймлайн ещё пуст</div>;
  return <ol className="studio-timeline" data-interactive-view="timeline">{items.map((item:any,index:number)=><li key={index}><strong>{item.label||""}</strong><span>{item.text||""}</span></li>)}</ol>;
 }
 if(view==="visual")return <ImageView content={c} clean={clean}/>;
 const src=embedSrc(c.url||"");
 if(!src)return clean?null:<div className="studio-doc-placeholder" data-empty-media="interactive">Вставка ещё не задана</div>;
 return <section className="studio-interactive" data-interactive-view="embed"><iframe title={c.title||"Вставка"} src={src} allowFullScreen/></section>;
}

function TableView({content,clean}:{content:any;clean:boolean}){
 const columns=content.columns||[];
 const rows=content.rows||[];
 if(clean&&![...columns,...rows.flat()].some((cell:string)=>String(cell||"").trim()))return null;
 return <table data-interactive-view="table"><thead><tr>{columns.map((cell:string,index:number)=><th key={index}>{cell}</th>)}</tr></thead><tbody>{rows.map((row:string[],index:number)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}
