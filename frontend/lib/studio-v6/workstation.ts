export type CreateKind="text"|"note"|"task"|"voice"|"image"|"video"|"link"|"file"|"chart"|"frame"|"arrow";

const COMMANDS:{kind:CreateKind;title:string;keys:string[]}[]=[
 {kind:"text",title:"Текст",keys:["текст","text"]},
 {kind:"note",title:"Заметка",keys:["заметка","note"]},
 {kind:"task",title:"Задача",keys:["задача","task"]},
 {kind:"voice",title:"Голос",keys:["голос","voice","аудио"]},
 {kind:"image",title:"Изображение",keys:["фото","image","скрин","картин"]},
 {kind:"video",title:"Видео",keys:["youtube","видео","video","rutube","vimeo"]},
 {kind:"chart",title:"График",keys:["график","chart","si","свеч","данные"]},
 {kind:"link",title:"Ссылка",keys:["ссылка","link","url"]},
 {kind:"file",title:"Файл / PDF",keys:["pdf","файл","file"]},
 {kind:"frame",title:"Занятие / комната",keys:["занятие","комната","room","урок","workspace"]},
 {kind:"arrow",title:"Связь",keys:["стрелка","связь","arrow"]},
];

export function creationMatches(query:string){
 const q=query.trim().toLowerCase();
 if(!q)return COMMANDS.slice(0,6);
 return COMMANDS.filter(item=>item.title.toLowerCase().includes(q)||item.keys.some(key=>key.includes(q)||q.includes(key)));
}

export function roomRole(depth:number){return depth<=0?"project":depth===1?"course":depth===2?"lesson":"topic"}

export function lodFromZoom(zoom:number){return zoom<.28?"far":zoom<.6?"mid":"near"}
