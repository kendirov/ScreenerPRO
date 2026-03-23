import { z } from "zod";

export const tickerSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/);

export const academySlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
