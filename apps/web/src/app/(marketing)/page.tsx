import { Navbar } from "@/components/landing/layout/Navbar";
import { Footer } from "@/components/landing/layout/Footer";
import { Hero } from "@/components/landing/sections/Hero";
import { SocialProof } from "@/components/landing/sections/SocialProof";
import { MetricsGrid } from "@/components/landing/sections/MetricsGrid";
import { FeatureSections } from "@/components/landing/sections/FeatureSections";
import { Integrations } from "@/components/landing/sections/Integrations";
import { BottomCTA } from "@/components/landing/sections/BottomCTA";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-900">
      <div className="noise-overlay" aria-hidden />
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <MetricsGrid />
        <FeatureSections />
        <Integrations />
        <BottomCTA />
      </main>
      <Footer />
    </div>
  );
}
