/**
 * Fetch shop timezone and currency from Shopify REST Admin API (shop.json).
 * Used by bootstrap to populate shop_config without requiring SHOP_TIMEZONE_IANA / SHOP_CURRENCY_CODE in env.
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-04";

export interface ShopConfigFromShopify {
  ianaTimezone: string;
  currencyCode: string;
}

interface ShopJsonResponse {
  shop?: {
    iana_timezone?: string;
    currency?: string;
  };
}

/**
 * GET /admin/api/{version}/shop.json and return iana_timezone and currency.
 * @throws Error if request fails or response missing required fields
 */
export async function fetchShopConfigFromShopify(params: {
  shopDomain: string;
  accessToken: string;
}): Promise<ShopConfigFromShopify> {
  const { shopDomain, accessToken } = params;
  const normalizedDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${normalizedDomain}/admin/api/${API_VERSION}/shop.json`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
    },
  });

  const json = (await res.json()) as ShopJsonResponse;
  if (!res.ok) {
    const msg = (json as { errors?: string }).errors ?? res.statusText;
    throw new Error(`Shopify shop.json HTTP ${res.status}: ${msg}`);
  }

  const shop = json.shop;
  if (!shop) {
    throw new Error("Shopify shop.json: missing shop object");
  }

  const ianaTimezone = shop.iana_timezone?.trim();
  const currencyCode = shop.currency?.trim();
  if (!ianaTimezone || !currencyCode) {
    throw new Error(
      `Shopify shop.json: missing iana_timezone or currency (got iana_timezone=${ianaTimezone ?? "null"}, currency=${currencyCode ?? "null"})`,
    );
  }

  return { ianaTimezone, currencyCode };
}
