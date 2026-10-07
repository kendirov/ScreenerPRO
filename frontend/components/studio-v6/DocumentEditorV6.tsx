"use client";
import type {DocumentBundle} from "@/lib/studio-v5/types";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import {handoutBlocks} from "@/lib/studio-v6/document-model";

export type DocumentMode="edit"|"preview";
export type AuthoringFocus={blockId:string;ordinal:number;blockType:string};

export function DocumentEditorV6({bundle,mode}:{bundle:DocumentBundle;onBundle?:(value:DocumentBundle)=>void;mode:DocumentMode;onFocus?:(focus:AuthoringFocus|null)=>void}){
 const visible=[...bundle.blocks].sort((a,b)=>a.ordinal-b.ordinal).filter(block=>!block.content?.hidden);
 return <div className="studio-publication v6-doc-preview v6-handout" data-testid={mode==="edit"?"ordered-block-editor-v6":"document-preview"} data-handout="page" data-mode={mode}><DocumentBlocksView blocks={handoutBlocks(visible)} clean/></div>;
}
