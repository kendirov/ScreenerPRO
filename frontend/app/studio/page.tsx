"use client";
import dynamic from "next/dynamic";

const StudioWorldV6 = dynamic(() => import("@/components/studio-v6/StudioWorldV6"), {
  ssr: false,
  loading: () => null,
});

export default function StudioPage() {
  return <StudioWorldV6 />;
}
