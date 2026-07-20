import {
  AudiencesSection,
  FeaturesSection,
  HeroSection,
  PricingSection,
  SiteFooter,
  SiteHeader,
  TestimonialsSection,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <AudiencesSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <SiteFooter />
    </>
  );
}
