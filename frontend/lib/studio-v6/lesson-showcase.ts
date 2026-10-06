import type {StudioDocument,StudioDocumentBlock} from "@/lib/studio-v5/types";

export const LESSON_SHOWCASE="portal-studio-1";

const WORKSPACE_SVG="data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 440"><rect width="800" height="440" fill="#14171b"/><rect x="28" y="28" width="470" height="250" fill="#1d2228"/><path d="M52 230l70-48 80 18 70-78 80 28 70-64 64 22" fill="none" stroke="#d7b56a" stroke-width="4"/><rect x="518" y="28" width="254" height="384" fill="#191d22"/><path d="M542 78h206M542 118h206M542 158h206M542 198h206M542 238h206" stroke="#5c656e" stroke-width="8"/><rect x="28" y="296" width="470" height="116" fill="#191d22"/><path d="M52 332h390M52 366h300" stroke="#6d6250" stroke-width="8"/></svg>`);

function withContent(block:StudioDocumentBlock,patch:Record<string,unknown>):StudioDocumentBlock{
  return {...block,content:{...(block.content||{}),...patch}};
}

export function upgradeLessonShowcase(documents:StudioDocument[],blocks:StudioDocumentBlock[]){
  const document=documents.find(item=>item.id==="doc-lesson-workspace");
  if(!document||document.metadata?.showcase===LESSON_SHOWCASE)return{documents,blocks,changed:false};
  const mine=blocks.filter(block=>block.document_id===document.id).sort((a,b)=>a.ordinal-b.ordinal);
  if(!mine.some(block=>block.block_id==="lesson-h1"))return{documents,blocks,changed:false};
  const intro=(id:string)=>id==="lesson-h1"||id==="lesson-t1";
  let next=mine.map(block=>{
    if(intro(block.block_id))return withContent(block,{sectionId:"intro",layout:"reading"});
    if(block.block_id==="lesson-call")return withContent(block,{sectionId:"practice",layout:"reading",tone:"practice"});
    if(block.block_id==="lesson-table")return withContent(block,{sectionId:"compare",layout:"compare",view:block.content?.columns?"table":block.content?.view});
    if(block.block_id==="lesson-end"||block.block_id==="lesson-image"){
      const patch:Record<string,unknown>={sectionId:"media",layout:"media"};
      if(block.block_id==="lesson-image"&&!block.content?.url&&!block.content?.previewUrl){
        patch.previewUrl=WORKSPACE_SVG;
        patch.hotspots=[
          {id:"chart",x:30,y:34,title:"График",text:"Центр экрана. Он отвечает на один вопрос: что делать с ценой."},
          {id:"book",x:74,y:42,title:"Стакан",text:"Стоит у цены. Отдельное окно убираем до занятия."},
        ];
      }
      return withContent(block,patch);
    }
    if(block.block_id==="lesson-chart"||block.block_id==="lesson-live")return withContent(block,{sectionId:"lab",layout:"lab"});
    if(block.block_id==="lesson-replay")return withContent(block,{sectionId:"replay",layout:"wide"});
    return block;
  });
  if(!next.some(block=>block.block_id==="lesson-steps")){
    const steps:StudioDocumentBlock={
      block_id:"lesson-steps",document_id:document.id,ordinal:1,block_type:"steps",asset_id:null,revision:1,data_spec:null,
      content:{
        title:"Как собрать экран",
        sectionId:"steps",
        layout:"steps",
        items:[
          {label:"Один экран",text:"График занимает центр. Всё остальное появляется, только если влияет на сделку."},
          {label:"Рядом с ценой",text:"Стакан и лента стоят у графика. Заметки не закрывают цену."},
          {label:"Убрать лишнее",text:"Если панель не отвечает на вопрос «что делать», её нет на экране."},
        ],
      },
    };
    const at=next.findIndex(block=>block.block_id==="lesson-call");
    next.splice(at<0?next.length:at+1,0,steps);
  }
  if(!next.some(block=>block.block_id==="lesson-reveal")){
    const reveal:StudioDocumentBlock={
      block_id:"lesson-reveal",document_id:document.id,ordinal:1,block_type:"interactive",asset_id:null,revision:1,data_spec:null,
      content:{
        view:"reveal",
        title:"Проверка",
        prompt:"Что остаётся на экране?",
        answer:"Только то, что влияет на торговое решение: график в центре, стакан и лента рядом с ценой.",
        sectionId:"check",
        layout:"reading",
      },
    };
    const at=next.findIndex(block=>block.block_id==="lesson-steps");
    next.splice(at<0?next.length:at+1,0,reveal);
  }
  next=next.map((block,index)=>({...block,ordinal:index+1}));
  const documentsNext=documents.map(item=>item.id===document.id?{...item,revision:item.revision+1,metadata:{...(item.metadata||{}),showcase:LESSON_SHOWCASE}}:item);
  const blocksNext=blocks.filter(block=>block.document_id!==document.id).concat(next);
  return{documents:documentsNext,blocks:blocksNext,changed:true};
}
