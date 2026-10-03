import {notFound} from "next/navigation";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import styles from "@/app/studio-spatial-prototype/studio-v5.module.css";

export const dynamic="force-dynamic";

export default async function PublicDocumentPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{t?:string}>}){
 const [{slug},{t}]=await Promise.all([params,searchParams]);if(!t)notFound();
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://hppbuzbrjoyrwpdinlxk.supabase.co";
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";if(!key)notFound();
 const r=await fetch(base+"/rest/v1/rpc/studio_public_share_load",{
  method:"POST",headers:{"Content-Type":"application/json","apikey":key,"Authorization":`Bearer ${key}`},
  body:JSON.stringify({p_token:t}),cache:"no-store",signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)notFound();
 const x=await r.json() as (DocumentBundle&{share:{mode:string;slug:string;documentRevision:number}})|null;
 if(!x?.document||x.document.slug!==slug)notFound();
 return <main className={styles.sharePage}><article className={styles.cleanDocument}><header><small>{x.document.kind}</small><h1>{x.document.title}</h1><p>Ревизия {x.document.revision} · {x.document.semantic_path}</p></header><DocumentBlocksView blocks={x.blocks} clean/><footer>Актуальная версия · live blocks сохраняют updatePolicy</footer></article></main>
}
