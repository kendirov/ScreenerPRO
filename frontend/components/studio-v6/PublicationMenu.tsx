"use client";
import {Copy,Download,ExternalLink,Link2Off,Share2} from "lucide-react";

type Status="DRAFT"|"PUBLISHED"|"STALE"|null;
export function PublicationMenu({open,status,url,publishing,pdfing,onToggle,onPublish,onCopy,onOpen,onPdf,onDisable}:{open:boolean;status:Status;url?:string;publishing:boolean;pdfing:boolean;onToggle:()=>void;onPublish:()=>void;onCopy:()=>void;onOpen:()=>void;onPdf:()=>void;onDisable:()=>void}){
 const label=status==="PUBLISHED"?"Опубликовано":status==="STALE"?"Изменения не опубликованы":"Черновик";
 const action=status==="STALE"?"Обновить публикацию":status==="PUBLISHED"?"Опубликовать заново":"Опубликовать";
 return <div className="v6-share-wrap">
  <button aria-expanded={open} aria-haspopup="dialog" onClick={onToggle}><Share2 size={14}/>Публикация</button>
  {open&&<div className="v6-share-popover" role="dialog" aria-label="Публикация" data-testid="v6-share-popover">
   <strong>{label}</strong>
   <p>{status==="STALE"?"Ссылка всё ещё открывает прошлую версию.":status==="PUBLISHED"?"Ссылка открывает опубликованную версию.":"Эта ссылка открывает это занятие."}</p>
   {url?<input aria-label="Публичная ссылка" readOnly value={url}/>:null}
   <div>
    <button onClick={onOpen} disabled={!url}><ExternalLink size={13}/>Открыть</button>
    <button onClick={onCopy} disabled={!url}><Copy size={13}/>Копировать ссылку</button>
    <button onClick={onPdf} disabled={pdfing}><Download size={13}/>{pdfing?"PDF…":"Сохранить PDF"}</button>
    <button onClick={onPublish} disabled={publishing}>{publishing?"Публикация…":action}</button>
    {url?<button className="danger" onClick={onDisable} disabled={publishing}><Link2Off size={13}/>Отключить ссылку</button>:null}
   </div>
  </div>}
 </div>
}
