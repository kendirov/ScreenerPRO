"use client";

import Link from "next/link";
import { Download, Link2, Upload } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import { cn } from "@/lib/utils/cn";

type GuideAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: "url" | "upload" | "download";
};

type GuideCard = {
  title: string;
  status: string;
  statusTone: "cyan" | "amber" | "violet" | "muted";
  takeItems: string[];
  skipItems?: string[];
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
      status: "основной официальный источник · авто — эксперимент",
      statusTone: "cyan",
      takeItems: [
        "недельный ИПЦ",
        "период",
        "с начала года",
        "категории, если доступны",
      ],
      actions: [
        { label: "Вставить официальный URL", onClick: onInsertOfficialUrl, icon: "url" },
        { label: "Загрузить CSV", onClick: onOpenCsvImport, icon: "upload" },
      ],
    },
    {
      title: "Manual CSV",
      status: "работает сейчас",
      statusTone: "cyan",
      takeItems: ["headlinePct", "категории", "sourceUrl"],
      actions: [
        { label: "Скачать шаблон", onClick: onDownloadTemplate, icon: "download" },
        { label: "Импортировать CSV", onClick: onOpenCsvImport, icon: "upload" },
      ],
    },
    {
      title: "Smart-Lab",
      status: "календарь / события",
      statusTone: "violet",
      takeItems: [
        "дата публикации",
        "события ЦБ / инфляции",
        "дивиденды / отчёты",
      ],
      skipItems: ["не использовать как основной источник цифры инфляции"],
      actions: [{ label: "Открыть подготовку", href: "/lab/preparation" }],
    },
    {
      title: "Минэкономразвития",
      status: "обзор / комментарий",
      statusTone: "muted",
      takeItems: [
        "комментарий по инфляции",
        "рыночный контекст",
        "не заменяет официальный ряд",
      ],
      actions: [],
    },
  ];

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Где взять данные</LabSectionHeading>
      <p className="mb-3 text-[11px] text-lab-muted">
        Цифры на дашборде — только из вашего импорта. Автозагрузка Росстат/ЕМИСС пока экспериментальная.
      </p>

      <div className="grid gap-2 lg:grid-cols-2">
        {cards.map((card) => (
          <GuideCardView key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

function GuideCardView({ card }: { card: GuideCard }) {
  const tone = STATUS_TONES[card.statusTone];

  return (
    <div className={cn("rounded-xl border px-3 py-3", tone.border, tone.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-lab-text">{card.title}</p>
        <span className={cn("lab-chip px-2 py-0.5 text-[10px]", tone.chip)}>{card.status}</span>
      </div>

      <div className="mt-2 space-y-2 text-[11px]">
        <div>
          <p className="text-lab-dim">Что брать</p>
          <ul className="mt-1 space-y-0.5 text-lab-muted">
            {card.takeItems.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        {card.skipItems?.length ? (
          <div>
            <p className="text-lab-dim">Не брать</p>
            <ul className="mt-1 space-y-0.5 text-lab-amber/90">
              {card.skipItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

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
    "inline-flex items-center gap-1 rounded-lg border border-lab-border px-2 py-1 text-[11px] text-lab-text hover:bg-lab-bg-deep/50";

  const icon =
    action.icon === "url" ? (
      <Link2 className="h-3.5 w-3.5" />
    ) : action.icon === "upload" ? (
      <Upload className="h-3.5 w-3.5" />
    ) : action.icon === "download" ? (
      <Download className="h-3.5 w-3.5" />
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
    border: "border-lab-cyan/25",
    bg: "bg-lab-cyan/5",
    chip: "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan",
  },
  amber: {
    border: "border-lab-amber/25",
    bg: "bg-lab-amber/5",
    chip: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
  },
  violet: {
    border: "border-lab-violet/25",
    bg: "bg-lab-violet/5",
    chip: "border-lab-violet/30 bg-lab-violet/10 text-lab-violet",
  },
  muted: {
    border: "border-lab-border",
    bg: "bg-lab-bg-deep/30",
    chip: "text-lab-muted",
  },
} as const;
