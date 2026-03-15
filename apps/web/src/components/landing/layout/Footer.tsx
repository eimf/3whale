"use client";

import Link from "next/link";
import { BarChart3, Github, Twitter, Linkedin } from "lucide-react";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#solutions" },
      { label: "Integrations", href: "#integrations" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-surface-border bg-base-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-text-primary mb-4"
            >
              <BarChart3 className="w-5 h-5 text-accent" />
              <span className="text-base font-bold">3whale</span>
            </Link>
            <p className="text-text-muted text-sm leading-relaxed mb-6">
              Shopify metrics sync and dashboard for income, orders, and store
              metrics.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, label: "Twitter" },
                { icon: Github, label: "GitHub" },
                { icon: Linkedin, label: "LinkedIn" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-base-700/50 flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent-muted transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {footerLinks.map((col) => (
            <div key={col.title}>
              <h4 className="text-text-primary text-sm font-semibold mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-text-muted text-sm hover:text-text-secondary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs">
            &copy; {new Date().getFullYear()} 3whale. All rights reserved.
          </p>
          <p className="text-text-muted text-xs">
            Built for Shopify stores that want clarity on their numbers.
          </p>
        </div>
      </div>
    </footer>
  );
}
