import {notFound} from "next/navigation";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import styles from "@/app/studio-spatial-prototype/studio-v5.module.css";
import {readStatelessShare} from "@/lib/studio-v6/share-snapshot";

export const dynamic="force-dynamic";
export default async function PublicDocumentPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{t?:string;s?:string}>}){
 const [{slug},{t,s}]=await Promise.all([params,searchParams]);
 let x:DocumentBundle|null=s?readStatelessShare(s):null;
 if(!x&&t){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://hppbuzbrjoyrwpdinlxk.supabase.co";
  const r=await fetch(base+"/functions/v1/studio-api/share?token="+encodeURIComponent(t),{cache:"no-store"});
  if(r.ok)x=await r.json() as DocumentBundle;
 }
 if(!x||x.document.slug!==slug)notFound();
 return <main className={styles.sharePage}><article className={styles.cleanDocument}><header><small>{x.document.kind}</small><h1>{x.document.title}</h1><p>Ревизия {x.document.revision} · {x.document.semantic_path}</p></header><DocumentBlocksView blocks={x.blocks} clean/><footer>Актуальная версия · live blocks сохраняют updatePolicy</footer></article></main>
}