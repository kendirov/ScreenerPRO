import { NextResponse } from "next/server";
const BASE=process.env.TQS_INTELLIGENCE_URL??"http://127.0.0.1:8787";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;try{const r=await fetch(`${BASE}/api/episodes/${encodeURIComponent(id)}`,{cache:"no-store"});return NextResponse.json(await r.json(),{status:r.status,headers:{"Cache-Control":"no-store"}})}catch(e){return NextResponse.json({error:"TQS unavailable"},{status:503})}}
