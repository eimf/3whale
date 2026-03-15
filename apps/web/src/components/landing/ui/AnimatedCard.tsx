"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export function AnimatedCard({
  children,
  className = "",
  delay = 0,
  hover = true,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={
        hover ? { y: -4, transition: { duration: 0.2 } } : undefined
      }
      className={`
        bg-surface rounded-2xl border border-surface-border shadow-card
        ${hover ? "hover:shadow-card-hover hover:border-accent/20 transition-colors duration-300" : ""}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
