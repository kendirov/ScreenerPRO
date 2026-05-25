import { parseWeeklyInflationCsv, type WeeklyInflationSource } from "@/lib/domain/weekly-inflation";
import {
  buildWeeklyInflationSourceStatusResponse,
  resolveEnvIndicatorId,
  resolveEnvIndicatorUrl,
  type WeeklyInflationFetchDiagnostics,
  type WeeklyInflationFetchResponse,
  type WeeklyInflationFetchStatus,
  type WeeklyInflationSourceStatusResponse,
} from "@/lib/domain/weekly-inflation-sources";

const STATUS_CACHE_MS = 5 * 60_000;
const FETCH_CACHE_MS = 2 * 60_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "ScreenerPRO-Lab/1.0 (weekly-inflation)";

let cachedStatus: { at: number; body: WeeklyInflationSourceStatusResponse } | null = null;
const fetchCache = new Map<string, { at: number; body: WeeklyInflationFetchResponse }>();

function cacheKey(source: string, url: string, indicatorId: string): string {
  return `${source}:${url}:${indicatorId}`;
}

function isSafePublicUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function fetchRemoteText(url: URL): Promise<{ text: string; contentType: string | undefined }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/csv,text/plain,text/html,application/json,*/*",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? undefined;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      throw new Error("Файл слишком большой для безопасной загрузки.");
    }

    return { text: new TextDecoder("utf-8").decode(buffer), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function inferContentKind(url: URL, contentType?: string, text?: string): "csv" | "html" | "xlsx" | "unknown" {
  const path = url.pathname.toLowerCase();
  const type = contentType?.toLowerCase() ?? "";
  if (path.endsWith(".csv") || type.includes("text/csv") || type.includes("text/plain")) return "csv";
  if (path.endsWith(".xlsx") || path.endsWith(".xls") || type.includes("spreadsheet") || type.includes("excel")) {
    return "xlsx";
  }
  if (type.includes("html") || text?.trimStart().startsWith("<")) return "html";
  if (text?.includes("periodStart") || text?.includes("headlinePct") || text?.includes("weekEndDate")) return "csv";
  return "unknown";
}

function buildFetchResponse(
  source: "rosstat" | "fedstat",
  status: WeeklyInflationFetchStatus,
  diagnostics: WeeklyInflationFetchDiagnostics,
  points: WeeklyInflationFetchResponse["points"] = [],
): WeeklyInflationFetchResponse {
  return {
    source,
    status,
    updatedAt: new Date().toISOString(),
    points,
    diagnostics,
  };
}

export function getWeeklyInflationSourceStatus(): WeeklyInflationSourceStatusResponse {
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.at < STATUS_CACHE_MS) {
    return cachedStatus.body;
  }

  const warnings: string[] = [
    "Росстат и Fedstat/ЕМИСС — экспериментальные адаптеры; при сомнении загружайте CSV вручную.",
    "Smart-Lab — только календарь событий, не источник недельной цифры.",
    "Перед публикацией сверяйте все значения с официальным источником.",
  ];

  if (!resolveEnvIndicatorUrl("rosstat")) {
    warnings.push("Росстат: URL не задан в env — используйте поле URL или ручной CSV.");
  }
  if (!resolveEnvIndicatorUrl("fedstat")) {
    warnings.push("Fedstat/ЕМИСС: URL не задан в env — используйте поле URL или ручной CSV.");
  }

  const body = buildWeeklyInflationSourceStatusResponse(warnings);
  cachedStatus = { at: now, body };
  return body;
}

export async function fetchWeeklyInflationExperimental(
  source: "rosstat" | "fedstat",
  options: { url?: string | null; indicatorId?: string | null },
): Promise<WeeklyInflationFetchResponse> {
  const resolvedUrl = options.url?.trim() || resolveEnvIndicatorUrl(source);
  const indicatorId = options.indicatorId?.trim() || resolveEnvIndicatorId(source) || undefined;
  const key = cacheKey(source, resolvedUrl ?? "", indicatorId ?? "");
  const now = Date.now();
  const hit = fetchCache.get(key);
  if (hit && now - hit.at < FETCH_CACHE_MS) {
    return hit.body;
  }

  if (!resolvedUrl) {
    const body = buildFetchResponse(source, "not-configured", {
      parsedPoints: 0,
      warnings: [
        "URL не передан и не задан в env.",
        "Загрузите недельный ряд через CSV или укажите ссылку на официальную публикацию.",
      ],
    });
    fetchCache.set(key, { at: now, body });
    return body;
  }

  const safeUrl = isSafePublicUrl(resolvedUrl);
  if (!safeUrl) {
    const body = buildFetchResponse(source, "error", {
      url: resolvedUrl,
      parsedPoints: 0,
      warnings: ["Недопустимый или небезопасный URL."],
    });
    fetchCache.set(key, { at: now, body });
    return body;
  }

  const diagnostics: WeeklyInflationFetchDiagnostics = {
    url: safeUrl.toString(),
    parsedPoints: 0,
    warnings: [],
  };

  if (indicatorId) {
    diagnostics.warnings.push(`indicatorId=${indicatorId} — автопривязка к ряду пока не реализована.`);
  }

  try {
    const { text, contentType } = await fetchRemoteText(safeUrl);
    diagnostics.contentType = contentType;
    const kind = inferContentKind(safeUrl, contentType, text);

    if (kind === "xlsx") {
      diagnostics.warnings.push("XLSX обнаружен — автоматический парсинг не поддерживается.");
      diagnostics.warnings.push("Сохраните таблицу как CSV и загрузите вручную.");
      const body = buildFetchResponse(source, "unsupported", diagnostics);
      fetchCache.set(key, { at: now, body });
      return body;
    }

    if (kind === "html") {
      diagnostics.warnings.push("HTML-страница — структура не распознана автоматически.");
      diagnostics.warnings.push("Откройте публикацию и перенесите цифры в CSV вручную.");
      const body = buildFetchResponse(source, "unsupported", diagnostics);
      fetchCache.set(key, { at: now, body });
      return body;
    }

    if (kind === "csv" || kind === "unknown") {
      const parsed = parseWeeklyInflationCsv(text, { source: source as WeeklyInflationSource });
      if (parsed.ok && parsed.points.length > 0) {
        diagnostics.parsedPoints = parsed.points.length;
        const body = buildFetchResponse(source, "ok", diagnostics, parsed.points);
        fetchCache.set(key, { at: now, body });
        return body;
      }

      diagnostics.warnings.push(parsed.ok ? "CSV пуст." : parsed.error);
      diagnostics.warnings.push("Формат не распознан — нужен ручной импорт.");
      const body = buildFetchResponse(source, "unsupported", diagnostics);
      fetchCache.set(key, { at: now, body });
      return body;
    }

    const body = buildFetchResponse(source, "unsupported", diagnostics);
    fetchCache.set(key, { at: now, body });
    return body;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.warnings.push(`Ошибка загрузки: ${message}`);
    const body = buildFetchResponse(source, "error", diagnostics);
    fetchCache.set(key, { at: now, body });
    return body;
  }
}
