"use client";
import dynamic from "next/dynamic";
const StudioWorldV5=dynamic(()=>import("./StudioWorldV5"),{ssr:false});
export default function StudioSpatialPrototypePage(){return <StudioWorldV5/>}
