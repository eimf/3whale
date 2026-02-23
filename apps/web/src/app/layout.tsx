import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3whale – Ingresos",
  description: "Dashboard de ingresos diarios",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();
  return (
    <html lang="es-MX" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-zinc-200`}
      >
        <nav className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="/dashboard"
              className="text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
            >
              Dashboard
            </Link>
          </div>
        </nav>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
