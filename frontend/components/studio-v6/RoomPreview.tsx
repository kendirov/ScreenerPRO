import type {PreviewMark} from "@/lib/studio-v6/room-preview";

const FILL:Record<string,string>={
  frame:"rgba(224,177,90,.78)",
  image:"#8d74c8",
  chart:"#3f8f9e",
  diagram:"#c46a4a",
  text:"rgba(243,239,232,.62)",
  task:"#6f8f63",
  voice:"#8d74c8",
};

export function RoomPreview({marks,title}:{marks:PreviewMark[];title?:string}){
  return <svg className="room-preview" viewBox="0 0 72 48" role="img" aria-label={title||"Превью комнаты"} data-testid="room-preview">
    <rect width="72" height="48" rx="6" fill="rgba(255,255,255,.04)"/>
    {marks.map(mark=>{
      const x=Math.max(3,Math.min(60,4+mark.x*64));
      const y=Math.max(3,Math.min(38,4+mark.y*40));
      const width=Math.max(2,Math.min(66-x,Math.max(2,mark.w*64)));
      const height=Math.max(2,Math.min(44-y,Math.max(2,mark.h*40)));
      if(mark.kind==="frame")return <rect key={mark.id} x={x} y={y} width={width} height={height} rx="1.5" fill="none" stroke="rgba(224,177,90,.72)" strokeWidth="1"/>;
      return <rect key={mark.id} x={x} y={y} width={width} height={height} rx="1" fill={FILL[mark.kind]||"rgba(243,239,232,.55)"}/>;
    })}
  </svg>;
}
