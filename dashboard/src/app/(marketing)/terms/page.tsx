import type { Metadata } from "next";


export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  const sections = [
    ["Account responsibility", "You are responsible for account access, workspace API keys, provider credentials, and activity performed through your workspace."],
    ["Acceptable use", "Do not use Engram to violate law, infringe rights, compromise systems, distribute malware, or store data you are not authorized to process."],
    ["Hosted subscriptions", "Pro subscriptions renew monthly until canceled. Cancellation takes effect at the end of the current paid period. Usage above the active plan limit may block new writes without deleting existing data."],
    ["Provider charges", "Model-provider usage is billed by the provider associated with your credential. Engram pricing does not include model credits."],
    ["Self-hosted software", "Self-hosted use is governed by the license included in the Engram source repository. You are responsible for deployment, security, backups, and legal compliance in your environment."],
    ["Availability", "The hosted service may change, experience interruptions, or require maintenance. No uptime commitment or service-level agreement is offered at launch."],
    ["Contact", "Questions about these terms can be opened through the Engram GitHub repository until a dedicated legal contact is published."],
  ];
  return <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24"><p className="text-sm font-semibold text-signal">Legal</p><h1 className="mt-3 text-4xl font-semibold">Terms</h1><p className="mt-5 text-lg leading-8 text-muted">These draft terms describe responsibility for hosted and self-hosted Engram use.</p><p className="mt-6 border border-caution/40 bg-caution/5 px-4 py-3 text-sm text-caution">Draft for product review. Qualified counsel must review this document before production payments are accepted.</p><div className="mt-10 divide-y divide-line border-y border-line">{sections.map(([heading, body]) => <section key={heading} className="py-6"><h2 className="text-lg font-semibold">{heading}</h2><p className="mt-2 text-sm leading-7 text-muted">{body}</p></section>)}</div></article>;
}
