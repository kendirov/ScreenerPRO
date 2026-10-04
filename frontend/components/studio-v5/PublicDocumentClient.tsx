"use client";
import {useEffect,useState} from "react";
import {DocumentBlocksView} from "./DocumentView";
import {studioSupabase} from "@/lib/studio-v5/api";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import styles from "@/app/studio-spatial-prototype/studio-v5.module.css";

type SharedBundle=DocumentBundle&{share:{mode:string;slug:string;documentRevision:number}};

function snapshotBundle(token:string,slug:string):SharedBundle|null{
  try{
    if(!token.startsWith("snap."))return null;
    const raw=token.slice(5).replace(/-/g,"+").replace(/_/g,"/");
    const padded=raw+"=".repeat((4-raw.length%4)%4);
    const bytes=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(data?.v!==1||!data.document||!Array.isArray(data.blocks))return null;
    if(String(data.document.slug||data.document.id)!==slug)return null;
    return {...data,share:{mode:"snapshot",slug,documentRevision:Number(data.document.revision||0)}} as SharedBundle;
  }catch{return null}
}

export function PublicDocumentClient({slug,token}:{slug:string;token:string}){
  const [bundle,setBundle]=useState<SharedBundle|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let live=true;
    void (async()=>{
      try{
        const snapshot=snapshotBundle(token,slug);
        if(snapshot){if(live)setBundle(snapshot);return}
        const {data,error}=await studioSupabase().rpc("studio_public_share_load",{p_token:token});
        if(!live)return;
        if(error||!data||data.document?.slug!==slug){setError("Документ недоступен");return}
        setBundle(data as SharedBundle);
      }catch{
        if(live)setError("Документ недоступен");
      }
    })();
    return()=>{live=false};
  },[slug,token]);

  if(error)return <main className={styles.sharePage}><article className={styles.cleanDocument}><h1>{error}</h1></article></main>;
  if(!bundle)return <main className={styles.sharePage}><article className={styles.cleanDocument}><p>Загрузка документа…</p></article></main>;

  return <main className={styles.sharePage}>
    <article className={styles.cleanDocument}>
      <header>
        <small>{bundle.document.kind}</small>
        <h1>{bundle.document.title}</h1>
        <p>Ревизия {bundle.document.revision} · {bundle.document.semantic_path}</p>
      </header>
      <DocumentBlocksView blocks={bundle.blocks} clean/>
      <footer>Актуальная версия · live blocks сохраняют updatePolicy</footer>
    </article>
  </main>;
}
