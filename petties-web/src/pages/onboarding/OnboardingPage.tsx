import {
  NavigationBar,
  HeroSection,
  ProblemStatement,
  FeaturesSection,
  HowItWorksSection,
  TargetUsersSection,
  CTAFooter,
  ExplorePreviewSection
} from '../../components/onboarding'
import '../../styles/brutalist.css'

export const OnboardingPage = () => {
  return (
    <div className="min-h-screen overflow-x-hidden w-full max-w-full">
      <NavigationBar />
      <main className="w-full">
        <HeroSection />
        <ExplorePreviewSection />
        <ProblemStatement />
        <FeaturesSection />
        <HowItWorksSection />
        <TargetUsersSection />
      </main>
      <CTAFooter />
    </div>
  )
}

export default OnboardingPage
