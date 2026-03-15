"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "../hooks/useReducedMotion";

const revenueData = [
  30, 45, 35, 55, 48, 62, 58, 72, 65, 80, 75, 92, 88, 105, 98, 115, 108, 125,
];
const spendData = [
  20, 22, 25, 24, 28, 26, 30, 29, 32, 31, 34, 33, 36, 35, 38, 37, 40, 39,
];

function buildPath(
  data: number[],
  width: number,
  height: number,
  padding = 16
) {
  const max = Math.max(...data) * 1.1;
  const min = 0;
  const range = max - min;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * usableW;
    const y = padding + usableH - ((v - min) / range) * usableH;
    return { x, y };
  });

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
    d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = `${d} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`;

  return { line: d, area: areaD };
}

export function ChartPreview() {
  const reducedMotion = useReducedMotion();
  const w = 440;
  const h = 200;
  const revenue = buildPath(revenueData, w, h);
  const spend = buildPath(spendData, w, h);

  return (
    <div className="bg-base-800 rounded-2xl border border-surface-border p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-text-secondary text-xs">Revenue vs. Orders</span>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs text-text-secondary">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-text-secondary">Orders</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-accent text-lg font-semibold">$284.5K</p>
          <p className="text-xs text-text-secondary">+24.3% MoM</p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        fill="none"
        aria-label="Revenue and orders chart"
        role="img"
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2EE9A6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#2EE9A6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={16}
            y1={16 + ((h - 32) / 4) * i}
            x2={w - 16}
            y2={16 + ((h - 32) / 4) * i}
            stroke="rgba(255,255,255,0.04)"
            strokeDasharray="4 4"
          />
        ))}
        <path d={revenue.area} fill="url(#revGrad)" />
        <path d={spend.area} fill="url(#spendGrad)" />
        <motion.path
          d={revenue.line}
          stroke="#2EE9A6"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reducedMotion ? undefined : { pathLength: 0 }}
          whileInView={reducedMotion ? undefined : { pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <motion.path
          d={spend.line}
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reducedMotion ? undefined : { pathLength: 0 }}
          whileInView={reducedMotion ? undefined : { pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
    </div>
  );
}
