"use client";
import {ArrowLeft,Printer} from "lucide-react";
export function PrintControls(){return <div className="v6-print-controls"><button onClick={()=>history.back()}><ArrowLeft size={15}/>Назад</button><button onClick={()=>window.print()}><Printer size={15}/>Сохранить как PDF / печать</button></div>}
