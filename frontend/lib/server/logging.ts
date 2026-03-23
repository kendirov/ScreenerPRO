export function logInfo(message: string, data?: unknown) {
  console.info(`[screener] ${message}`, data ?? "");
}

export function logError(message: string, error: unknown) {
  console.error(`[screener] ${message}`, error);
}
