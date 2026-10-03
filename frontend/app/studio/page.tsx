"use client";
import dynamic from "next/dynamic";
const StudioWorldV5=dynamic(()=>import("../studio-spatial-prototype/StudioWorldV5"),{ssr:false});
export default function StudioPage(){return <StudioWorldV5/>}
