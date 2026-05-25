"use client";

import { REASON_TAG_STYLES, normalizeReasonTag } from "@/lib/domain/market-card-visual";
import { cn } from "@/lib/utils/cn";

export function ReasonTagChip({ tag, className }: { tag: string; className?: string }) {
  const id = normalizeReasonTag(tag);
  const style = REASON_TAG_STYLES[id] ?? REASON_TAG_STYLES.активность;

  return (
    <span className={cn("lab-chip shrink-0 text-[9px] uppercase tracking-wide", style, className)}>
      {id}
    </span>
  );
}

export function ReasonTagRow({ tags, className }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <ReasonTagChip key={tag} tag={tag} />
      ))}
    </div>
  );
}
