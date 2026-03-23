"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { GlassPanel } from "@/components/ui/glass-panel";

export function AcademyHero({
  kicker,
  title,
  subtitle,
  meta,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <header className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-[0_0_0_1px_rgba(148,163,184,0.05),0_20px_40px_-24px_rgba(8,145,178,0.4)] backdrop-blur-md md:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{kicker}</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{subtitle}</p>
      <p className="mt-5 text-xs text-slate-500">{meta}</p>
    </header>
  );
}

export function AcademySection({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">{title}</h2>
      <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{text}</p>
      {children}
    </motion.section>
  );
}

export function StickyVisualSection({
  title,
  text,
  visual,
  notes,
}: {
  title: string;
  text: string;
  visual: ReactNode;
  notes: string[];
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          {notes.map((note) => (
            <li key={note} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
      </div>
      <GlassPanel className="overflow-hidden">{visual}</GlassPanel>
    </section>
  );
}

export function AcademyTakeaway({
  title,
  items,
}: {
  title: string;
  items: Array<{ term: string; value: string }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 md:p-6">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.term} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.term}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
