import { z } from "zod";

const tableSchema = z.object({
  columns: z.array(z.string()),
  data: z.array(z.array(z.unknown())),
});

export const moexPayloadSchema = z.object({
  securities: tableSchema.optional(),
  marketdata: tableSchema.optional(),
  candles: tableSchema.optional(),
  history: tableSchema.optional(),
  "history.cursor": z
    .object({
      columns: z.array(z.string()),
      data: z.array(z.array(z.unknown())),
    })
    .optional(),
});

export type MoexPayload = z.infer<typeof moexPayloadSchema>;
