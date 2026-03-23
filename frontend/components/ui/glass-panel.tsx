import { cn } from "@/lib/utils/cn";

export function GlassPanel({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.05),0_16px_40px_-20px_rgba(8,145,178,0.35)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </section>
  );
}
