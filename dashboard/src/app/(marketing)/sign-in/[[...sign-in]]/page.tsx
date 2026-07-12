import { SignIn } from "@clerk/nextjs";
import Link from "next/link";


export default function SignInPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <AuthPage enabled={authEnabled} mode="sign-in" />;
}

function AuthPage({ enabled, mode }: { enabled: boolean; mode: "sign-in" }) {
  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-lg items-center justify-center px-4 py-16">
      {enabled ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /> : <p className="text-center text-sm leading-6 text-muted">Hosted sign-in is not configured for this local instance. <Link href="/docs" className="text-signal hover:underline">Use the self-hosted setup guide.</Link></p>}
    </section>
  );
}
