"use client";

import dynamic from "next/dynamic";

const StudioSpatialPrototype = dynamic(() => import("./StudioSpatialDomPrototype"), { ssr: false });

export default function StudioSpatialPrototypePage() {
  return <StudioSpatialPrototype />;
}
