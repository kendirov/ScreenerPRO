import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, BookOpen, Crosshair, PlayCircle } from "lucide-react";
import { RangeTurnoverEditorial } from "@/components/academy/range-turnover-editorial";
import { LessonCompletion } from "@/components/academy/lesson-completion";
import { SceneBlock } from "@/components/academy/scene-block";
import { academyModules } from "@/lib/academy/catalog";

const lessonCopy: Record<
  string,
  {
    eyebrow: string;
    lead: string;
    scenes: Array<{ kicker: string; title: string; text: string }>;
  }
> = {
  "market-microstructure-moex": {
    eyebrow: "Модуль 02 · Микроструктура",
    lead:
      "Задача урока — научиться смотреть на стакан и поток не как на набор мигающих цифр, а как на последовательность действий участников.",
    scenes: [
      {
        kicker: "Сцена 01 · Контекст",
        title: "Цена двигается не из-за цвета в стакане",
        text:
          "Сначала отделяем факт от интерпретации: где находится спред, сколько ликвидности реально стоит рядом с ценой и как быстро она меняется.",
      },
      {
        kicker: "Сцена 02 · Поток",
        title: "Важно не только сколько заявок стоит, но и что с ними происходит",
        text:
          "Снятие, восстановление и повторное появление ликвидности дают больше контекста, чем одиночная крупная плотность.",
      },
      {
        kicker: "Сцена 03 · Практика",
        title: "Проверяем гипотезу в симуляторе",
        text:
          "Откройте привод-симулятор и найдите момент, где скорость сделок растёт одновременно с истощением одной стороны стакана.",
      },
    ],
  },
  "futures-basis-and-carry": {
    eyebrow: "Модуль 03 · Связи рынков",
    lead:
      "Базис полезен только тогда, когда вы понимаете, с чем сравниваете фьючерс и почему расхождение вообще должно закрываться или расширяться.",
    scenes: [
      {
        kicker: "Сцена 01 · Связь",
        title: "Фьючерс не существует отдельно от базового актива",
        text:
          "Начинаем с пары: фьючерс ↔ базовый актив. Смотрим направление, скорость и относительное расхождение, а не абсолютную цифру базиса.",
      },
      {
        kicker: "Сцена 02 · Режим",
        title: "Одинаковый базис в разных режимах означает разное",
        text:
          "Экспирация, стоимость денег, дивиденды и локальный дисбаланс могут менять нормальный диапазон. Сначала режим, потом вывод.",
      },
      {
        kicker: "Сцена 03 · Практика",
        title: "Сравниваем контракт с соседними инструментами",
        text:
          "Перейдите в раздел фьючерсов, выберите семейство контрактов и сопоставьте динамику текущего контракта с базовым активом.",
      },
    ],
  },
};

export default async function AcademyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = academyModules
    .flatMap((module) => module.lessons)
    .find((item) => item.slug === slug && item.status === "live");

  if (!lesson) notFound();

  if (slug === "diapazon-i-oborot") {
    return (
      <>
        <RangeTurnoverEditorial />
        <LessonCompletion
          lessonId={lesson.id}
          practiceHref={lesson.practiceHref}
          practiceLabel={lesson.practiceLabel}
        />
      </>
    );
  }

  const copy = lessonCopy[slug];
  if (!copy) notFound();

  return (
    <article className="mx-auto w-full max-w-[1220px] pb-10 pt-2">
      <header className="relative overflow-hidden rounded-2xl border border-lab-border bg-[linear-gradient(135deg,rgba(8,13,28,0.97),rgba(4,9,18,0.94))] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-lab-dim">
            <span className="text-cyan-300">{copy.eyebrow}</span>
            <span>·</span>
            <span>{lesson.level}</span>
            <span>·</span>
            <span>{lesson.duration}</span>
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-lab-text md:text-5xl">
            {lesson.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-lab-muted md:text-base">
            {copy.lead}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-lab-border bg-white/[0.025] px-3 py-1.5 text-xs text-lab-muted">
              <BadgeCheck className="h-3.5 w-3.5 text-cyan-300" />
              Практический модуль
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-lab-border bg-white/[0.025] px-3 py-1.5 text-xs text-lab-muted">
              <BookOpen className="h-3.5 w-3.5 text-amber-300/80" />
              Связан с TQS
            </span>
          </div>
        </div>
      </header>

      <div className="mt-8 space-y-2">
        {copy.scenes.map((scene) => (
          <SceneBlock
            key={scene.kicker}
            kicker={scene.kicker}
            title={scene.title}
            text={scene.text}
          />
        ))}
      </div>

      {lesson.practiceHref ? (
        <section className="mt-8 grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Практика
            </p>
            <h2 className="mt-2 text-xl font-semibold text-lab-text">
              Не закрывайте урок на теории
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-lab-muted">
              Откройте связанную рабочую среду и найдите тот же механизм руками.
              Именно этот переход из объяснения в действие считается завершением занятия.
            </p>
          </div>
          <Link
            href={lesson.practiceHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
          >
            <PlayCircle className="h-4 w-4" />
            {lesson.practiceLabel ?? "Открыть практику"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      <LessonCompletion
        lessonId={lesson.id}
        practiceHref={lesson.practiceHref}
        practiceLabel={lesson.practiceLabel}
      />

      <div className="mt-6 flex justify-center">
        <Link
          href="/academy"
          className="inline-flex items-center gap-2 text-xs text-lab-dim transition hover:text-lab-text"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Вернуться к маршруту обучения
        </Link>
      </div>
    </article>
  );
}
