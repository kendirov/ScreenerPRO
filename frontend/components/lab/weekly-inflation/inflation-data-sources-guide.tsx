"use client";

import Link from "next/link";
import { Download, ExternalLink, Link2, Upload } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

type GuideAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: "url" | "upload" | "download" | "external";
};

type GuideCard = {
  title: string;
  role: string;
  status: string;
  statusTone: "cyan" | "amber" | "violet" | "muted";
  detail: string;
  actions: GuideAction[];
};

export function InflationDataSourcesGuide({
  onInsertOfficialUrl,
  onOpenCsvImport,
  onDownloadTemplate,
  className,
}: {
  onInsertOfficialUrl: () => void;
  onOpenCsvImport: () => void;
  onDownloadTemplate: () => void;
  className?: string;
}) {
  const cards: GuideCard[] = [
    {
      title: "Росстат / ЕМИСС",
      role: "Основной официальный источник",
      status: "официальный · ручная проверка",
      statusTone: "cyan",
      detail: "Недельный ИПЦ, период, с начала года. Цифры сверяйте здесь перед эфиром.",
      actions: [
        { label: "Официальный URL", onClick: onInsertOfficialUrl, icon: "url" },
        { label: "Загрузить CSV", onClick: onOpenCsvImport, icon: "upload" },
      ],
    },
    {
      title: "Manual CSV",
      role: "Работает сейчас",
      status: "подключено",
      statusTone: "cyan",
      detail: "Быстрый контроль формата и история в localStorage. Без API и без фейков.",
      actions: [
        { label: "Шаблон CSV", onClick: onDownloadTemplate, icon: "download" },
        { label: "Импорт CSV", onClick: onOpenCsvImport, icon: "upload" },
      ],
    },
    {
      title: "Минэкономразвития",
      role: "Комментарий и обзор",
      status: "справочно",
      statusTone: "muted",
      detail: "Контекст и формулировки для эфира. Не заменяет официальный ряд Росстата.",
      actions: [],
    },
    {
      title: "Smart-Lab",
      role: "Календарь событий",
      status: "не источник цифры",
      statusTone: "violet",
      detail: "Даты публикаций, события ЦБ и отчётности. Цифру инфляции отсюда не берём.",
      actions: [{ label: "Подготовка", href: "/lab/preparation", icon: "external" }],
    },
  ];

  return (
    <LabGlassPanel depth={20} className={cn("p-4", className)}>
      <LabSectionHeading>Где взять данные</LabSectionHeading>
      <p className="mb-4 text-[11px] text-lab-muted">
        Четыре канала — один принцип: на дашборде только то, что вы явно загрузили или проверили.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <GuideCardView key={card.title} card={card} />
        ))}
      </div>
    </LabGlassPanel>
  );
}

function GuideCardView({ card }: { card: GuideCard }) {
  const tone = STATUS_TONES[card.statusTone];

  return (
    <div className={cn("flex h-full flex-col rounded-xl border px-3 py-3", tone.border, tone.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-lab-text">{card.title}</p>
        <span className={cn("lab-chip px-2 py-0.5 text-[9px]", tone.chip)}>{card.status}</span>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-lab-muted">{card.role}</p>
      <p className="mt-2 flex-1 text-[11px] leading-relaxed text-lab-dim">{card.detail}</p>

      {card.actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.actions.map((action) => (
            <GuideActionButton key={action.label} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GuideActionButton({ action }: { action: GuideAction }) {
  const className =
    "inline-flex items-center gap-1 rounded-lg border border-lab-border/80 bg-lab-bg-deep/40 px-2 py-1 text-[10px] text-lab-text transition-colors hover:border-lab-border-strong hover:bg-lab-surface-strong";

  const icon =
    action.icon === "url" ? (
      <Link2 className="h-3 w-3" />
    ) : action.icon === "upload" ? (
      <Upload className="h-3 w-3" />
    ) : action.icon === "download" ? (
      <Download className="h-3 w-3" />
    ) : action.icon === "external" ? (
      <ExternalLink className="h-3 w-3" />
    ) : null;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {icon}
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {icon}
      {action.label}
    </button>
  );
}

const STATUS_TONES = {
  cyan: {
    border: "border-lab-cyan/22",
    bg: "bg-lab-cyan/5",
    chip: "border-lab-cyan/28 bg-lab-cyan/10 text-lab-cyan",
  },
  amber: {
    border: "border-lab-amber/22",
    bg: "bg-lab-amber/5",
    chip: "border-lab-amber/28 bg-lab-amber/10 text-lab-amber",
  },
  violet: {
    border: "border-lab-violet/22",
    bg: "bg-lab-violet/5",
    chip: "border-lab-violet/28 bg-lab-violet/10 text-lab-violet",
  },
  muted: {
    border: "border-lab-border",
    bg: "bg-lab-surface-soft",
    chip: "text-lab-muted",
  },
} as const;
