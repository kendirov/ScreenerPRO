import { PageHeader, SectionFrame, StatusStrip } from "@/components/shell/page-primitives";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <PageHeader eyebrow="Системный контур" title="Управление" description="Доступ, источники данных и публикации будут собраны здесь без смешивания с торговым терминалом." />
      <StatusStrip tone="warning">В РАЗРАБОТКЕ · настройки пока не изменяют систему</StatusStrip>
      <div className="grid gap-2 md:grid-cols-3">
        {[['Доступ', 'Личная, ученическая и публичная зоны. Авторизация ещё не подключена.'], ['Данные', 'MOEX ISS работает в текущем терминале. ALGOPACK подготовлен архитектурно, но не включён.'], ['Публикации', 'Материалы выпускаются через отдельный Presentation OS после явного подтверждения.']].map(([title, text]) => (
          <SectionFrame key={title} className="p-4"><h2 className="text-sm font-semibold text-lab-text">{title}</h2><p className="mt-2 text-xs leading-relaxed text-lab-muted">{text}</p></SectionFrame>
        ))}
      </div>
    </div>
  );
}
