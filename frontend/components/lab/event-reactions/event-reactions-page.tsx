"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { LabEmptyState, LabSectionHeading } from "@/components/lab/lab-ui";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  DIRECTION_LABELS,
  EVENT_TYPE_LABELS,
  IMPORTANCE_LABELS,
  type EventReactionDto,
  type EventReactionFindingDto,
  type MarketEventDto,
  type NewsSourceDto,
  type RawNewsItemDto,
} from "@/lib/event-reactions/reaction-types";
import { PLANNED_TICK_WINDOWS, UI_POST_WINDOWS } from "@/lib/event-reactions/reaction-windows";
import { cn } from "@/lib/utils/cn";

const DATA_STATUS_LABELS: Record<string, string> = {
  ok: "данные есть",
  partial: "частично",
  no_data: "нет данных",
  planned_tick_data: "нужны тики",
};

const FINDING_TEMPLATES = [
  { title: "Сильная реакция", body: "Появится после подключения минутных свечей и расчёта priceChangePct." },
  { title: "Нет реакции", body: "Сравнение движения с фоном — этап 2." },
  { title: "Реакция с задержкой", body: "Окна +15м / +30м / +40м — после intraday ingest." },
  { title: "Объём без движения", body: "turnoverVsNormal — после baseline по обороту." },
  { title: "Движение до новости", body: "Окна pre_5m / pre_15m — leak detection, этап 2." },
  { title: "Новость уже была в цене", body: "Сравнение pre vs post — после market data." },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok && data.error) throw new Error(data.error);
  return data;
}

export function EventReactionsPage() {
  const [sources, setSources] = React.useState<NewsSourceDto[]>([]);
  const [news, setNews] = React.useState<RawNewsItemDto[]>([]);
  const [events, setEvents] = React.useState<MarketEventDto[]>([]);
  const [findings, setFindings] = React.useState<EventReactionFindingDto[]>([]);
  const [reactions, setReactions] = React.useState<EventReactionDto[]>([]);
  const [activeEvent, setActiveEvent] = React.useState<MarketEventDto | null>(null);
  const [lastNewsId, setLastNewsId] = React.useState<string | null>(null);

  const [sourceId, setSourceId] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [publishedAt, setPublishedAt] = React.useState("");
  const [newsText, setNewsText] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = React.useState(false);

  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourcesRes, newsRes, eventsRes, findingsRes] = await Promise.all([
        fetchJson<{ sources: NewsSourceDto[] }>("/api/lab/event-reactions/sources"),
        fetchJson<{ news: RawNewsItemDto[] }>("/api/lab/event-reactions/news"),
        fetchJson<{ events: MarketEventDto[] }>("/api/lab/event-reactions/events"),
        fetchJson<{ findings: EventReactionFindingDto[] }>("/api/lab/event-reactions/findings"),
      ]);
      setSources(sourcesRes.sources);
      setNews(newsRes.news);
      setEvents(eventsRes.events);
      setFindings(findingsRes.findings);
      if (!sourceId && sourcesRes.sources[0]) {
        setSourceId(sourcesRes.sources[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  React.useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleSave = async () => {
    if (!newsText.trim()) {
      setError("Введите текст новости");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchJson<{ news: RawNewsItemDto }>("/api/lab/event-reactions/manual-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: sourceId || null,
          sourceUrl: sourceUrl || null,
          text: newsText,
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        }),
      });
      setLastNewsId(res.news.id);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleParse = async (rawNewsItemId?: string) => {
    const id = rawNewsItemId ?? lastNewsId;
    if (!id) {
      setError("Сначала сохраните новость");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const res = await fetchJson<{ event: MarketEventDto; note: string }>(
        "/api/lab/event-reactions/parse-news",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawNewsItemId: id }),
        },
      );
      setActiveEvent(res.event);
      setLastNewsId(id);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  };

  const handleAnalyze = async (eventId?: string) => {
    const id = eventId ?? activeEvent?.id;
    if (!id) {
      setError("Сначала разберите новость в событие");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetchJson<{
        reactions: EventReactionDto[];
        findings: EventReactionFindingDto[];
      }>("/api/lab/event-reactions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      setReactions(res.reactions);
      setFindings((prev) => {
        const ids = new Set(prev.map((f) => f.id));
        const merged = [...res.findings.filter((f) => !ids.has(f.id)), ...prev];
        return merged.slice(0, 30);
      });
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const selectEvent = (event: MarketEventDto) => {
    setActiveEvent(event);
    setReactions([]);
  };

  const primaryTicker = activeEvent?.instrumentLinks[0]?.ticker ?? null;
  const tickerReactions = primaryTicker
    ? reactions.filter((r) => r.ticker === primaryTicker)
    : reactions;

  const pills = [
    { label: "LOCAL", tone: "source" as const },
    { label: "DRAFT", tone: "meta" as const },
    { label: "EVENT STUDY", tone: "accent" as const },
    { label: "SQLite", tone: "time" as const },
  ];

  return (
    <LabPageShell
      title="Реакция на новости"
      description="Локальная база событий: новость → тикер → реакция рынка"
      pills={pills}
    >
      {error ? (
        <LabGlassPanel variant="danger" depth={10} className="px-4 py-3 text-sm text-lab-red">
          {error}
        </LabGlassPanel>
      ) : null}

      {/* 1. Добавить новость */}
      <section>
        <LabSectionHeading>Добавить новость</LabSectionHeading>
        <LabGlassPanel depth={20} className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="lab-type-caption text-[11px] uppercase tracking-wider text-lab-text-dim">Источник</span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-lg border border-lab-border/60 bg-lab-bg-deep/80 px-3 py-2 text-sm text-lab-text outline-none focus:border-lab-violet/50"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="lab-type-caption text-[11px] uppercase tracking-wider text-lab-text-dim">Ссылка</span>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-lab-border/60 bg-lab-bg-deep/80 px-3 py-2 text-sm text-lab-text outline-none focus:border-lab-violet/50"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="lab-type-caption text-[11px] uppercase tracking-wider text-lab-text-dim">
                Время публикации
              </span>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-lab-border/60 bg-lab-bg-deep/80 px-3 py-2 text-sm text-lab-text outline-none focus:border-lab-violet/50"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="lab-type-caption text-[11px] uppercase tracking-wider text-lab-text-dim">Текст новости</span>
            <textarea
              value={newsText}
              onChange={(e) => setNewsText(e.target.value)}
              rows={5}
              placeholder="Пример: SBER объявил дивиденды 33 ₽ на акцию. Решение неожиданное для рынка…"
              className="w-full resize-y rounded-lg border border-lab-border/60 bg-lab-bg-deep/80 px-3 py-2 text-sm leading-relaxed text-lab-text outline-none focus:border-lab-violet/50"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg border border-lab-violet/40 bg-lab-violet/15 px-4 py-2 text-sm font-medium text-lab-text transition hover:bg-lab-violet/25 disabled:opacity-50"
            >
              {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}
              {saving ? " Сохранение…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => void handleParse()}
              disabled={parsing}
              className="rounded-lg border border-lab-amber/40 bg-lab-amber/10 px-4 py-2 text-sm font-medium text-lab-text transition hover:bg-lab-amber/20 disabled:opacity-50"
            >
              {parsing ? "Разбор…" : "Разобрать"}
            </button>
            {activeEvent ? (
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={analyzing}
                className="rounded-lg border border-lab-border/60 px-4 py-2 text-sm text-lab-text-muted transition hover:border-lab-violet/40 disabled:opacity-50"
              >
                {analyzing ? "Анализ…" : "Заготовка реакции"}
              </button>
            ) : null}
          </div>
        </LabGlassPanel>
      </section>

      {/* 2. Разбор события */}
      <section>
        <LabSectionHeading>Разбор события</LabSectionHeading>
        <LabGlassPanel depth={20} className="p-4">
          {activeEvent ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="lab-status-chip lab-chip-lab">{EVENT_TYPE_LABELS[activeEvent.eventType]}</span>
                <span className="lab-status-chip lab-chip-dev">{IMPORTANCE_LABELS[activeEvent.importance]}</span>
                <span className="lab-status-chip text-lab-muted">
                  {activeEvent.isScheduled ? "Запланированная" : "Внезапная"}
                </span>
                {activeEvent.confidence != null ? (
                  <span className="lab-status-chip text-lab-muted">
                    confidence {(activeEvent.confidence * 100).toFixed(0)}%
                  </span>
                ) : null}
              </div>
              <h3 className="text-base font-medium text-lab-text">{activeEvent.title}</h3>
              {activeEvent.instrumentLinks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeEvent.instrumentLinks.map((link) => (
                    <span
                      key={link.id}
                      className="rounded-md border border-lab-border/50 bg-lab-bg-deep/60 px-2 py-1 font-mono text-xs text-lab-text"
                    >
                      {link.ticker}
                      <span className="ml-1.5 text-lab-text-dim">{DIRECTION_LABELS[link.expectedDirection]}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <LabEmptyState message="Добавьте новость и укажите тикеры явно в тексте (SBER, GAZP, SI…)." />
              )}
              {activeEvent.parsedJson ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setJsonOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs text-lab-text-dim hover:text-lab-text"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition", jsonOpen && "rotate-180")} />
                    parsed JSON (stub)
                  </button>
                  {jsonOpen ? (
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-lab-bg-deep/80 p-3 font-mono text-[10px] text-lab-text-muted">
                      {JSON.stringify(activeEvent.parsedJson, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <LabEmptyState message="Сохраните новость и нажмите «Разобрать» — rule-based parser без OpenAI." />
          )}
        </LabGlassPanel>
      </section>

      {/* 3. Окна реакции */}
      <section>
        <LabSectionHeading>Окна реакции</LabSectionHeading>
        <LabGlassPanel depth={20} className="p-4">
          {tickerReactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-lab-border/40 text-[11px] uppercase tracking-wider text-lab-text-dim">
                    <th className="py-2 pr-3">Окно</th>
                    <th className="py-2 pr-3">Δ %</th>
                    <th className="py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {UI_POST_WINDOWS.map((win) => {
                    const row = tickerReactions.find((r) => r.window === win.key);
                    return (
                      <tr key={win.key} className="border-b border-lab-border/20">
                        <td className="py-2 pr-3 font-mono text-xs">{win.labelShort}</td>
                        <td className="lab-number py-2 pr-3 text-lab-text-muted">
                          {row?.priceChangePct != null ? `${row.priceChangePct.toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2 text-xs text-lab-text-dim">
                          {DATA_STATUS_LABELS[row?.dataStatus ?? "no_data"]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <LabEmptyState message="Пока нет рыночных данных для расчёта реакции. Нажмите «Заготовка реакции» после разбора." />
          )}
        </LabGlassPanel>

        <LabGlassPanel depth={10} variant="amber" className="mt-2 p-4">
          <p className="text-sm font-medium text-lab-amber">Секундные окна — planned</p>
          <p className="mt-1 text-sm text-lab-text-muted">
            Секундные реакции будут доступны после подключения tick-data / QUIK / брокерского потока.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLANNED_TICK_WINDOWS.map((w) => (
              <span key={w.key} className="lab-status-chip lab-chip-dev font-mono text-[10px]">
                {w.labelShort} · planned_tick_data
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-lab-text-dim">Для секундных окон нужен источник тиков.</p>
        </LabGlassPanel>
      </section>

      {/* 4. Последние события */}
      <section>
        <LabSectionHeading>Последние события</LabSectionHeading>
        <div className="grid gap-2 lg:grid-cols-2">
          <LabGlassPanel depth={10} className="p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-lab-text-dim">Новости</p>
            {loading ? (
              <p className="text-sm text-lab-text-muted">Загрузка…</p>
            ) : news.length === 0 ? (
              <LabEmptyState message="Нет сохранённых новостей." />
            ) : (
              <ul className="space-y-2">
                {news.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setLastNewsId(item.id);
                        void handleParse(item.id);
                      }}
                      className="w-full rounded-lg border border-lab-border/30 px-3 py-2 text-left text-sm transition hover:border-lab-violet/40 hover:bg-lab-bg-deep/40"
                    >
                      <span className="line-clamp-2 text-lab-text">{item.title ?? item.text.slice(0, 80)}</span>
                      <span className="mt-1 block text-[10px] text-lab-text-dim">
                        {formatDateTime(item.publishedAt ?? item.ingestedAt)} · {item.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </LabGlassPanel>
          <LabGlassPanel depth={10} className="p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-lab-text-dim">События</p>
            {events.length === 0 ? (
              <LabEmptyState message="Нет разобранных событий." />
            ) : (
              <ul className="space-y-2">
                {events.slice(0, 6).map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => selectEvent(ev)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                        activeEvent?.id === ev.id
                          ? "border-lab-violet/50 bg-lab-violet/10"
                          : "border-lab-border/30 hover:border-lab-violet/40",
                      )}
                    >
                      <span className="text-lab-text">{ev.title}</span>
                      <span className="mt-1 block text-[10px] text-lab-text-dim">
                        {EVENT_TYPE_LABELS[ev.eventType]} · {formatDateTime(ev.eventTime)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </LabGlassPanel>
        </div>
      </section>

      {/* 5. Находки */}
      <section>
        <LabSectionHeading>Находки</LabSectionHeading>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {findings.length > 0
            ? findings.slice(0, 6).map((f) => (
                <LabGlassPanel key={f.id} depth={10} className="p-3">
                  <p className="text-sm font-medium text-lab-text">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-lab-text-muted">{f.body}</p>
                </LabGlassPanel>
              ))
            : FINDING_TEMPLATES.map((t) => (
                <LabGlassPanel key={t.title} depth={10} className="p-3 opacity-70">
                  <p className="text-sm font-medium text-lab-text">{t.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-lab-text-muted">{t.body}</p>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-lab-violet/60">ожидает данных</p>
                </LabGlassPanel>
              ))}
        </div>
      </section>
    </LabPageShell>
  );
}
