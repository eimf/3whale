/**
 * Summarize Shopify order payload for internal drill-down.
 * No PII: ids, timestamps, totals, counts, statuses only.
 */

export interface OrderPayloadSummary {
  id?: string;
  name?: string;
  processedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  subtotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  totalTaxSet?: { shopMoney?: { amount?: string } };
  totalShippingPriceSet?: { shopMoney?: { amount?: string } };
  totalDiscountsSet?: { shopMoney?: { amount?: string } };
  lineItemsCount?: number;
  refundsCount?: number;
  test?: boolean;
  canceledAt?: string | null;
}

function safeStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

function safeNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function summarizeOrderPayload(payload: unknown): OrderPayloadSummary | null {
  if (payload === null || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;

  const totalPriceSet = o.totalPriceSet as Record<string, unknown> | undefined;
  const shopMoney = totalPriceSet?.shopMoney as Record<string, unknown> | undefined;

  const subtotalPriceSet = o.subtotalPriceSet as Record<string, unknown> | undefined;
  const subtotalMoney = subtotalPriceSet?.shopMoney as Record<string, unknown> | undefined;

  const totalTaxSet = o.totalTaxSet as Record<string, unknown> | undefined;
  const taxMoney = totalTaxSet?.shopMoney as Record<string, unknown> | undefined;

  const totalShippingPriceSet = o.totalShippingPriceSet as Record<string, unknown> | undefined;
  const shippingMoney = totalShippingPriceSet?.shopMoney as Record<string, unknown> | undefined;

  const totalDiscountsSet = o.totalDiscountsSet as Record<string, unknown> | undefined;
  const discountMoney = totalDiscountsSet?.shopMoney as Record<string, unknown> | undefined;

  const lineItems = o.lineItems as unknown;
  const lineItemsArr = Array.isArray(lineItems) ? lineItems : [];
  const refunds = o.refunds as unknown;
  const refundsArr = Array.isArray(refunds) ? refunds : [];

  return {
    id: safeStr(o.id),
    name: safeStr(o.name),
    processedAt: safeStr(o.processedAt),
    createdAt: safeStr(o.createdAt),
    updatedAt: safeStr(o.updatedAt),
    status: safeStr(o.status),
    financialStatus: safeStr(o.financialStatus),
    fulfillmentStatus: safeStr(o.fulfillmentStatus),
    totalPriceSet: shopMoney
      ? { shopMoney: { amount: safeStr(shopMoney.amount), currencyCode: safeStr(shopMoney.currencyCode) } }
      : undefined,
    subtotalPriceSet: subtotalMoney
      ? { shopMoney: { amount: safeStr(subtotalMoney.amount), currencyCode: safeStr(subtotalMoney.currencyCode) } }
      : undefined,
    totalTaxSet: taxMoney ? { shopMoney: { amount: safeStr(taxMoney.amount) } } : undefined,
    totalShippingPriceSet: shippingMoney ? { shopMoney: { amount: safeStr(shippingMoney.amount) } } : undefined,
    totalDiscountsSet: discountMoney ? { shopMoney: { amount: safeStr(discountMoney.amount) } } : undefined,
    lineItemsCount: safeNum(lineItemsArr.length) ?? 0,
    refundsCount: safeNum(refundsArr.length) ?? 0,
    test: o.test === true,
    canceledAt: o.canceledAt != null ? safeStr(o.canceledAt) ?? null : null,
  };
}
