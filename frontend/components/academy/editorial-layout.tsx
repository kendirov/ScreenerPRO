"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

export function AcademyEditorialLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[1220px]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_45%_at_50%_0%,rgba(14,116,144,0.18),transparent_70%)]" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-14"
      >
        {children}
      </motion.div>
    </div>
  );
}

export function EditorialBadgeRow({ items }: { items: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-800/90 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
