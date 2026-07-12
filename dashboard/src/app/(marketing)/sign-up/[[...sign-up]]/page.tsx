import { SignUp } from "@clerk/nextjs";
import Link from "next/link";


export default function SignUpPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-lg items-center justify-center px-4 py-16">
      {authEnabled ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /> : <p className="text-center text-sm leading-6 text-muted">Hosted accounts are not configured for this local instance. <Link href="/docs" className="text-signal hover:underline">Use the self-hosted setup guide.</Link></p>}
    </section>
  );
}
