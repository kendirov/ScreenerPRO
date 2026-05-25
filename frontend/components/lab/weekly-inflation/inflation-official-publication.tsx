"use client";

import * as React from "react";
import { ExternalLink, Link2, Save } from "lucide-react";
import {
  createDefaultOfficialPublicationForm,
  type WeeklyInflationOfficialPublication,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

const inputClass =
  "w-full rounded-lg border border-lab-border bg-lab-bg-deep/60 px-2.5 py-1.5 text-sm text-lab-text outline-none focus:border-lab-violet/40";

export function InflationOfficialPublication({
  publication,
  onSave,
  className,
  urlInputId,
}: {
  publication: WeeklyInflationOfficialPublication | null;
  onSave: (next: WeeklyInflationOfficialPublication) => void;
  className?: string;
  urlInputId?: string;
}) {
  const [form, setForm] = React.useState(() =>
    publication ?? {
      ...createDefaultOfficialPublicationForm(),
      savedAt: "",
    },
  );
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (publication) setForm(publication);
  }, [publication]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const url = form.url.trim();
    if (!url) {
      setError("Укажите URL публикации.");
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("URL должен начинаться с http:// или https://");
        return;
      }
    } catch {
      setError("Некорректный URL.");
      return;
    }

    if (form.publishedAt.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.publishedAt.trim())) {
      setError("Дата публикации — формат YYYY-MM-DD.");
      return;
    }

    const next: WeeklyInflationOfficialPublication = {
      url,
      sourceName: form.sourceName.trim() || "Росстат / ЕМИСС",
      publishedAt: form.publishedAt.trim(),
      verifiedManually: form.verifiedManually,
      savedAt: new Date().toISOString(),
    };

    onSave(next);
    setSuccess("Ссылка сохранена.");
    window.setTimeout(() => setSuccess(null), 3500);
  };

  return (
    <form onSubmit={handleSave} className={cn("space-y-3 rounded-xl border border-lab-cyan/20 bg-lab-cyan/5 px-3 py-3", className)}>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-lab-cyan" />
        <p className="text-sm font-medium text-lab-text">Официальная публикация</p>
      </div>
      <p className="text-[11px] text-lab-muted">
        Ссылка для быстрой сверки перед брифингом — цифры на дашборде остаются из CSV.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="URL публикации">
          <input
            id={urlInputId}
            type="url"
            value={form.url}
            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://rosstat.gov.ru/..."
            className={inputClass}
          />
        </Field>
        <Field label="Название источника">
          <input
            type="text"
            value={form.sourceName}
            onChange={(e) => setForm((prev) => ({ ...prev, sourceName: e.target.value }))}
            placeholder="Росстат — недельная инфляция"
            className={inputClass}
          />
        </Field>
        <Field label="Дата публикации">
          <input
            type="date"
            value={form.publishedAt}
            onChange={(e) => setForm((prev) => ({ ...prev, publishedAt: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Проверка">
          <label className="mt-2 flex items-center gap-2 text-sm text-lab-text">
            <input
              type="checkbox"
              checked={form.verifiedManually}
              onChange={(e) => setForm((prev) => ({ ...prev, verifiedManually: e.target.checked }))}
              className="rounded border-lab-border"
            />
            Проверено вручную
          </label>
        </Field>
      </div>

      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      {success ? <p className="text-sm text-lab-cyan">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-lab-cyan/30 bg-lab-cyan/10 px-3 py-1.5 text-sm text-lab-text hover:bg-lab-cyan/15"
        >
          <Save className="h-4 w-4" />
          Сохранить ссылку
        </button>
        {publication?.url ? (
          <a
            href={publication.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-lab-cyan hover:underline"
          >
            Открыть сохранённую публикацию
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</span>
      {children}
    </label>
  );
}
