#!/usr/bin/env python3
import os
import json
import subprocess

os.chdir("/Users/levi/ws3/3whale")
os.environ["INTERNAL_API_KEY"] = os.environ.get("INTERNAL_API_KEY", "")

subprocess.run(
    [
        "curl",
        "-s",
        "-H",
        f'x-internal-api-key: {os.environ["INTERNAL_API_KEY"]}',
        "http://localhost:3000/internal/income/summary-v2?from=2026-02-28&to=2026-02-28&includeExcluded=true",
    ],
    stdout=open("/tmp/internal_summary_v2_single_day.json", "w"),
)

subprocess.run(
    [
        "curl",
        "-s",
        "-H",
        f'x-internal-api-key: {os.environ["INTERNAL_API_KEY"]}',
        "http://localhost:3000/internal/income/summary-v2?from=2026-02-01&to=2026-02-28&includeExcluded=true",
    ],
    stdout=open("/tmp/internal_summary_v2_month.json", "w"),
)

for label, fpath in [
    (
        "internal/income/summary-v2 (2026-02-28)",
        "/tmp/internal_summary_v2_single_day.json",
    ),
    (
        "internal/income/summary-v2 (2026-02-01 to 2026-02-28)",
        "/tmp/internal_summary_v2_month.json",
    ),
]:
    try:
        with open(fpath) as f:
            p = json.load(f)
        print(f"\n{label}:")
        print(
            json.dumps(
                {
                    "range": p.get("range"),
                    "shopifyParity": p.get("shopifyParity"),
                    "ordersIncluded": p.get("ordersIncluded"),
                    "error": p.get("error"),
                },
                indent=2,
            )
        )
    except Exception as e:
        print(f"ERROR reading {fpath}: {e}")
