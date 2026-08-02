import { ArrowUpRight, Blocks, BookOpenCheck, ShieldCheck } from "lucide-react";
import { PageHeader, SectionFrame, StatusStrip } from "@/components/shell/page-primitives";

function getPresentationOsStudioUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_PRESENTATION_OS_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return new URL("/studio", url).toString();
  } catch {
    return null;
  }
}

const capabilities = [
  {
    title: "Studio",
    text: "Черновики, темы, курсы и уроки остаются в отдельном контентном ядре Presentation OS.",
    icon: Blocks,
  },
  {
    title: "Player",
    text: "Опубликованные материалы открываются отдельными стабильными ссылками, без доступа к личной студии.",
    icon: BookOpenCheck,
  },
  {
    title: "Граница доступа",
    text: "Общая авторизация и единый каталог релизов ещё не подключены. Данные между приложениями не смешиваются.",
    icon: ShieldCheck,
  },
] as const;

export default function StudioPage() {
  const studioUrl = getPresentationOsStudioUrl();

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader
        eyebrow="Контентное ядро"
        title="Студия"
        description="Рабочее пространство для сборки уроков, материалов и публичных релизов. Presentation OS остаётся отдельным приложением с явным контрактом интеграции."
        actions={studioUrl ? (
          <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-lab-border-hot bg-lab-cyan/8 px-3 text-xs font-medium text-lab-cyan transition-colors hover:bg-lab-cyan/12">
            Открыть Studio <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : undefined}
      />

      <StatusStrip tone={studioUrl ? "live" : "warning"}>
        {studioUrl ? "МОСТ НАСТРОЕН · откроется отдельное приложение" : "НЕ ПОДКЛЮЧЕНО · задайте NEXT_PUBLIC_PRESENTATION_OS_URL"}
      </StatusStrip>

      <div className="grid gap-2 md:grid-cols-3">
        {capabilities.map(({ title, text, icon: Icon }) => (
          <SectionFrame key={title} className="p-4">
            <Icon className="h-4 w-4 text-lab-violet" />
            <h2 className="mt-5 text-sm font-semibold text-lab-text">{title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-lab-muted">{text}</p>
          </SectionFrame>
        ))}
      </div>

      {!studioUrl ? (
        <SectionFrame className="border-dashed p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-lab-dim">Текущий статус</p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-lab-muted">
            Это честная точка входа, а не имитация редактора. Следующий безопасный шаг — подключить URL staging-версии Presentation OS, затем добавить подписанный manifest релиза и единый каталог опубликованных материалов.
          </p>
        </SectionFrame>
      ) : null}
    </div>
  );
}
