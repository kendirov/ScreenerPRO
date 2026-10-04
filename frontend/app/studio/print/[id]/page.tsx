import {notFound} from "next/navigation";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import {PrintControls} from "@/components/studio-v6/PrintControls";
export const dynamic="force-dynamic";
const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api";
async function load(id:string,share?:string){
  if(share){try{const u=new URL(share,"http://localhost"),token=u.searchParams.get("t");if(token){const r=await fetch(`${EDGE}/share?token=${encodeURIComponent(token)}`,{cache:"no-store"});if(r.ok){const x=await r.json();if(x?.document?.id===id)return x as DocumentBundle}}}catch{}}
  const r=await fetch(EDGE+"/public/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"getDocument",payload:{documentId:id}}),cache:"no-store"});if(!r.ok)return null;const x=await r.json();return x?.ok?x.data as DocumentBundle:null
}
export default async function StudioPrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{share?:string}>}){const [{id},q]=await Promise.all([params,searchParams]),b=await load(id,q.share);if(!b)notFound();const livePath=q.share||`/studio?document=${encodeURIComponent(b.document.id)}`;return <main className="v6-print-page"><PrintControls/><article className="v6-print-document" data-testid="v6-print-document"><header><small>TQS Studio · {b.document.kind}</small><h1>{b.document.title}</h1><p>{b.document.semantic_path}</p><div className="v6-print-meta"><span>Ревизия {b.document.revision}</span><span>{new Date().toISOString().slice(0,10)}</span></div></header><DocumentBlocksView blocks={b.blocks.filter(x=>!x.content?.hidden)} clean/><footer><strong>Актуальная рабочая версия:</strong><span>{livePath}</span><small>Экспортировано из TQS Studio · canonical print renderer</small></footer></article></main>}
