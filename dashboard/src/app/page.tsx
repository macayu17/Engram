import { LandingPage } from "@/components/LandingPage";

export default function HomePage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return <LandingPage authEnabled={authEnabled} />;
}
