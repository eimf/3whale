import os
import json
import subprocess
import urllib.request
from decimal import Decimal, getcontext

getcontext().prec = 28

DB = os.environ.get("DATABASE_URL")
SHOP = os.environ.get("SHOPIFY_SHOP_DOMAIN") or "f4t3-clo.myshopify.com"
VERSION = os.environ.get("SHOPIFY_API_VERSION", "2025-04")
TOKEN = os.environ.get("SHOPIFY_ADMIN_ACCESS_TOKEN")

if not DB:
    raise SystemExit("missing DATABASE_URL")
if not TOKEN:
    raise SystemExit("missing SHOPIFY_ADMIN_ACCESS_TOKEN")

sql = """
select
  shopify_refund_id,
  shopify_order_id,
  refund_created_at,
  refund_line_items_amount,
  refund_line_items_gross_amount
from order_refund_event_v1
where refund_created_at >= '2026-02-28T06:00:00.000Z'::timestamptz
  and refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz
order by refund_created_at asc;
"""

rows_raw = subprocess.check_output(
    ["psql", DB, "-F", "\t", "-Atc", sql], text=True
).strip()
rows = []
if rows_raw:
    for line in rows_raw.splitlines():
        refund_id, order_id, created_at, line_net, line_gross = line.split("\t")
        rows.append(
            {
                "refund_id": refund_id,
                "order_id": order_id,
                "created_at": created_at,
                "stored_line_net": Decimal(line_net),
                "stored_line_gross": Decimal(line_gross),
            }
        )

query = """
query($id: ID!){
  order(id:$id){
    id
    refunds(first:50){
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
"""

url = f"https://{SHOP}/admin/api/{VERSION}/graphql.json"


def D(v):
    if v in (None, ""):
        return Decimal("0")
    return Decimal(str(v))


def live_refunds_for_order(order_id: str):
    payload = json.dumps({"query": query, "variables": {"id": order_id}}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": TOKEN,
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        body = json.loads(response.read().decode())
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], indent=2))
    order = (body.get("data") or {}).get("order") or {}
    return order.get("refunds") or []


cache = {}
out = []

sum_stored_net = Decimal("0")
sum_stored_gross = Decimal("0")
sum_live_net = Decimal("0")
sum_live_gross = Decimal("0")

for row in rows:
    order_id = row["order_id"]
    if order_id not in cache:
        cache[order_id] = live_refunds_for_order(order_id)

    matched = None
    for rf in cache[order_id]:
        if str(rf.get("id")) == str(row["refund_id"]):
            matched = rf
            break

    live_net = Decimal("0")
    live_gross = Decimal("0")

    if matched:
        for edge in ((matched.get("refundLineItems") or {}).get("edges") or []):
            node = edge.get("node") or {}
            qty = D(node.get("quantity"))
            subtotal = D(
                (((node.get("subtotalSet") or {}).get("shopMoney") or {}).get("amount"))
            )
            live_net += subtotal
            line_item = node.get("lineItem") or {}
            li_qty = D(line_item.get("quantity"))
            li_orig = D(
                (((line_item.get("originalTotalSet") or {}).get("shopMoney") or {}).get("amount"))
            )
            if li_qty > 0 and qty > 0 and li_orig != 0:
                live_gross += li_orig * qty / li_qty
            else:
                live_gross += subtotal

    sum_stored_net += row["stored_line_net"]
    sum_stored_gross += row["stored_line_gross"]
    sum_live_net += live_net
    sum_live_gross += live_gross

    out.append(
        {
            "refund_id": row["refund_id"],
            "order_id": order_id,
            "created_at": row["created_at"],
            "stored_line_net": str(row["stored_line_net"]),
            "stored_line_gross": str(row["stored_line_gross"]),
            "live_line_net": str(live_net),
            "live_line_gross": str(live_gross),
            "gross_delta_live_minus_stored": str(live_gross - row["stored_line_gross"]),
        }
    )

print(
    json.dumps(
        {
            "events": out,
            "totals": {
                "stored_line_net": str(sum_stored_net),
                "stored_line_gross": str(sum_stored_gross),
                "live_line_net": str(sum_live_net),
                "live_line_gross": str(sum_live_gross),
                "live_minus_stored_gross": str(sum_live_gross - sum_stored_gross),
            },
        },
        indent=2,
    )
)
