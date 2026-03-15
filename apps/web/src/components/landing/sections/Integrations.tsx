"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { SectionHeader } from "../ui/SectionHeader";

const integrations = [
  { name: "Shopify", icon: ShoppingBag, primary: true },
];

function IntegrationChip({
  name,
  icon: Icon,
  primary,
}: {
  name: string;
  icon: React.ElementType;
  primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4, rotate: 1 }}
      className="relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-surface border border-surface-border hover:border-accent/25 hover:shadow-glow-sm transition-colors cursor-pointer group"
    >
      <div className="w-12 h-12 rounded-xl bg-base-700/60 flex items-center justify-center group-hover:bg-accent-muted transition-colors">
        <Icon className="w-6 h-6 text-text-muted group-hover:text-accent transition-colors" />
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors font-medium">
        {name}
      </span>
      {primary && (
        <span className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent font-medium">
          Primary integration
        </span>
      )}
      {hovered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-accent text-base-900 text-[10px] font-medium whitespace-nowrap z-10"
        >
          Connect in minutes
        </motion.div>
      )}
    </motion.div>
  );
}

export function Integrations() {
  return (
    <section id="integrations" className="relative py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          label="Integrations"
          title="Connects with your store"
          subtitle="One connection to Shopify. Your orders and revenue flow into 3whale so you can focus on the dashboard, not the data entry."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {integrations.map((int, i) => (
            <motion.div
              key={int.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <IntegrationChip
                name={int.name}
                icon={int.icon}
                primary={int.primary}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
