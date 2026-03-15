"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";
import Link from "next/link";

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  href?: string;
}

const sizeClasses = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const variantClasses = {
  primary:
    "bg-accent text-base-900 font-semibold hover:shadow-glow hover:bg-accent-light active:scale-[0.97] transition-all duration-200",
  secondary:
    "bg-transparent text-text-primary font-medium border border-surface-border hover:border-accent/40 hover:text-accent hover:shadow-glow-sm active:scale-[0.97] transition-all duration-200",
};

const baseClasses =
  "rounded-xl cursor-pointer inline-flex items-center justify-center";

export function GlowButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href,
  ...props
}: GlowButtonProps) {
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
