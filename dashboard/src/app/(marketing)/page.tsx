import { LandingPage } from "@/components/LandingPage";


export default function MarketingPage() {
  return <LandingPage authEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim())} />;
}
