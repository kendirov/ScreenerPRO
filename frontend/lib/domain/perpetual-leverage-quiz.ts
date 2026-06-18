export type PerpetualQuizOption = {
  id: string;
  label: string;
};

export type PerpetualQuizQuestion = {
  id: string;
  prompt: string;
  options: PerpetualQuizOption[];
  correctOptionId: string;
  explanation: string;
};

export const PERPETUAL_LEVERAGE_QUIZ: PerpetualQuizQuestion[] = [
  {
    id: "leverage-role",
    prompt: "Что делает плечо?",
    options: [
      { id: "a", label: "Уменьшает риск" },
      { id: "b", label: "Увеличивает размер позиции относительно маржи" },
      { id: "c", label: "Убирает комиссии" },
    ],
    correctOptionId: "b",
    explanation:
      "Плечо умножает номинал позиции при той же марже. Риск и чувствительность к движению цены растут.",
  },
  {
    id: "liquidation",
    prompt: "Что такое ликвидация?",
    options: [
      { id: "a", label: "Запланированный выход по стопу" },
      { id: "b", label: "Принудительное закрытие позиции из-за нехватки маржи" },
      { id: "c", label: "Фиксация прибыли" },
    ],
    correctOptionId: "b",
    explanation:
      "Ликвидация — техническое закрытие биржей, когда залога на позицию больше не хватает. Это не ваш план выхода.",
  },
  {
    id: "stop-vs-liq",
    prompt: "Почему stop-loss не равен liquidation?",
    options: [
      { id: "a", label: "Stop-loss ставит трейдер, ликвидацию делает биржа" },
      { id: "b", label: "Это одно и то же" },
      { id: "c", label: "Stop-loss работает только на споте" },
    ],
    correctOptionId: "a",
    explanation:
      "Стоп — добровольный риск-менеджмент. Ликвидация наступает, когда маржи недостаточно, без вашего согласия.",
  },
  {
    id: "leverage-liq-distance",
    prompt: "Что происходит при росте плеча?",
    options: [
      { id: "a", label: "Ликвидация становится дальше" },
      { id: "b", label: "Ликвидация становится ближе" },
      { id: "c", label: "Funding исчезает" },
    ],
    correctOptionId: "b",
    explanation:
      "Выше плечо — меньше запас до принудительного закрытия. Небольшое движение против позиции быстрее съедает маржу.",
  },
  {
    id: "perpetual-funding",
    prompt: "Что добавляет perpetual-фьючерс?",
    options: [
      { id: "a", label: "Funding" },
      { id: "b", label: "Дивиденды" },
      { id: "c", label: "Обязательную дату экспирации" },
    ],
    correctOptionId: "a",
    explanation:
      "Perpetual не имеет даты экспирации как срочный фьючерс, но есть периодический funding между long и short.",
  },
];

export function isQuizAnswerCorrect(question: PerpetualQuizQuestion, optionId: string): boolean {
  return question.correctOptionId === optionId;
}
