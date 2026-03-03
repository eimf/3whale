/**
 * Minimal Zod schemas for Order node shape returned by ordersForIncomeV1 GraphQL query.
 * Validates structure only; mapper enforces currency consistency and decimal amounts.
 */

import { z } from "zod";

export const MoneyV2Schema = z.object({
    amount: z.string(),
    currencyCode: z.string(),
});

export const MoneySetSchema = z.object({
    shopMoney: MoneyV2Schema,
});

export const RefundNodeSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    totalRefundedSet: MoneySetSchema,
    refundLineItems: z
        .object({
            edges: z
                .array(
                    z.object({
                        node: z.object({
                            quantity: z.number().int().optional(),
                            subtotalSet: MoneySetSchema.nullable().optional(),
                            totalTaxSet: MoneySetSchema.nullable().optional(),
                            lineItem: z
                                .object({
                                    id: z.string().optional(),
                                    quantity: z.number().int().optional(),
                                    originalTotalSet:
                                        MoneySetSchema.nullable().optional(),
                                })
                                .nullable()
                                .optional(),
                        }),
                    }),
                )
                .optional()
                .default([]),
        })
        .optional(),
    refundShippingLines: z
        .object({
            edges: z
                .array(
                    z.object({
                        node: z.object({
                            subtotalAmountSet:
                                MoneySetSchema.nullable().optional(),
                            amountSet: MoneySetSchema.nullable().optional(),
                            taxAmountSet: MoneySetSchema.nullable().optional(),
                        }),
                    }),
                )
                .optional()
                .default([]),
        })
        .optional(),
    orderAdjustments: z
        .object({
            edges: z
                .array(
                    z.object({
                        node: z.object({
                            amountSet: MoneySetSchema.nullable().optional(),
                            taxAmountSet: MoneySetSchema.nullable().optional(),
                        }),
                    }),
                )
                .optional()
                .default([]),
        })
        .optional(),
    transactions: z
        .object({
            edges: z
                .array(
                    z.object({
                        node: z.object({
                            id: z.string().optional(),
                            kind: z.string().nullable().optional(),
                            status: z.string().nullable().optional(),
                            amountSet: MoneySetSchema.nullable().optional(),
                        }),
                    }),
                )
                .optional()
                .default([]),
        })
        .optional(),
    duties: z
        .array(
            z.object({
                amountSet: MoneySetSchema.nullable().optional(),
            }),
        )
        .optional()
        .default([]),
});

export const OrderNodeForIncomeV1Schema = z.object({
    id: z.string(),
    name: z.string().optional(),
    createdAt: z.string().nullable().optional(),
    processedAt: z.string().nullable(),
    updatedAt: z.string().nullable().optional(),
    cancelledAt: z.string().nullable().optional(),
    test: z.boolean().optional(),
    sourceName: z.string().nullable().optional(),
    displayFinancialStatus: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    app: z
        .object({
            id: z.string(),
            name: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    currentSubtotalPriceSet: MoneySetSchema.nullable().optional(),
    currentShippingPriceSet: MoneySetSchema.nullable().optional(),
    currentTotalTaxSet: MoneySetSchema.nullable().optional(),
    currentTotalDiscountsSet: MoneySetSchema.nullable().optional(),
    /** Order.refunds is a list of Refund (not a connection with nodes). */
    refunds: z.array(RefundNodeSchema).optional().default([]),
});

export type MoneyV2 = z.infer<typeof MoneyV2Schema>;
export type MoneySet = z.infer<typeof MoneySetSchema>;
export type RefundNode = z.infer<typeof RefundNodeSchema>;
export type OrderNodeForIncomeV1 = z.infer<typeof OrderNodeForIncomeV1Schema>;
