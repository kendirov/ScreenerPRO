import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type LabGlassPanelVariant =
  | "default"
  | "strong"
  | "hot"
  | "danger"
  | "success"
  | "amber";

export type LabGlassPanelDepth = 10 | 20 | 30;

const variantClass: Record<LabGlassPanelVariant, string> = {
  default: "",
  strong: "lab-glass-panel--strong",
  hot: "lab-glass-panel--hot",
  danger: "lab-glass-panel--danger",
  success: "lab-glass-panel--success",
  amber: "lab-glass-panel--amber",
};

const depthClass: Record<LabGlassPanelDepth, string> = {
  10: "lab-depth-10",
  20: "lab-depth-20",
  30: "lab-depth-30",
};

export type LabGlassPanelProps<T extends ElementType = "div"> = {
  children: ReactNode;
  className?: string;
  variant?: LabGlassPanelVariant;
  depth?: LabGlassPanelDepth;
  interactive?: boolean;
  as?: T;
};

export function LabGlassPanel<T extends ElementType = "div">({
  children,
  className,
  variant = "default",
  depth = 20,
  interactive = false,
  as,
}: LabGlassPanelProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "lab-glass-panel",
        variantClass[variant],
        depthClass[depth],
        interactive && "lab-glass-panel--interactive cursor-default",
        className,
      )}
    >
      {children}
    </Component>
  );
}
