import { z } from "zod";

const tableSchema = z.object({
  columns: z.array(z.string()),
  data: z.array(z.array(z.unknown())),
});

export const moexIssPayloadSchema = z.object({
  securities: tableSchema,
  marketdata: tableSchema,
});

export type MoexIssPayload = z.infer<typeof moexIssPayloadSchema>;
