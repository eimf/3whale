"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";

const testimonials = [
  {
    quote:
      "We finally have a single place to see daily income and orders without opening Shopify every time.",
    extendedQuote:
      " The dashboard is now our go-to for quick check-ins. Sync is fast and the numbers match what we see in the admin.",
    name: "Sarah Chen",
    role: "Head of Ops",
    company: "Riviera Beauty Co.",
    metric: "Saves 2+ hours/week",
  },
  {
    quote:
      "Tracking revenue and order trends over time was a mess in spreadsheets. 3whale made it one click.",
    extendedQuote:
      " We use the date ranges every day. Having income and orders in one dashboard changed how we run the business.",
    name: "Marcus Rivera",
    role: "CEO & Founder",
    company: "Apex Nutrition",
    metric: "Clearer picture of growth",
  },
  {
    quote:
      "Simple, fast, and it just works. We connected our store and had real data in the dashboard in minutes.",
    extendedQuote:
      " The sync status is clear so we know when data was last updated. No more guessing if our numbers are current.",
    name: "Priya Patel",
    role: "VP of Marketing",
    company: "Drift Apparel",
    metric: "Faster decisions",
  },
];

function TestimonialCard({
  t,
  index,
}: {
  t: (typeof testimonials)[0];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="bg-surface rounded-2xl border border-surface-border p-6 lg:p-8 hover:border-accent/20 transition-colors shadow-card hover:shadow-card-hover cursor-default"
    >
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-accent text-accent" />
        ))}
      </div>

      <Quote className="w-8 h-8 text-accent/20 mb-3" />

      <p className="text-text-primary text-base leading-relaxed mb-6">
        {t.quote}
        <motion.span
          initial={false}
          animate={{
            opacity: expanded ? 1 : 0,
            height: expanded ? "auto" : 0,
          }}
          className="inline overflow-hidden"
        >
          {expanded && (
            <span className="text-text-secondary">{t.extendedQuote}</span>
          )}
        </motion.span>
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-surface-border">
        <div>
          <p className="text-text-primary font-semibold text-sm">{t.name}</p>
          <p className="text-text-muted text-xs">
            {t.role}, {t.company}
          </p>
        </div>
        <span className="text-accent text-xs font-medium bg-accent-muted px-2.5 py-1 rounded-lg">
          {t.metric}
        </span>
      </div>
    </motion.div>
  );
}

export function Testimonials() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Testimonials"
          title="Stores that run on clear numbers"
          subtitle="Shopify merchants use 3whale to keep income and orders in one place—without the spreadsheet hassle."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.name} t={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
