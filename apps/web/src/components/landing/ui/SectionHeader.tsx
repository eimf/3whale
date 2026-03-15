"use client";

import { motion } from "framer-motion";

interface SectionHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  label,
  title,
  subtitle,
  align = "center",
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className={`mb-16 ${align === "center" ? "text-center" : "text-left"}`}
    >
      {label && (
        <span className="inline-block text-accent text-sm font-medium tracking-wide uppercase mb-3">
          {label}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary leading-tight mb-4">
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-text-secondary text-lg leading-relaxed ${align === "center" ? "max-w-2xl mx-auto" : "max-w-xl"}`}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
