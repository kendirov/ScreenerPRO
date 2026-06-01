"use client";

import { Focus } from "lucide-react";
import { UI_VIEW_MODE_LABEL, type UiViewMode } from "@/lib/design/design-tokens";
import { useUiViewMode } from "@/lib/hooks/use-ui-view-mode";
import { cn } from "@/lib/utils/cn";

const MODES: UiViewMode[] = ["normal", "focus", "presentation"];

export function UiViewModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useUiViewMode();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-slate-900/55 p-0.5 backdrop-blur-md",
        className,
      )}
      role="group"
      aria-label="Режим отображения"
    >
      {MODES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setMode(item)}
          className={cn(
            "rounded-md px-2 py-1 text-[10px] font-medium transition-[color,background,box-shadow] duration-200",
            mode === item
              ? "bg-white/[0.08] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "text-slate-500 hover:text-slate-300",
          )}
          title={UI_VIEW_MODE_LABEL[item]}
        >
          {item === "focus" ? (
            <span className="inline-flex items-center gap-1">
              <Focus className="h-3 w-3" aria-hidden />
              {UI_VIEW_MODE_LABEL[item]}
            </span>
          ) : (
            UI_VIEW_MODE_LABEL[item]
          )}
        </button>
      ))}
    </div>
  );
}
