"use client";

import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Calendar,
  Zap,
} from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";
import { StatCard } from "../ui/StatCard";

const metrics = [
  {
    icon: <DollarSign className="w-5 h-5" />,
    title: "Income tracking",
    description:
      "Daily and cumulative income synced from Shopify. See revenue trends at a glance.",
    sparkData: [20, 28, 25, 35, 30, 42, 38, 50, 45, 58, 52, 65],
  },
  {
    icon: <ShoppingCart className="w-5 h-5" />,
    title: "Order metrics",
    description:
      "Order counts and averages. Track volume and conversion without digging into Shopify admin.",
    sparkData: [50, 45, 48, 40, 42, 35, 38, 30, 32, 25, 28, 22],
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: "Store KPIs",
    description:
      "Key store metrics in one place. Compare periods and spot trends quickly.",
    sparkData: [15, 22, 20, 30, 28, 38, 35, 45, 42, 52, 50, 60],
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Charts & sparklines",
    description:
      "Visualize income and orders over time. Export or drill down when you need more detail.",
    sparkData: [30, 25, 35, 28, 40, 32, 45, 38, 50, 42, 55, 48],
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Date ranges",
    description:
      "Filter by today, week, month, or custom range. Same data, the way you need it.",
    sparkData: [20, 25, 22, 32, 28, 38, 35, 42, 40, 50, 48, 58],
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: "Auto sync",
    description:
      "Metrics stay up to date. Sync on demand or let 3whale keep your dashboard fresh.",
    sparkData: [40, 42, 38, 55, 40, 42, 70, 45, 42, 40, 38, 42],
  },
];

export function MetricsGrid() {
  return (
    <section id="product" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Metrics"
          title="Every number that matters, in one place"
          subtitle="Income, orders, and key store metrics from Shopify. No spreadsheets, no manual exports."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {metrics.map((m, i) => (
            <StatCard
              key={m.title}
              icon={m.icon}
              title={m.title}
              description={m.description}
              sparkData={m.sparkData}
              delay={i * 0.06}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
