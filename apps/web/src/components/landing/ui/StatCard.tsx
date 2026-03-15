"use client";

import { type ReactNode } from "react";
import { AnimatedCard } from "./AnimatedCard";
import { Sparkline } from "./Sparkline";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  sparkData?: number[];
  delay?: number;
}

export function StatCard({
  icon,
  title,
  description,
  sparkData,
  delay = 0,
}: StatCardProps) {
  return (
    <AnimatedCard delay={delay} className="p-6 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
          {icon}
        </div>
        <Sparkline data={sparkData} width={80} height={28} />
      </div>
      <h3 className="text-text-primary font-semibold text-base mb-1">
        {title}
      </h3>
      <p className="text-text-secondary text-sm leading-relaxed">
        {description}
      </p>
    </AnimatedCard>
  );
}
