"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CirclePlay,
  Crosshair,
  GraduationCap,
  Play,
  Sparkles,
} from "lucide-react";
import {
  academyModules,
  academyPracticeSurfaces,
  academyPrinciples,
  liveAcademyLessons,
} from "@/lib/academy/catalog";
import { useAcademyProgress } from "@/lib/academy/progress";

const statusLabel = {
  live: "ДОСТУПЕН",
  next: "СЛЕДУЮЩИЙ",
  planned: "ПЛАН",
} as const;

export function AcademyDashboard() {
  const { completed } = useAcademyProgress();
  const completedLive = liveAcademyLessons.filter((lesson) =>
    completed.includes(lesson.id),
  ).length;
  const progress =
    liveAcademyLessons.length === 0
      ? 0
      : Math.round((completedLive / liveAcademyLessons.length) * 100);
  const nextLesson =
    liveAcademyLessons.find((lesson) => !completed.includes(lesson.id)) ??
    liveAcademyLessons[0];

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 pb-10 pt-1">
      <section className="relative overflow-hidden rounded-2xl border border-lab-border bg-[linear-gradient(135deg,rgba(8,13,28,0.96),rgba(4,9,18,0.92))] p-5 md:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-amber-300/5 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-lab-dim">
              <span className="rounded-full border border-lab-border bg-white/[0.025] px-2.5 py-1">
                TQS Academy
              </span>
              <span>Учимся на тех же инструментах, на которых торгуем</span>
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-lab-text md:text-5xl lg:text-[58px] lg:leading-[0.98]">
              Не смотреть уроки.
              <span className="mt-1 block text-lab-muted">
                Учиться видеть рынок.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-lab-muted md:text-base">
              Короткая механика → интерактивная сцена → реальный инструмент TQS
              → самостоятельная практика. Курс и рабочее место трейдера больше
              не живут отдельно.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href={nextLesson ? `/academy/${nextLesson.slug}` : "/academy"}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
              >
                <Play className="h-4 w-4 fill-current" />
                {completedLive > 0 ? "Продолжить обучение" : "Начать обучение"}
              </Link>
              <Link
                href="/screener"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-lab-border bg-white/[0.025] px-4 text-sm font-medium text-lab-muted transition hover:border-white/15 hover:text-lab-text"
              >
                <Crosshair className="h-4 w-4" />
                Перейти к рынку
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-lab-border bg-black/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-lab-dim">
                  Ваш маршрут
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-lab-text">
                  {progress}%
                </p>
              </div>
              <BookOpenCheck className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-lab-border pt-4">
              <Metric value={String(academyModules.length)} label="модуля" />
              <Metric value={String(liveAcademyLessons.length)} label="урока live" />
              <Metric value={String(completedLive)} label="пройдено" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {academyPrinciples.map((item, index) => (
          <article
            key={item.title}
            className="rounded-xl border border-lab-border bg-lab-surface/65 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-lab-dim">
                0{index + 1}
              </span>
              <Sparkles className="h-3.5 w-3.5 text-amber-300/70" />
            </div>
            <h2 className="mt-5 text-base font-semibold text-lab-text">
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-lab-muted">{item.text}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-lab-dim">
              Learning path
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-lab-text">
              От поиска инструмента до торгового сценария
            </h2>
          </div>
          <p className="hidden max-w-md text-right text-xs leading-5 text-lab-dim md:block">
            Каждый модуль заканчивается переходом в рабочий инструмент TQS.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-lab-border bg-lab-surface/45">
          {academyModules.map((module, moduleIndex) => (
            <div
              key={module.id}
              className={
                moduleIndex > 0
                  ? "grid border-t border-lab-border lg:grid-cols-[220px_1fr]"
                  : "grid lg:grid-cols-[220px_1fr]"
              }
            >
              <div className="border-b border-lab-border p-4 lg:border-b-0 lg:border-r lg:p-5">
                <div className="font-mono text-xs text-cyan-300">{module.index}</div>
                <h3 className="mt-6 text-lg font-semibold text-lab-text">
                  {module.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-lab-dim">
                  {module.description}
                </p>
                <p className="mt-4 border-l border-amber-300/30 pl-3 text-xs leading-5 text-lab-muted">
                  {module.outcome}
                </p>
              </div>

              <div className="divide-y divide-lab-border">
                {module.lessons.map((lesson) => {
                  const isCompleted = completed.includes(lesson.id);
                  const isLive = lesson.status === "live";
                  return (
                    <div
                      key={lesson.id}
                      className="group grid gap-4 p-4 transition hover:bg-white/[0.018] md:grid-cols-[1fr_auto] md:items-center lg:p-5"
                    >
                      <div className="flex min-w-0 gap-4">
                        <div
                          className={
                            isCompleted
                              ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                              : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-lab-border bg-black/20 text-lab-dim"
                          }
                        >
                          {isCompleted ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <CirclePlay className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                isLive
                                  ? "text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300"
                                  : "text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300/75"
                              }
                            >
                              {statusLabel[lesson.status]}
                            </span>
                            <span className="text-[10px] text-lab-dim">
                              {lesson.level} · {lesson.duration}
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-base font-medium text-lab-text">
                            {lesson.title}
                          </h4>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-lab-muted">
                            {lesson.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-[52px] md:pl-0">
                        {isLive ? (
                          <Link
                            href={`/academy/${lesson.slug}`}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-lab-border px-3 text-xs font-medium text-lab-text transition group-hover:border-cyan-300/30 group-hover:bg-cyan-300/[0.06]"
                          >
                            Открыть урок
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : lesson.practiceHref ? (
                          <Link
                            href={lesson.practiceHref}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-lab-border px-3 text-xs text-lab-muted transition hover:text-lab-text"
                          >
                            Практика уже доступна
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-cyan-300" />
          <h2 className="text-lg font-semibold text-lab-text">
            Практические среды
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {academyPracticeSurfaces.map((surface) => (
            <Link
              key={surface.href}
              href={surface.href}
              className="group rounded-xl border border-lab-border bg-lab-surface/55 p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.025]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] tracking-[0.14em] text-cyan-300">
                  {surface.eyebrow}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-lab-dim transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-lab-text">
                {surface.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-lab-muted">
                {surface.text}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold text-lab-text">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-lab-dim">
        {label}
      </p>
    </div>
  );
}
