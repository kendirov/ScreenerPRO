"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lab-cyan/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "lab-btn-primary border border-lab-border-hot bg-gradient-to-b from-lab-cyan/90 to-lab-blue/80 text-lab-bg-deep shadow-[var(--lab-glow-cyan)] hover:from-lab-cyan hover:to-lab-blue hover:shadow-[0_0_28px_rgba(34,211,238,0.42),var(--lab-glow-violet)]",
        secondary:
          "lab-btn-secondary border border-lab-border bg-lab-surface-glass text-lab-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-lab-border-hot hover:bg-lab-surface-glass/90",
        warning:
          "lab-btn-warning border border-lab-border-amber bg-lab-amber/12 text-lab-amber hover:shadow-[var(--lab-glow-amber)]",
        active:
          "lab-btn-active border border-lab-border-hot bg-lab-cyan/16 text-lab-cyan shadow-[var(--lab-glow-cyan)]",
        ghost: "text-lab-muted hover:bg-lab-surface-glass hover:text-lab-text",
        outline:
          "border border-lab-border bg-lab-surface-glass/80 text-lab-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md hover:border-lab-border-hot hover:bg-lab-surface/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
