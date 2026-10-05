"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {Extension,Mark,mergeAttributes} from "@tiptap/core";

const TextStyle=Mark.create({
 name:"tqsTextStyle",
 addAttributes(){return{
  color:{default:null,parseHTML:e=>e.style.color||null},
  backgroundColor:{default:null,parseHTML:e=>e.style.backgroundColor||null},
  fontFamily:{default:null,parseHTML:e=>e.style.fontFamily||null},
  fontSize:{default:null,parseHTML:e=>e.style.fontSize||null},
  textDecoration:{default:null,parseHTML:e=>e.style.textDecoration||null},
 }},
 parseHTML(){return[{tag:"span"}]},
 renderHTML({HTMLAttributes}){
  const style=[HTMLAttributes.color&&`color:${HTMLAttributes.color}`,HTMLAttributes.backgroundColor&&`background-color:${HTMLAttributes.backgroundColor}`,HTMLAttributes.fontFamily&&`font-family:${HTMLAttributes.fontFamily}`,HTMLAttributes.fontSize&&`font-size:${HTMLAttributes.fontSize}`,HTMLAttributes.textDecoration&&`text-decoration:${HTMLAttributes.textDecoration}`].filter(Boolean).join(";");
  return ["span",mergeAttributes(HTMLAttributes,{style}),0]
 }
});
const LinkMark=Mark.create({name:"tqsLink",inclusive:false,addAttributes(){return{href:{default:null},target:{default:"_blank"},rel:{default:"noopener noreferrer"}}},parseHTML(){return[{tag:"a[href]"}]},renderHTML({HTMLAttributes}){return ["a",mergeAttributes(HTMLAttributes),0]}});
const Alignment=Extension.create({name:"tqsAlignment",addGlobalAttributes(){return[{types:["paragraph","heading"],attributes:{textAlign:{default:null,parseHTML:e=>e.style.textAlign||null,renderHTML:a=>a.textAlign?{style:`text-align:${a.textAlign}`}:{}}}}]}});

type Props={html:string;editable?:boolean;className?:string;compact?:boolean;autofocus?:boolean;onChange?:(html:string)=>void;onBlur?:(html:string)=>void};
export function RichEditor({html,editable=true,className,compact=false,autofocus=false,onChange,onBlur}:Props){
 const lastExternal=useRef(html),[toolbarOpen,setToolbarOpen]=useState(false),extensions=useMemo(()=>[StarterKit,TextStyle,LinkMark,Alignment],[]);
 const editor=useEditor({extensions,content:html||"<p></p>",editable,immediatelyRender:false,autofocus,onUpdate:({editor})=>onChange?.(editor.getHTML()),onFocus:({editor})=>setToolbarOpen(!editor.state.selection.empty),onSelectionUpdate:({editor})=>setToolbarOpen(editable&&!editor.state.selection.empty),onBlur:({editor})=>{setToolbarOpen(false);onBlur?.(editor.getHTML())}});
 useEffect(()=>{editor?.setEditable(editable)},[editor,editable]);
 useEffect(()=>{if(!editor||html===lastExternal.current)return;lastExternal.current=html;if(editor.getHTML()!==html)editor.commands.setContent(html||"<p></p>",{emitUpdate:false})},[editor,html]);
 if(!editor)return <div className={className}/>;
 const style=(attrs:Record<string,string|null>)=>editor.chain().focus().setMark("tqsTextStyle",attrs).run();
 const align=(value:string)=>{editor.chain().focus().updateAttributes("paragraph",{textAlign:value}).updateAttributes("heading",{textAlign:value}).run()};
 return <div className={["tqs-rich-editor",compact?"is-compact":"",className||""].join(" ")}>
  {editable&&toolbarOpen&&<div className="tqs-rich-toolbar is-floating" data-studio-ui>
   <button type="button" aria-label="Полужирный" className={editor.isActive("bold")?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleBold().run()}>B</button>
   <button type="button" aria-label="Курсив" className={editor.isActive("italic")?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleItalic().run()}><i>I</i></button>
   <button type="button" aria-label="Подчёркивание" onMouseDown={e=>e.preventDefault()} onClick={()=>style({textDecoration:"underline"})}><u>U</u></button>
   <button type="button" aria-label="Заголовок" className={editor.isActive("heading",{level:2})?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>H2</button>
   <button type="button" aria-label="Маркированный список" className={editor.isActive("bulletList")?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleBulletList().run()}>•≡</button>
   <button type="button" aria-label="Нумерованный список" className={editor.isActive("orderedList")?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleOrderedList().run()}>1.</button>
   <button type="button" aria-label="Цитата" className={editor.isActive("blockquote")?"active":""} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleBlockquote().run()}>❝</button>
   <select aria-label="Размер текста" defaultValue="" onChange={e=>e.target.value&&style({fontSize:e.target.value})}><option value="">Размер</option><option value="12px">12</option><option value="14px">14</option><option value="18px">18</option><option value="24px">24</option><option value="32px">32</option></select>
   <select aria-label="Шрифт" defaultValue="" onChange={e=>e.target.value&&style({fontFamily:e.target.value})}><option value="">Шрифт</option><option value="Inter,system-ui,sans-serif">Inter</option><option value="Georgia,serif">Georgia</option><option value="ui-monospace,monospace">Mono</option></select>
   <label title="Цвет текста"><span>А</span><input aria-label="Цвет текста" type="color" defaultValue="#e8e4dc" onInput={e=>style({color:(e.target as HTMLInputElement).value})}/></label>
   <label title="Выделение"><span>▰</span><input aria-label="Цвет выделения" type="color" defaultValue="#6b5623" onInput={e=>style({backgroundColor:(e.target as HTMLInputElement).value})}/></label>
   {(["left","center","right"] as const).map(a=><button type="button" key={a} aria-label={a==="left"?"По левому краю":a==="center"?"По центру":"По правому краю"} onMouseDown={e=>e.preventDefault()} onClick={()=>align(a)}>{a==="left"?"⇤":a==="center"?"↔":"⇥"}</button>)}
   <button type="button" aria-label="Ссылка" onMouseDown={e=>e.preventDefault()} onClick={()=>{const href=window.prompt("URL");if(href)editor.chain().focus().setMark("tqsLink",{href,target:"_blank",rel:"noopener noreferrer"}).run()}}>↗</button>
  </div>}
  <EditorContent editor={editor}/>
 </div>
}
