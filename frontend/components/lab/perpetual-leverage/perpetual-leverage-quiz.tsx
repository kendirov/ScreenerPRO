"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import {
  PERPETUAL_LEVERAGE_QUIZ,
  isQuizAnswerCorrect,
  type PerpetualQuizQuestion,
} from "@/lib/domain/perpetual-leverage-quiz";

type Answers = Record<string, string>;

function QuizProgress({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-500">
        <span>Прогресс</span>
        <span className="lab-number tabular-nums text-slate-400">
          {answered}/{total}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-black/50">
        <div
          className="h-full rounded-full bg-cyan-500/50 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  selectedId,
  onSelect,
}: {
  question: PerpetualQuizQuestion;
  index: number;
  selectedId: string | undefined;
  onSelect: (optionId: string) => void;
}) {
  const answered = selectedId != null;
  const isCorrect = answered && isQuizAnswerCorrect(question, selectedId);

  return (
    <LabGlassPanel
      depth={10}
      className={cn(
        "perp-lab-card overflow-hidden p-4 transition-colors duration-200 sm:p-5",
        answered && isCorrect && "border-emerald-500/25",
        answered && !isCorrect && "border-rose-500/25",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        Вопрос {index + 1}
      </p>
      <h3 className="mt-1.5 text-sm font-medium leading-snug text-slate-100">{question.prompt}</h3>

      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={question.prompt}>
        {question.options.map((option) => {
          const isSelected = selectedId === option.id;
          const showResult = answered;
          const optionCorrect = option.id === question.correctOptionId;
          const showAsCorrect = showResult && optionCorrect;
          const showAsWrong = showResult && isSelected && !optionCorrect;

          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-all duration-200",
                !answered &&
                  "border-white/[0.07] bg-black/30 text-slate-300 hover:border-cyan-500/25 hover:bg-cyan-950/15",
                showAsCorrect && "border-emerald-500/35 bg-emerald-950/20 text-emerald-100/90",
                showAsWrong && "border-rose-500/35 bg-rose-950/20 text-rose-100/90",
                showResult && !showAsCorrect && !showAsWrong && "border-white/[0.04] bg-black/20 text-slate-500",
              )}
            >
              <span
                className={cn(
                  "lab-number flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold uppercase",
                  !answered && "border-slate-600 text-slate-500",
                  showAsCorrect && "border-emerald-500/40 text-emerald-300",
                  showAsWrong && "border-rose-500/40 text-rose-300",
                  showResult && !showAsCorrect && !showAsWrong && "border-slate-700 text-slate-600",
                )}
              >
                {option.id.toUpperCase()}
              </span>
              <span className="flex-1 leading-snug">{option.label}</span>
              {showAsCorrect ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" aria-hidden />
              ) : null}
              {showAsWrong ? <X className="h-3.5 w-3.5 shrink-0 text-rose-400/90" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          answered ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-live="polite"
      >
        <div className="overflow-hidden">
          {answered ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                isCorrect
                  ? "border-emerald-500/25 bg-emerald-950/15 text-emerald-100/85"
                  : "border-rose-500/25 bg-rose-950/15 text-rose-100/85",
              )}
            >
              <p className="font-medium">{isCorrect ? "Верно" : "Неверно"}</p>
              <p className="mt-1 text-slate-300/90">{question.explanation}</p>
            </div>
          ) : null}
        </div>
      </div>
    </LabGlassPanel>
  );
}

export function PerpetualLeverageQuiz() {
  const [answers, setAnswers] = React.useState<Answers>({});

  const total = PERPETUAL_LEVERAGE_QUIZ.length;
  const answeredCount = Object.keys(answers).length;
  const correctCount = PERPETUAL_LEVERAGE_QUIZ.filter((q) =>
    answers[q.id] ? isQuizAnswerCorrect(q, answers[q.id]) : false,
  ).length;
  const allDone = answeredCount === total;

  const handleSelect = React.useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => {
      if (prev[questionId]) return prev;
      return { ...prev, [questionId]: optionId };
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-400">Проверь понимание перед первой сделкой</p>
        <div className="w-full sm:max-w-[200px]">
          <QuizProgress answered={answeredCount} total={total} />
        </div>
      </div>

      <div className="space-y-3">
        {PERPETUAL_LEVERAGE_QUIZ.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            selectedId={answers[question.id]}
            onSelect={(optionId) => handleSelect(question.id, optionId)}
          />
        ))}
      </div>

      <div
        className={cn(
          "text-center text-xs transition-opacity duration-300",
          allDone ? "opacity-100" : "opacity-0",
        )}
        aria-hidden={!allDone}
      >
        {allDone ? (
          <p className="text-slate-400">
            Результат:{" "}
            <span className="lab-number font-medium text-slate-200">
              {correctCount}/{total}
            </span>
            {correctCount === total ? (
              <span className="text-emerald-400/90"> — отлично</span>
            ) : (
              <span className="text-slate-500"> — перечитай термины и калькулятор</span>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
