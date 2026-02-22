/**
 * Zod schemas for internal income endpoints.
 * Dates: YYYY-MM-DD. Pagination: page >= 1, pageSize 1..200.
 */

import { z } from "zod";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export const dateParamSchema = z
  .string()
  .regex(dateOnly, "from/to must be YYYY-MM-DD");

export const ordersListQuerySchema = z.object({
  from: dateParamSchema,
  to: dateParamSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  includeExcluded: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  sort: z
    .enum([
      "processedAt_desc",
      "processedAt_asc",
      "incomeNeto_desc",
      "refunds_desc",
    ])
    .default("processedAt_desc"),
});

export const orderDetailQuerySchema = z.object({
  raw: z.enum(["summary", "full"]).default("summary"),
});

export const reconcileQuerySchema = z.object({
  from: dateParamSchema,
  to: dateParamSchema,
  includeExcluded: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
});

export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;
export type OrderDetailQuery = z.infer<typeof orderDetailQuerySchema>;
export type ReconcileQuery = z.infer<typeof reconcileQuerySchema>;
