import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">
          3whale
        </h1>
        <p className="text-zinc-400">
          3whale is a Shopify metrics sync + dashboard tool for tracking income,
          orders, and key store metrics.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
