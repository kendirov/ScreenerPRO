import { cn } from "@/lib/utils/cn";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

export function GlassPanel({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <LabGlassPanel depth={20} className={cn("p-5", className)}>
      {children}
    </LabGlassPanel>
  );
}
