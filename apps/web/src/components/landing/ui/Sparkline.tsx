"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface SparklineProps {
  data?: number[];
  color?: string;
  width?: number;
  height?: number;
}

const defaultData = [20, 35, 25, 45, 30, 55, 40, 60, 50, 70, 55, 75];

export function Sparkline({
  data = defaultData,
  color = "#2EE9A6",
  width = 100,
  height = 32,
}: SparklineProps) {
  const reducedMotion = useReducedMotion();
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y =
      height - ((value - min) / range) * (height * 0.8) - height * 0.1;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  const gradId = `sparkGrad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <motion.path
        d={pathD}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        initial={reducedMotion ? undefined : { pathLength: 0 }}
        whileInView={reducedMotion ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
    </svg>
  );
}
