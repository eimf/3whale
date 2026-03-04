import os
import json
import urllib.request
from datetime import datetime, UTC
from zoneinfo import ZoneInfo

DOMAIN = os.environ.get("SHOP_DOMAIN", "f4t3-clo.myshopify.com")
API_VERSION = os.environ.get("SHOPIFY_API_VERSION", "2025-04")
TOKEN = os.environ.get("SHOPIFY_ADMIN_ACCESS_TOKEN")
if not TOKEN:
    raise SystemExit("Missing SHOPIFY_ADMIN_ACCESS_TOKEN")

with open("src/shopify/graphql/ordersForIncomeV1.graphql", "r", encoding="utf-8") as f:
    QUERY = f.read()

TZ = ZoneInfo("America/Mexico_City")


def to_num(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def local_date(iso):
    if not iso:
        return None
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(TZ)
    return dt.date().isoformat()


def gql(body):
    req = urllib.request.Request(
        f"https://{DOMAIN}/admin/api/{API_VERSION}/graphql.json",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": TOKEN,
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"]))
    return payload


def fetch_orders(from_d, to_d):
    out = []
    after = None
    while True:
        search = f"processed_at:>={from_d} processed_at:<={to_d} status:any"
        body = {
            "query": QUERY,
            "variables": {"first": 250, "after": after, "query": search},
        }
        payload = gql(body)
        conn = payload["data"]["orders"]
        out.extend(conn.get("nodes") or [])
        if not conn["pageInfo"]["hasNextPage"]:
            break
        after = conn["pageInfo"]["endCursor"]
    return out


def compute(orders, from_d, to_d):
    subtotal = discounts = shipping = tax = 0.0
    ret_line_gross = ret_ship = ret_line_tax = ret_ship_tax = 0.0
    ret_duties = ret_adj = ret_adj_tax = 0.0
    orders_count = 0
    canceled = []
    refund_contrib = []

    for order in orders:
        if bool(order.get("test")):
            continue

        orders_count += 1
        canceled_flag = bool(order.get("cancelledAt") or order.get("canceledAt"))

        if not canceled_flag:
            subtotal += to_num(
                (
                    ((order.get("subtotalPriceSet") or {}).get("shopMoney") or {}).get(
                        "amount"
                    )
                )
            )
            discounts += to_num(
                (
                    ((order.get("totalDiscountsSet") or {}).get("shopMoney") or {}).get(
                        "amount"
                    )
                )
            )
            shipping += to_num(
                (
                    (
                        (order.get("totalShippingPriceSet") or {}).get("shopMoney")
                        or {}
                    ).get("amount")
                )
            )
            tax += to_num(
                (
                    ((order.get("totalTaxSet") or {}).get("shopMoney") or {}).get(
                        "amount"
                    )
                )
            )
        else:
            canceled.append(
                {
                    "id": order.get("id"),
                    "name": order.get("name"),
                    "processedAt": order.get("processedAt"),
                }
            )

        for refund in order.get("refunds") or []:
            rd = local_date(refund.get("createdAt"))
            if not rd or rd < from_d or rd > to_d:
                continue

            line_items_gross = 0.0
            line_items_tax = 0.0
            for edge in (refund.get("refundLineItems") or {}).get("edges") or []:
                node = (edge or {}).get("node") or {}
                # CRITICAL FIX: Always use lineItem.originalTotalSet; only fallback if absent/null/zero
                value = to_num(
                    (
                        (
                            (
                                (
                                    (node.get("lineItem") or {}).get("originalTotalSet")
                                    or {}
                                ).get("shopMoney")
                            )
                            or {}
                        ).get("amount")
                    )
                )
                # Fallback to subtotalSet ONLY if originalTotalSet is missing/null/zero
                if value == 0.0:
                    value = to_num(
                        (
                            (
                                (node.get("subtotalSet") or {}).get("shopMoney") or {}
                            ).get("amount")
                        )
                    )
                line_items_gross += value
                line_items_tax += to_num(
                    (
                        ((node.get("totalTaxSet") or {}).get("shopMoney") or {}).get(
                            "amount"
                        )
                    )
                )

            ship = 0.0
            ship_tax = 0.0
            for edge in (refund.get("refundShippingLines") or {}).get("edges") or []:
                node = (edge or {}).get("node") or {}
                ship += to_num(
                    (
                        (
                            (node.get("subtotalAmountSet") or {}).get("shopMoney") or {}
                        ).get("amount")
                    )
                )
                ship_tax += to_num(
                    (
                        ((node.get("taxAmountSet") or {}).get("shopMoney") or {}).get(
                            "amount"
                        )
                    )
                )

            duties = 0.0
            for duty in refund.get("duties") or []:
                duties += to_num(
                    (
                        (((duty.get("amountSet") or {}).get("shopMoney")) or {}).get(
                            "amount"
                        )
                    )
                )

            order_adjustments = 0.0
            order_adjustments_tax = 0.0
            for edge in (refund.get("orderAdjustments") or {}).get("edges") or []:
                node = (edge or {}).get("node") or {}
                order_adjustments += to_num(
                    (
                        ((node.get("amountSet") or {}).get("shopMoney") or {}).get(
                            "amount"
                        )
                    )
                )
                order_adjustments_tax += to_num(
                    (
                        ((node.get("taxAmountSet") or {}).get("shopMoney") or {}).get(
                            "amount"
                        )
                    )
                )

            ret_line_gross += line_items_gross
            ret_ship += ship
            ret_line_tax += line_items_tax
            ret_ship_tax += ship_tax
            ret_duties += duties
            ret_adj += order_adjustments
            ret_adj_tax += order_adjustments_tax
            refund_contrib.append(
                {
                    "orderId": order.get("id"),
                    "orderName": order.get("name"),
                    "refundId": refund.get("id"),
                    "refundCreatedAt": refund.get("createdAt"),
                    "lineItemsGross": round(line_items_gross, 6),
                }
            )

    gross_sales = subtotal + discounts
    discounts_signed = -discounts
    returns_signed = -ret_line_gross
    net_sales = gross_sales + discounts_signed + returns_signed
    shipping_charges = shipping - ret_ship
    taxes = tax - ret_line_tax - ret_ship_tax - ret_duties - ret_adj_tax
    return_fees = max(ret_adj, 0.0)
    total_sales = net_sales + shipping_charges + taxes + return_fees

    def fmt(value):
        return f"{value:.6f}"

    return {
        "range": {"from": from_d, "to": to_d, "timezone": "America/Mexico_City"},
        "counts": {
            "orders_non_test_including_cancelled": orders_count,
            "cancelled_excluded_from_financial": len(canceled),
        },
        "orderMoney": {
            "subtotalTotal": fmt(subtotal),
            "discountsTotal": fmt(discounts),
            "shippingTotal": fmt(shipping),
            "taxTotal": fmt(tax),
        },
        "refundsByCreatedAt": {
            "lineItemsGross": fmt(ret_line_gross),
            "shipping": fmt(ret_ship),
            "lineItemsTax": fmt(ret_line_tax),
            "shippingTax": fmt(ret_ship_tax),
            "duties": fmt(ret_duties),
            "orderAdjustments": fmt(ret_adj),
            "orderAdjustmentsTax": fmt(ret_adj_tax),
        },
        "metrics": {
            "grossSales": fmt(gross_sales),
            "discounts": fmt(discounts_signed),
            "returns": fmt(returns_signed),
            "netSales": fmt(net_sales),
            "shippingCharges": fmt(shipping_charges),
            "taxes": fmt(taxes),
            "returnFees": fmt(return_fees),
            "totalSales": fmt(total_sales),
        },
        "contributors": {
            "cancelledFinancialOrders": canceled[:20],
            "refundContributorsTop": sorted(
                refund_contrib,
                key=lambda x: x["lineItemsGross"],
                reverse=True,
            )[:20],
        },
    }


if __name__ == "__main__":
    ranges = [("2026-02-28", "2026-02-28"), ("2026-02-01", "2026-02-28")]
    result = {
        "domain": DOMAIN,
        "apiVersion": API_VERSION,
        "generatedAt": datetime.now(UTC).isoformat(),
        "results": [],
    }
    for from_d, to_d in ranges:
        orders = fetch_orders(from_d, to_d)
        result["results"].append(
            {"ordersFetched": len(orders), "computed": compute(orders, from_d, to_d)}
        )

    print(json.dumps(result, indent=2))
