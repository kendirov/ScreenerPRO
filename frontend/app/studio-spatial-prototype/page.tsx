"use client";

import dynamic from "next/dynamic";

const StudioSpatialPrototype = dynamic(() => import("./StudioSpatialPrototype"), { ssr: false });

export default function StudioSpatialPrototypePage() {
  return <StudioSpatialPrototype />;
}
