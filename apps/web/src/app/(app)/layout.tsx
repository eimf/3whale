import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <AppShell currentLocale={locale}>{children}</AppShell>;
}
