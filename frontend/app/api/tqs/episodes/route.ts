import { NextResponse } from "next/server";
const BASE=process.env.TQS_INTELLIGENCE_URL??"http://127.0.0.1:8787";
export async function GET(request:Request){const u=new URL(request.url);const q=u.searchParams.toString();try{const r=await fetch(`${BASE}/api/episodes?${q}`,{cache:"no-store"});return NextResponse.json(await r.json(),{status:r.status,headers:{"Cache-Control":"no-store"}})}catch(e){return NextResponse.json([],{status:503})}}
