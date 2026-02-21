import { HeroSection } from "@/components/landing/hero-section"
import { StatsBar } from "@/components/landing/stats-bar"
import { HowItWorks } from "@/components/landing/how-it-works"
import { FeaturesSection } from "@/components/landing/features-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { PartnershipSection, FinalCTA, Footer } from "@/components/landing/cta-and-footer"
import { CrisisBanner } from "@/components/crisis-banner"

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <StatsBar />
      <HowItWorks />
      <FeaturesSection />
      <TestimonialsSection />
      <PartnershipSection />
      <FinalCTA />
      <Footer />
      <CrisisBanner />
    </main>
  )
}
