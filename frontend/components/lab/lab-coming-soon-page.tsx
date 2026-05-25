"use client";

import Link from "next/link";
import { LabPageShell } from "@/components/lab/lab-page-shell";

export function LabComingSoonPage({
  title,
  description,
  backHref = "/materials",
  backLabel = "Каталог материалов",
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <LabPageShell
      title={title}
      description={description}
      pills={[
        { label: "Лаб", tone: "accent" },
        { label: "скоро", tone: "meta" },
      ]}
    >
      <div className="lab-glass-panel flex min-h-[min(48vh,420px)] flex-col items-center justify-center border-dashed px-6 py-12 text-center">
        <p className="lab-type-section text-sm text-lab-violet">В РАЗРАБОТКЕ</p>
        <p className="mt-3 max-w-md text-base font-semibold text-lab-text">
          Раздел скоро появится в каталоге материалов
        </p>
        <p className="lab-type-caption mt-2 max-w-lg text-sm leading-relaxed">
          Маршрут уже зарезервирован в навигации. Пока можно открыть другие лаборатории или вернуться к
          пульту рынка.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/screener"
            className="lab-status-chip lab-chip-live px-4 py-2 text-xs font-medium"
          >
            Пульт рынка
          </Link>
          <Link
            href={backHref}
            className="lab-status-chip lab-chip-dev px-4 py-2 text-xs transition hover:text-lab-text"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </LabPageShell>
  );
}
