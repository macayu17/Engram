import type { Metadata } from "next";
import Link from "next/link";

import { PricingTable } from "@/components/PricingTable";


export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="max-w-3xl"><p className="text-sm font-semibold text-signal">Pricing</p><h1 className="mt-3 text-4xl font-semibold">Usage limits you can reason about.</h1><p className="mt-5 text-lg leading-8 text-muted">Engram charges for the hosted memory workspace. You provide the model credential, so provider usage stays visible on your own account.</p></header>
      <div className="mt-12"><PricingTable authEnabled={authEnabled} /></div>
      <div className="mt-12 grid gap-8 border-y border-line py-8 md:grid-cols-2"><section><h2 className="font-semibold">Usage and upgrades</h2><p className="mt-2 text-sm leading-6 text-muted">Memory limits count stored rows. Retrieval limits reset at the start of each calendar month. Upgrade before the limit to continue writes without deleting data.</p></section><section><h2 className="font-semibold">Cancellation and self-hosting</h2><p className="mt-2 text-sm leading-6 text-muted">A canceled Pro subscription remains Pro through its paid period, then returns to Free limits. Existing data is not deleted. You can also <Link href="/docs" className="text-signal hover:underline">self-host Engram</Link>.</p></section></div>
      <p className="mt-8 text-sm text-muted">Need more than the published Pro limits? Self-hosting is the supported path at launch; no enterprise plan or annual discount is currently offered.</p>
    </div>
  );
}
