"use client";

import dynamic from "next/dynamic";

const HomePageScreener = dynamic(() => import("@/components/screener/homepage-screener").then((mod) => mod.HomePageScreener), {
  ssr: false,
});

export function HomePageScreenerClient() {
  return <HomePageScreener />;
}
