"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  currentLocale: string;
  children: React.ReactNode;
};

export function AppShell({ currentLocale, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar currentLocale={currentLocale} onMenuClick={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
