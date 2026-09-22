"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "tqs.academy.completed.v1";
const CHANGE_EVENT = "tqs-academy-progress";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getServerSnapshot() {
  return "[]";
}

function parseCompleted(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function useAcademyProgress() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const completed = parseCompleted(raw);

  const setLessonCompleted = (lessonId: string, value = true) => {
    if (typeof window === "undefined") return;
    const current = parseCompleted(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    const next = value
      ? Array.from(new Set([...current, lessonId]))
      : current.filter((item) => item !== lessonId);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return { completed, setLessonCompleted };
}
