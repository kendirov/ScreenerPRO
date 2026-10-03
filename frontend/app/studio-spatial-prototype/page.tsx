"use client";

import dynamic from "next/dynamic";

const StudioWorldV4 = dynamic(() => import("./StudioWorldV4"), { ssr: false });

export default function StudioSpatialPrototypePage() {
  return <StudioWorldV4 />;
}
