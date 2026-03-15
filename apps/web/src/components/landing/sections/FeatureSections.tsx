"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  ShoppingBag,
  BarChart3,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    label: "Sync",
    title: "Shopify data in one place",
    description:
      "Connect your store once. 3whale syncs orders and revenue so your dashboard always reflects your latest numbers.",
    bullets: [
      "Secure connection to your Shopify store",
      "Automatic sync of orders and financial data",
      "On-demand refresh when you need it",
    ],
    icon: ShoppingBag,
  },
  {
    label: "Dashboard",
    title: "Metrics that tell the story",
    description:
      "Income over time, order counts, and key KPIs. No clutter—just the metrics you use to run your business.",
    bullets: [
      "Daily and cumulative income views",
      "Order counts and trends",
      "Flexible date ranges and comparisons",
    ],
    icon: BarChart3,
  },
  {
    label: "Always current",
    title: "Stay up to date without the busywork",
    description:
      "Run a sync from the dashboard or let scheduled jobs keep everything fresh. No more copying numbers from Shopify admin.",
    bullets: [
      "Manual sync when you need it",
      "Background sync for fresh data",
      "Clear status so you know when data was last updated",
    ],
    icon: RefreshCw,
  },
];

export function FeatureSections() {
  return (
    <section id="solutions" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        {features.map((f, idx) => {
          const isReversed = idx % 2 === 1;
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${isReversed ? "lg:direction-rtl" : ""}`}
            >
              <motion.div
                initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className={isReversed ? "lg:order-2" : ""}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted border border-accent/20 mb-4">
                  <Icon className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent text-xs font-medium">
                    {f.label}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                  {f.title}
                </h3>
                <p className="text-text-secondary text-base leading-relaxed mb-6">
                  {f.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary text-sm">{b}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#product"
                  className="inline-flex items-center gap-1.5 text-accent text-sm font-medium hover:gap-3 transition-all"
                >
                  See in action <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: isReversed ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className={isReversed ? "lg:order-1" : ""}
              >
                <div className="bg-base-800/80 rounded-2xl border border-surface-border p-6 h-full min-h-[200px] flex items-center justify-center">
                  <div className="text-center text-text-muted">
                    <Icon className="w-12 h-12 mx-auto mb-3 opacity-60" />
                    <p className="text-sm">{f.title}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
