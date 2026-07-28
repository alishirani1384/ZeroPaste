import {
  AudiencesSection,
  DonationSection,
  DonorsSection,
  FeaturesSection,
  HeroSection,
  SiteFooter,
  SiteHeader,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <AudiencesSection />
        <DonorsSection />
        <DonationSection />
      </main>
      <SiteFooter />
    </>
  );
}
