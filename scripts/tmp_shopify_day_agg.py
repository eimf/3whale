import os
import json
import urllib.request
from decimal import Decimal, getcontext

getcontext().prec = 28

shop = os.environ.get("SHOPIFY_SHOP_DOMAIN") or "f4t3-clo.myshopify.com"
version = os.environ.get("SHOPIFY_API_VERSION", "2025-04")
token = os.environ.get("SHOPIFY_ADMIN_ACCESS_TOKEN")
if not token:
    raise SystemExit("missing SHOPIFY_ADMIN_ACCESS_TOKEN")

url = f"https://{shop}/admin/api/{version}/graphql.json"
query = """
query($first:Int!,$after:String,$q:String!){
  orders(first:$first, after:$after, query:$q, sortKey:PROCESSED_AT){
    pageInfo{hasNextPage endCursor}
    edges{
      node{
        id
        name
        processedAt
        subtotalPriceSet{shopMoney{amount}}
        totalDiscountsSet{shopMoney{amount}}
        totalShippingPriceSet{shopMoney{amount}}
        totalTaxSet{shopMoney{amount}}
        currentSubtotalPriceSet{shopMoney{amount}}
        currentTotalDiscountsSet{shopMoney{amount}}
        currentShippingPriceSet{shopMoney{amount}}
        currentTotalTaxSet{shopMoney{amount}}
        refunds(first:20){
          id
          createdAt
          totalRefundedSet{shopMoney{amount}}
          refundLineItems(first:50){
            edges{node{
              quantity
              subtotalSet{shopMoney{amount}}
              lineItem{quantity originalTotalSet{shopMoney{amount}}}
            }}
          }
        }
      }
    }
  }
}
"""

search_query = "processed_at:>=2026-02-28T06:00:00Z processed_at:<=2026-03-01T05:59:59Z status:any"

after = None
orders = []
while True:
    payload = json.dumps(
        {
            "query": query,
            "variables": {"first": 100, "after": after, "q": search_query},
        }
    ).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.loads(response.read().decode())
    if data.get("errors"):
        raise SystemExit(json.dumps(data["errors"], indent=2))
    conn = data["data"]["orders"]
    orders.extend(edge["node"] for edge in conn["edges"])
    if not conn["pageInfo"]["hasNextPage"]:
        break
    after = conn["pageInfo"]["endCursor"]


def D(value: object) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def amount(node: dict, key: str) -> Decimal:
    container = node.get(key) or {}
    shop_money = container.get("shopMoney") or {}
    return D(shop_money.get("amount"))


def in_refund_day(created_at: str) -> bool:
    ts = created_at.replace("Z", "")
    return "2026-02-28T06:00:00" <= ts <= "2026-03-01T05:59:59.999"

subtotal_total = Decimal("0")
discounts_total = Decimal("0")
shipping_total = Decimal("0")
tax_total = Decimal("0")
subtotal_current = Decimal("0")
discounts_current = Decimal("0")
shipping_current = Decimal("0")
tax_current = Decimal("0")
refund_reported = Decimal("0")
refund_line_net = Decimal("0")
refund_line_gross = Decimal("0")
refund_count = 0

for order in orders:
    subtotal_total += amount(order, "subtotalPriceSet")
    discounts_total += amount(order, "totalDiscountsSet")
    shipping_total += amount(order, "totalShippingPriceSet")
    tax_total += amount(order, "totalTaxSet")
    subtotal_current += amount(order, "currentSubtotalPriceSet")
    discounts_current += amount(order, "currentTotalDiscountsSet")
    shipping_current += amount(order, "currentShippingPriceSet")
    tax_current += amount(order, "currentTotalTaxSet")

    for refund in order.get("refunds") or []:
        created_at = refund.get("createdAt")
        if not created_at or not in_refund_day(created_at):
            continue
        refund_count += 1
        refund_reported += amount(refund, "totalRefundedSet")

        for edge in ((refund.get("refundLineItems") or {}).get("edges") or []):
            node = edge.get("node") or {}
            qty = D(node.get("quantity"))
            net_subtotal = amount(node, "subtotalSet")
            refund_line_net += net_subtotal

            line_item = node.get("lineItem") or {}
            line_item_qty = D(line_item.get("quantity"))
            original_total = amount(line_item, "originalTotalSet")
            if line_item_qty > 0 and qty > 0 and original_total != 0:
                refund_line_gross += original_total * qty / line_item_qty
            else:
                refund_line_gross += net_subtotal

out = {
    "orders": len(orders),
    "totals": {
        "subtotal_total": str(subtotal_total),
        "discounts_total": str(discounts_total),
        "shipping_total": str(shipping_total),
        "tax_total": str(tax_total),
        "subtotal_current": str(subtotal_current),
        "discounts_current": str(discounts_current),
        "shipping_current": str(shipping_current),
        "tax_current": str(tax_current),
    },
    "refunds_created_in_range": {
        "count": refund_count,
        "reported": str(refund_reported),
        "line_net": str(refund_line_net),
        "line_gross": str(refund_line_gross),
    },
    "derived": {
        "gross_total_base": str(subtotal_total + discounts_total),
        "net_total_base_created_returns": str(subtotal_total - refund_line_gross),
        "total_total_base_created_returns": str(
            (subtotal_total - refund_line_gross) + shipping_total + tax_total
        ),
    },
}

print(json.dumps(out, indent=2))
