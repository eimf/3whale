"use client";

import { type ReactNode } from "react";

interface MarqueeLogoRowProps {
  children: ReactNode;
  reverse?: boolean;
  speed?: "slow" | "normal" | "fast";
}

const speedMap = {
  slow: "60s",
  normal: "40s",
  fast: "25s",
};

export function MarqueeLogoRow({
  children,
  reverse = false,
  speed = "normal",
}: MarqueeLogoRowProps) {
  return (
    <div className="overflow-hidden relative group" aria-hidden>
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-base-900 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-base-900 to-transparent z-10 pointer-events-none" />
      <div
        className={`flex gap-12 items-center ${reverse ? "animate-marquee-reverse" : "animate-marquee"} group-hover:[animation-play-state:paused]`}
        style={{
          animationDuration: speedMap[speed],
          width: "max-content",
        }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
