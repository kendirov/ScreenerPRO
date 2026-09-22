"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { useAcademyProgress } from "@/lib/academy/progress";

export function LessonCompletion({
  lessonId,
  practiceHref,
  practiceLabel,
}: {
  lessonId: string;
  practiceHref?: string;
  practiceLabel?: string;
}) {
  const { completed, setLessonCompleted } = useAcademyProgress();
  const isCompleted = completed.includes(lessonId);

  return (
    <section className="mx-auto mt-10 w-full max-w-[1220px] rounded-2xl border border-lab-border bg-lab-surface/80 p-5 backdrop-blur-xl md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-lab-dim">
            Завершение урока
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-lab-text">
            Теория закончена. Закрепите её действием.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-lab-muted">
            Прогресс сохраняется в этом браузере, а практика открывает тот же
            инструмент TQS, с которым ученик работает вне урока.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLessonCompleted(lessonId, !isCompleted)}
          className={
            isCompleted
              ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-300"
              : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-lab-border-hot bg-cyan-400/10 px-4 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
          }
        >
          <CheckCircle2 className="h-4 w-4" />
          {isCompleted ? "Урок пройден" : "Отметить как пройденный"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-lab-border pt-4">
        <Link
          href="/academy"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-lab-border bg-lab-surface-1/70 px-3 text-xs font-medium text-lab-muted transition hover:text-lab-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          В Академию
        </Link>
        {practiceHref && practiceLabel ? (
          <Link
            href={practiceHref}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-lab-border-hot bg-cyan-400/10 px-3 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/15"
          >
            {practiceLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
