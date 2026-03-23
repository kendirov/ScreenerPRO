import { db } from "@/lib/server/db";

export async function startIngestRun(runType: string) {
  return db.ingestRun.create({
    data: {
      provider: "moex",
      runType,
      status: "running",
    },
  });
}

export async function finishIngestRun(id: string, details?: unknown) {
  return db.ingestRun.update({
    where: { id },
    data: {
      status: "ok",
      finishedAt: new Date(),
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function failIngestRun(id: string, error: unknown) {
  return db.ingestRun.update({
    where: { id },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorText: error instanceof Error ? error.message : String(error),
    },
  });
}
