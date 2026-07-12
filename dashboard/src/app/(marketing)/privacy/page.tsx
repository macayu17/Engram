import type { Metadata } from "next";


export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <PolicyPage title="Privacy" intro="This notice describes the data Engram stores to provide hosted memory workspaces." sections={[
    ["Account and workspace data", "We store account identifiers, workspace membership, API-key hashes, plan state, and billing customer or subscription identifiers. Payment-card details are handled by Stripe and are not stored by Engram."],
    ["Memory and retrieval data", "We store memory content, embeddings, conversation capture records, retrieval queries, returned memory identifiers, similarity scores, namespaces, and operational timestamps for your workspace."],
    ["Provider credentials", "Provider API keys are encrypted before storage. Hosted Engram uses the credential selected by your workspace and does not supply hidden model credits or a server-funded fallback."],
    ["Operational data", "We process service logs, error details, request identifiers, and basic client metadata needed to operate, secure, and troubleshoot the service."],
    ["Deletion", "Workspace tools can delete individual memories, all memories, API keys, and the user account. Subscription and payment records may be retained where required for financial, fraud-prevention, or legal obligations."],
    ["Contact", "Questions and deletion requests can be opened through the Engram GitHub repository until a dedicated privacy contact is published."],
  ]} />;
}

function PolicyPage({ title, intro, sections }: { title: string; intro: string; sections: string[][] }) {
  return <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24"><p className="text-sm font-semibold text-signal">Legal</p><h1 className="mt-3 text-4xl font-semibold">{title}</h1><p className="mt-5 text-lg leading-8 text-muted">{intro}</p><p className="mt-6 border border-caution/40 bg-caution/5 px-4 py-3 text-sm text-caution">Draft for product review. Qualified counsel must review this document before production payments are accepted.</p><div className="mt-10 divide-y divide-line border-y border-line">{sections.map(([heading, body]) => <section key={heading} className="py-6"><h2 className="text-lg font-semibold">{heading}</h2><p className="mt-2 text-sm leading-7 text-muted">{body}</p></section>)}</div></article>;
}
