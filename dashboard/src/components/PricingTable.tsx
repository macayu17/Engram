import Link from "next/link";


const plans = [
  { name: "Free", price: "$0", detail: "For prototypes and personal agents", memories: "2,000 memories", retrievals: "10,000 retrievals / month", members: "1 member" },
  { name: "Pro", price: "$29", detail: "Per workspace / month", memories: "50,000 memories", retrievals: "250,000 retrievals / month", members: "5 members" },
];

export function PricingTable({ authEnabled = false }: { authEnabled?: boolean }) {
  return (
    <div className="grid border border-line md:grid-cols-2 md:divide-x md:divide-line">
      {plans.map((plan) => <section key={plan.name} className={plan.name === "Pro" ? "border-t-2 border-t-signal bg-panel p-6 sm:p-8 md:border-t-2" : "bg-panel p-6 sm:p-8"}>
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted">{plan.detail}</p></div><p className="text-3xl font-semibold">{plan.price}</p></div>
        <ul className="mt-7 space-y-3 text-sm text-ink"><li>{plan.memories}</li><li>{plan.retrievals}</li><li>{plan.members}</li><li>Bring your own model provider key</li><li>REST API, proxy, MCP, and dashboard</li></ul>
        <Link href={authEnabled ? "/sign-up" : "/docs"} className={plan.name === "Pro" ? "mt-8 inline-flex rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-white hover:bg-signal/90" : "mt-8 inline-flex rounded-md border border-line px-4 py-2.5 text-sm font-semibold hover:border-signal"}>{plan.name === "Pro" ? "Start with Pro" : "Start free"}</Link>
      </section>)}
    </div>
  );
}
