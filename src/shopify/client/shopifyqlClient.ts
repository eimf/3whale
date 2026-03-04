/**
 * ShopifyQL Analytics API client.
 *
 * Requires the `read_reports` access scope and API version >= 2025-10.
 * Uses its own fetch (not the shared shopifyGraphqlClient) because
 * ShopifyQL needs a newer API version than the rest of the Admin API.
 */

const SHOPIFYQL_API_VERSION = "2025-10";

export interface ShopifyQLSalesMetrics {
    orders: number;
    grossSales: number;
    discounts: number;
    returns: number;
    netSales: number;
    shippingCharges: number;
    taxes: number;
    totalSales: number;
}

interface ShopifyQLResponse {
    data?: {
        shopifyqlQuery?: {
            tableData?: {
                columns: { name: string }[];
                rows: Record<string, string>[];
            } | null;
            parseErrors?: string[];
        };
    };
    errors?: { message: string }[];
}

/**
 * Query ShopifyQL for all 8 canonical Shopify Analytics metrics.
 *
 * @param fromDate - Start date in YYYY-MM-DD format (store timezone, inclusive).
 * @param toDate   - End date in YYYY-MM-DD format (store timezone, inclusive).
 * @returns All 8 metrics or null if ShopifyQL is unavailable.
 */
export async function getShopifyQLMetrics(params: {
    shopDomain: string;
    accessToken: string;
    fromDate: string;
    toDate: string;
}): Promise<ShopifyQLSalesMetrics | null> {
    const { shopDomain, accessToken, fromDate, toDate } = params;

    const normalizedDomain = shopDomain
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    const url = `https://${normalizedDomain}/admin/api/${SHOPIFYQL_API_VERSION}/graphql.json`;

    const shopifyqlQuery =
        `FROM sales SHOW orders, gross_sales, discounts, returns, net_sales, shipping_charges, taxes, total_sales SINCE ${fromDate} UNTIL ${toDate}`;
    const gql = `{
        shopifyqlQuery(query: "${shopifyqlQuery}") {
            tableData {
                columns { name }
                rows
            }
            parseErrors
        }
    }`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query: gql }),
        });

        const json = (await res.json()) as ShopifyQLResponse;

        if (json.errors?.length) {
            const msg = json.errors[0].message;
            if (
                msg.includes("shopifyqlQuery") ||
                msg.includes("undefinedField")
            ) {
                console.warn(
                    `[ShopifyQL] Field unavailable (need API >= ${SHOPIFYQL_API_VERSION} and read_reports scope): ${msg}`,
                );
                return null;
            }
            throw new Error(`ShopifyQL error: ${msg}`);
        }

        const result = json.data?.shopifyqlQuery;
        if (result?.parseErrors?.length) {
            console.warn(
                `[ShopifyQL] Parse error: ${result.parseErrors.join(", ")}`,
            );
            return null;
        }

        const rows = result?.tableData?.rows;
        if (!rows?.length) return null;

        const row = rows[0];
        return {
            orders: parseInt(row.orders ?? "0", 10),
            grossSales: parseFloat(row.gross_sales ?? "0"),
            discounts: parseFloat(row.discounts ?? "0"),
            returns: parseFloat(row.returns ?? "0"),
            netSales: parseFloat(row.net_sales ?? "0"),
            shippingCharges: parseFloat(row.shipping_charges ?? "0"),
            taxes: parseFloat(row.taxes ?? "0"),
            totalSales: parseFloat(row.total_sales ?? "0"),
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
            msg.includes("shopifyqlQuery") ||
            msg.includes("ACCESS_DENIED") ||
            msg.includes("undefinedField")
        ) {
            console.warn(`[ShopifyQL] Unavailable: ${msg}`);
            return null;
        }
        throw err;
    }
}
