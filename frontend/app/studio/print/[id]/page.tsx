import {notFound} from "next/navigation";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import {PrintControls} from "@/components/studio-v6/PrintControls";
import {readStatelessShare} from "@/lib/studio-v6/share-snapshot";
export const dynamic="force-dynamic";
const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api";
async function load(id:string,share?:string){
  if(share){try{const u=new URL(share,"http://localhost"),snapshot=u.searchParams.get("s"),token=u.searchParams.get("t");if(snapshot){const x=readStatelessShare(snapshot);if(x?.document?.id===id)return x}if(token){const r=await fetch(`${EDGE}/share?token=${encodeURIComponent(token)}`,{cache:"no-store"});if(r.ok){const x=await r.json();if(x?.document?.id===id)return x as DocumentBundle}}}catch{}}
  const r=await fetch(EDGE+"/public/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"getDocument",payload:{documentId:id}}),cache:"no-store"});if(!r.ok)return null;const x=await r.json();return x?.ok?x.data as DocumentBundle:null
}
export default async function StudioPrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{share?:string}>}){const [{id},q]=await Promise.all([params,searchParams]),b=await load(id,q.share);if(!b)notFound();return <main className="v6-print-page"><PrintControls/><article className="v6-print-document studio-publication" data-testid="v6-print-document"><header><small>TQS Studio · {b.document.kind}</small><h1>{b.document.title}</h1><p>{b.document.semantic_path}</p></header><DocumentBlocksView blocks={b.blocks.filter(x=>!x.content?.hidden)} clean/></article></main>}
