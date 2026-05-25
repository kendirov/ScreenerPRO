import { cn } from "@/lib/utils/cn";

export function GlassPanel({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <section className={cn("lab-glass-panel p-5", className)}>
      {children}
    </section>
  );
}
