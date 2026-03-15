"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { GlowButton } from "../ui/GlowButton";
import { ChartPreview } from "../ui/ChartPreview";
import { ParticleField } from "../effects/ParticleField";

function DashboardMini() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Revenue", value: "$42.3K", change: "+24%" },
          { label: "Orders", value: "1,240", change: "+12%" },
          { label: "AOV", value: "$34.10", change: "+8%" },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-base-700/60 rounded-xl p-3 border border-surface-border"
          >
            <p className="text-text-muted text-[10px] uppercase tracking-wider">
              {m.label}
            </p>
            <p className="text-text-primary text-lg font-bold mt-1">
              {m.value}
            </p>
            <p
              className={`text-xs mt-0.5 ${m.change.startsWith("+") ? "text-accent" : "text-red-400"}`}
            >
              {m.change}
            </p>
          </div>
        ))}
      </div>
      <ChartPreview />
    </div>
  );
}

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-16"
    >
      <div className="absolute inset-0 gradient-mesh" />
      <ParticleField />

      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={textVariants}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted border border-accent/20 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent text-xs font-medium">
                Shopify metrics sync
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={textVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text-primary leading-[1.1] tracking-tight mb-6"
            >
              Your store metrics,{" "}
              <span className="text-gradient">in one dashboard</span>.
            </motion.h1>

            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={textVariants}
              className="text-text-secondary text-lg leading-relaxed mb-8 max-w-lg"
            >
              3whale syncs income, orders, and key metrics from Shopify so you
              can track performance and trends without leaving your workflow.
            </motion.p>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={textVariants}
              className="flex flex-wrap gap-3"
            >
              <GlowButton href="/login" size="lg">
                <span className="flex items-center gap-2">
                  Get started
                  <ArrowRight className="w-4 h-4" />
                </span>
              </GlowButton>
              <a
                href="#product"
                className="inline-flex items-center gap-2 px-8 py-4 text-base rounded-xl bg-transparent text-text-primary font-medium border border-surface-border hover:border-accent/40 hover:text-accent hover:shadow-glow-sm active:scale-[0.97] transition-all duration-200"
              >
                <Play className="w-4 h-4" />
                See dashboard
              </a>
            </motion.div>

            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={textVariants}
              className="flex items-center gap-6 mt-8 text-sm text-text-muted"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-accent" />
                Connect in minutes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-accent" />
                No code required
              </span>
            </motion.div>
          </div>

          <motion.div
            style={{ y: previewY }}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-accent/5 rounded-3xl blur-2xl" />
            <div className="relative bg-base-800/80 backdrop-blur-sm rounded-2xl border border-surface-border p-4 sm:p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-text-muted font-mono">
                  dashboard.3whale
                </span>
              </div>
              <DashboardMini />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
