"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GlowButton } from "../ui/GlowButton";

export function BottomCTA() {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-base-900 to-blue-900/8" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
        aria-hidden
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Ready to see your store{" "}
            <span className="text-gradient">metrics in one place</span>?
          </h2>
          <p className="text-text-secondary text-lg mb-10 max-w-xl mx-auto">
            Connect your Shopify store and start tracking income, orders, and
            key metrics in minutes.
          </p>

          <GlowButton href="/login" size="lg">
            <span className="flex items-center gap-2">
              Get started
              <ArrowRight className="w-4 h-4" />
            </span>
          </GlowButton>

          <p className="text-text-muted text-xs mt-8">
            No credit card required. Connect Shopify and go.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
