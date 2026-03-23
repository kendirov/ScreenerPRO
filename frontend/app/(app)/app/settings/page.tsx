import { EmptyState, SectionHeader } from "@/components/ui/primitives";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Настройки" subtitle="Профиль и параметры рабочего пространства." />
      <EmptyState title="Раздел в подготовке" text="Параметры профиля и персональные настройки будут добавлены следующим шагом." />
    </div>
  );
}
