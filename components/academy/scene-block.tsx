"use client";

import { motion } from "motion/react";
import { GlassPanel } from "@/components/ui/glass-panel";

export function SceneBlock({
  title,
  kicker,
  text,
}: {
  title: string;
  kicker: string;
  text: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="min-h-[68vh] py-10"
    >
      <GlassPanel className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{kicker}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">{title}</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{text}</p>
      </GlassPanel>
    </motion.section>
  );
}
