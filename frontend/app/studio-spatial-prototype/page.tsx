"use client";

import dynamic from "next/dynamic";
import "tldraw/tldraw.css";

const StudioSpatialPrototype = dynamic(() => import("./StudioSpatialPrototype"), { ssr: false });

export default function StudioSpatialPrototypePage() {
  return <StudioSpatialPrototype />;
}
