import { EmptyState, SectionHeader } from "@/components/ui/primitives";

export default function WatchlistPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Списки наблюдения" subtitle="Персональные подборки инструментов будут подключены на следующем этапе." />
      <EmptyState title="Списков пока нет" text="Добавьте первый список после подключения пользовательского профиля." />
    </div>
  );
}
