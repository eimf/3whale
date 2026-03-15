"use client";

import { motion } from "framer-motion";
import {
  ShoppingBag,
  BarChart3,
  Zap,
  Layers,
  Globe,
  TrendingUp,
  ShoppingCart,
  Package,
  Truck,
  Store,
  CreditCard,
  Target,
} from "lucide-react";
import { MarqueeLogoRow } from "../ui/MarqueeLogoRow";
import { useAnimatedCounter } from "../hooks/useAnimatedCounter";

const brandLogos = [
  { name: "Velvet Commerce", icon: ShoppingBag },
  { name: "Dataflow", icon: BarChart3 },
  { name: "SparkRetail", icon: Zap },
  { name: "StackPlatform", icon: Layers },
  { name: "GlobalShop", icon: Globe },
  { name: "GrowthOS", icon: TrendingUp },
  { name: "CartWise", icon: ShoppingCart },
  { name: "PackDirect", icon: Package },
  { name: "ShipFast", icon: Truck },
  { name: "Storefront", icon: Store },
  { name: "PaySync", icon: CreditCard },
  { name: "AdTarget", icon: Target },
];

function LogoChip({
  name,
  icon: Icon,
}: {
  name: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-base-800/60 border border-surface-border whitespace-nowrap select-none">
      <Icon className="w-4 h-4 text-text-muted" />
      <span className="text-sm text-text-secondary font-medium">{name}</span>
    </div>
  );
}

export function SocialProof() {
  const { count, ref } = useAnimatedCounter(3600);

  return (
    <section className="relative py-16 border-y border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center"
        >
          <p className="text-text-secondary text-sm">
            Trusted by Shopify stores
          </p>
          <div className="flex items-baseline gap-1">
            <span
              ref={ref}
              className="text-2xl font-bold text-text-primary"
            >
              {count.toLocaleString()}+
            </span>
            <span className="text-text-secondary text-sm">
              stores syncing metrics
            </span>
          </div>
        </motion.div>
      </div>

      <MarqueeLogoRow>
        {brandLogos.map((b) => (
          <LogoChip key={b.name} name={b.name} icon={b.icon} />
        ))}
      </MarqueeLogoRow>
    </section>
  );
}
