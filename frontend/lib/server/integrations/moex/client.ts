const baseUrl = process.env.MOEX_BASE_URL ?? "https://iss.moex.com/iss";
const timeoutMs = Number(process.env.MOEX_HTTP_TIMEOUT_MS ?? 25000);

const shortCache = new Map<string, { expiresAt: number; payload: unknown }>();

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function moexGetJson<T>(path: string, cacheSeconds = 0): Promise<T> {
  const url = `${baseUrl}${path}`;
  const now = Date.now();
  const hit = shortCache.get(url);
  if (hit && hit.expiresAt > now) return hit.payload as T;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) throw new Error(`MOEX HTTP ${response.status}`);
      const payload = (await response.json()) as T;
      if (cacheSeconds > 0) shortCache.set(url, { expiresAt: now + cacheSeconds * 1000, payload });
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
}
