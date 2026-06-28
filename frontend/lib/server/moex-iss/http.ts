import { getMoexHttpRetries, getMoexHttpTimeoutMs } from "@/lib/server/moex-timeout";

const BASE_URL = process.env.MOEX_BASE_URL?.trim() || "https://iss.moex.com/iss";
const TIMEOUT_MS = getMoexHttpTimeoutMs();
const RETRIES = getMoexHttpRetries();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchIssJson(path: string): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`MOEX HTTP ${response.status}`);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("MOEX request failed");
}
