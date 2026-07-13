"use client";

import { ArrowRight, Check, Copy, Github } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EngramLogo } from "@/components/EngramLogo";
import { LandingMotion } from "@/components/LandingMotion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";

const memoryRows = [
  ["0.91", "Prefers FastAPI over Flask for backends", "high", "landing-delay-0"],
  ["0.84", "Building SENTINEL, a market simulator", "high", "landing-delay-1"],
  ["0.71", "Wants concise answers, no filler", "caution", "landing-delay-2"],
] as const;

const loopSteps = [
  ["01", "Embed the message", "The latest user message is embedded locally with BAAI/bge-small-en-v1.5: 384 dimensions on CPU, with no embedding API cost."],
  ["02", "Search & rank", "pgvector cosine search is reranked by recency and access count. The threshold still rejects weak matches."],
  ["03", "Inject into the prompt", "Top matches are folded into the system prompt as a clean memory-context block before the user message."],
  ["04", "Forward & return", "The enriched request goes to your provider. The response streams straight back through the compatible endpoint."],
  ["05", "Extract new facts", "After the reply, an asynchronous job pulls durable user facts from the exchange without blocking the response."],
  ["06", "Reconcile & store", "New facts are compared with existing memories, then added, updated, discarded, and stored as embeddings."],
];

const interfaces = [
  {
    label: "Drop-in proxy",
    title: "Proxy endpoint",
    body: "Swap one base URL. Engram enriches the prompt going out and learns from the reply coming back.",
    code: ["# same body as OpenAI", "POST /v1/chat/completions", "Authorization: Bearer ek_..."],
  },
  {
    label: "Full control",
    title: "REST API",
    body: "Create, search, edit, and delete memories directly. Every retrieval is logged for inspection.",
    code: ["POST /memories/search", "GET  /logs", "PATCH /memories/{id}"],
  },
  {
    label: "Agent-native",
    title: "MCP server",
    body: "Give compatible assistants six focused memory tools through the Model Context Protocol.",
    code: ["search_memories", "capture_conversation", "get_retrieval_log"],
  },
];

const comparisonRows = [
  ["Self-hostable", "Yes", "Partial", "Yes"],
  ["MCP server interface", "Yes", "No", "No"],
  ["Retrieval inspection & logs", "Yes", "No", "Partial"],
  ["Local embeddings", "Yes", "No", "No"],
  ["Fully open source", "Yes", "Partial", "Yes"],
];

const problemCopy = "Ship anything on top of a raw LLM API and it forgets the user the moment the request ends. Every team then rebuilds the same three bad options:";

const quickstart = `# 1 · configure
cp .env.example .env

# 2 · start postgres + api + mcp + dashboard
docker compose up -d

# 3 · create a user (api key shown once)
curl -X POST localhost:8000/users \\
  -d '{"external_id":"me"}'

# 4 · send a chat through the proxy
curl localhost:8000/v1/chat \\
  -H "X-Engram-Key: ek_..." \\
  -d '{"model":"gpt-4o-mini", ... }'`;

export function LandingPage() {
  const [copied, setCopied] = useState(false);

  async function copyQuickstart() {
    try {
      await navigator.clipboard.writeText(quickstart);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <LandingMotion className="min-h-screen w-full max-w-full overflow-x-clip bg-paper text-ink">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-signal px-4 py-2 font-sans text-sm font-semibold text-paper focus:not-sr-only">Skip to content</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <section id="top" className="landing-grid relative scroll-mt-16 overflow-hidden border-b border-line">
          <PageContainer className="relative z-10 grid gap-14 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24 xl:py-28">
            <div className="landing-hero-copy min-w-0">
              <p data-motion="hero-support" className="inline-flex items-center gap-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_12px_rgb(var(--color-signal)_/_0.8)]" />
                Self-hostable AI memory · Open source
              </p>
              <h1 className="mt-6 max-w-[42rem] font-serif text-[clamp(3rem,6.4vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.025em]">
                <span className="block overflow-hidden"><span data-motion="hero-line" className="block">Every model</span></span>
                <span className="block overflow-hidden"><span data-motion="hero-line" className="block">forgets. Engram</span></span>
                <span className="block overflow-hidden"><span data-motion="hero-line" className="block italic text-signal">remembers.</span></span>
              </h1>
              <p data-motion="hero-support" className="mt-7 max-w-[34rem] text-pretty font-serif text-xl leading-[1.62] text-muted">
                A memory layer that sits between your app and any LLM. It retrieves the facts that matter, injects them into the prompt, forwards the call, then quietly learns new facts after every reply.
              </p>
              <div data-motion="hero-support" className="mt-8 flex flex-wrap items-center gap-4">
                <a data-magnetic href="#start" className="inline-flex min-h-[3.25rem] touch-manipulation items-center gap-3 rounded-full bg-signal px-5 font-mono text-sm font-semibold text-paper shadow-[0_18px_44px_rgb(var(--color-signal)_/_0.28)] transition hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                  <span className="opacity-70">$</span>
                  docker compose up
                </a>
                <a href="https://github.com/macayu17/Engram" target="_blank" rel="noreferrer" className="inline-flex min-h-[3.25rem] items-center gap-2 px-2 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                  <span className="border-b border-line pb-1 transition hover:border-signal hover:text-signal">Read the source</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
              <div data-motion="hero-support" className="mt-10 grid grid-cols-2 border-y border-line font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted sm:grid-cols-4">
                {['MIT licensed', 'pgvector', 'MCP-native', 'Local embeddings'].map((item) => (
                  <span key={item} className="border-b border-line px-3 py-4 first:pl-0 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0">{item}</span>
                ))}
              </div>
            </div>
            <MemoryFlowDemo />
          </PageContainer>
        </section>

        <section className="border-b border-line">
          <PageContainer className="grid gap-10 py-20 md:grid-cols-[auto_1fr] md:gap-14 md:py-24">
            <SectionLabel>§ I — The problem</SectionLabel>
            <div className="max-w-[52rem]">
              <SectionHeading>Every LLM API is <em>stateless</em> by design. Your users are not.</SectionHeading>
              <p data-motion="problem-copy" className="mt-6 text-pretty font-serif text-xl leading-[1.65] text-muted">
                {problemCopy.split(" ").map((word, index) => <span key={`${word}-${index}`} data-motion="problem-word">{word}{" "}</span>)}
              </p>
              <div className="mt-8 grid border-t border-line md:grid-cols-3">
                {[
                  ["01 / expensive", "Stuff the whole history into every prompt until it hits the context limit."],
                  ["02 / slow", "Hand-roll a memory pipeline per app: inconsistent, fragile, and never finished."],
                  ["03 / locked in", "Rent a closed service with no self-hosting, no inspection, and no control."],
                ].map(([label, body]) => (
                  <div key={label} className="border-b border-line py-6 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                    <p className="font-mono text-[11px] tracking-[0.08em] text-fault">{label}</p>
                    <p className="mt-3 font-serif text-[1.05rem] leading-6">{body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 font-serif text-[1.35rem] leading-8">Engram is the fourth option: one open primitive that makes any stateless model feel stateful.</p>
            </div>
          </PageContainer>
        </section>

        <section id="how" className="scroll-mt-16 border-b border-line bg-panel/40">
          <PageContainer className="py-20 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div><SectionLabel>§ II — The loop</SectionLabel><SectionHeading className="mt-3">Retrieve, forward, <em>learn.</em></SectionHeading></div>
              <p className="max-w-[26rem] font-serif text-lg leading-7 text-muted">The proxy runs the whole memory loop on a single request. Retrieval and extraction failures never break the response: the model always answers.</p>
            </div>
            <div data-motion="loop-grid" className="mt-11 grid grid-flow-dense gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
              {loopSteps.map(([number, title, body]) => (
                <article key={number} data-motion="loop-card" className="group bg-paper p-7 transition hover:bg-tag/25">
                  <p className="font-mono text-xs text-signal">{number}</p>
                  <h3 className="mt-4 font-serif text-2xl font-semibold">{title}</h3>
                  <p className="mt-3 font-serif text-base leading-6 text-muted">{body}</p>
                </article>
              ))}
            </div>
          </PageContainer>
        </section>

        <section id="interfaces" data-motion="interfaces-section" className="scroll-mt-16 border-b border-line">
          <PageContainer className="overflow-visible py-20 md:py-24">
            <SectionLabel>§ III — Three ways in</SectionLabel>
            <SectionHeading className="mt-3 max-w-[40rem]">One memory backend. <em>Three</em> interfaces.</SectionHeading>
            <div data-motion="interfaces-track" className="mt-11 grid gap-5 lg:flex lg:w-max">
              {interfaces.map((item) => (
                <article key={item.title} className="group flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-line bg-panel transition hover:-translate-y-1 hover:border-signal/60 lg:w-[min(72vw,48rem)] lg:shrink-0">
                  <div className="p-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
                    <h3 className="mt-3 font-serif text-[1.6rem] font-semibold">{item.title}</h3>
                    <p className="mt-3 font-serif text-base leading-6 text-muted">{item.body}</p>
                  </div>
                  <pre className="mt-auto overflow-x-auto border-t border-line bg-paper/55 p-5 font-mono text-[11px] leading-7 text-ink">{item.code.map((line, index) => <span key={line} className={cn("block", index === 0 && "text-muted", line.includes("/") && "text-signal")}>{line}</span>)}</pre>
                </article>
              ))}
            </div>
          </PageContainer>
        </section>

        <section id="start" className="scroll-mt-16 border-b border-line bg-panel/40">
          <PageContainer className="grid gap-12 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:py-24">
            <div>
              <SectionLabel>§ IV — Quickstart</SectionLabel>
              <SectionHeading className="mt-3">From zero to a stateful model in <em>minutes.</em></SectionHeading>
              <p className="mt-6 max-w-[30rem] font-serif text-lg leading-7 text-muted">Configure your provider key, start the four services, and send the same chat payload your app already uses.</p>
              <Link href="/overview" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 font-sans text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">Open dashboard <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            <div data-motion="reveal" className="overflow-hidden rounded-lg border border-line bg-paper shadow-[0_30px_70px_rgb(0_0_0_/_0.22)]">
              <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
                <StatusDots />
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">bash — engram</span>
                <button type="button" aria-live="polite" onClick={() => void copyQuickstart()} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                  {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}{copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-7 text-ink">{quickstart}</pre>
            </div>
          </PageContainer>
        </section>

        <section id="compare" className="scroll-mt-16 border-b border-line">
          <PageContainer className="py-20 md:py-24">
            <SectionLabel>§ V — Why Engram</SectionLabel>
            <SectionHeading className="mt-3 max-w-[38rem]">The open primitive closed tools <em>won&apos;t</em> give you.</SectionHeading>
            <div data-motion="reveal" className="mt-10 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead className="bg-panel font-sans text-[11px] uppercase tracking-[0.1em] text-muted">
                  <tr><th className="w-[40%] px-6 py-4">Capability</th><th className="border-l border-line px-5 py-4 text-signal">Engram</th><th className="border-l border-line px-5 py-4">Mem0</th><th className="border-l border-line px-5 py-4">Zep</th></tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, rowIndex) => (
                    <tr key={row[0]} className={cn("border-t border-line", rowIndex % 2 === 1 && "bg-panel/35")}>
                      <th className="px-6 py-5 font-serif text-[1.05rem] font-normal">{row[0]}</th>
                      {row.slice(1).map((value, index) => <td key={`${row[0]}-${index}`} className={cn("border-l border-line px-5 py-5 font-mono text-sm tabular-nums", value === "Yes" ? "text-high" : value === "Partial" ? "text-caution" : "text-muted")}>{value === "Yes" ? "✓ " : value === "Partial" ? "~ " : "× "}{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageContainer>
        </section>

        <section className="border-b border-line bg-panel/40">
          <PageContainer className="grid gap-12 py-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-24">
            <div>
              <SectionLabel>§ VI — Nothing hidden</SectionLabel>
              <SectionHeading className="mt-3">See <em>why</em> the model knew that.</SectionHeading>
              <p className="mt-6 max-w-[30rem] font-serif text-lg leading-7 text-muted">Every retrieval is logged: the query, surfaced memories, similarity scores, and the conversation that triggered them. No black box, just an inspectable ledger.</p>
              <div className="mt-7 flex flex-wrap gap-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">{['query', 'scores', 'memory ids', 'conversation'].map((tag) => <span key={tag} className="rounded-full border border-line px-3 py-2">{tag}</span>)}</div>
            </div>
            <RetrievalLogDemo />
          </PageContainer>
        </section>

        <section className="border-b border-line">
          <PageContainer className="py-20 text-center">
            <SectionLabel>§ VII — Provider-agnostic</SectionLabel>
            <SectionHeading className="mx-auto mt-4 max-w-[36rem]">Point it at <em>any</em> model. Swap keys, not code.</SectionHeading>
            <div data-motion="reveal" className="mt-9 flex flex-wrap justify-center gap-3.5">{['OpenAI', 'Anthropic', 'Gemini', 'Ollama'].map((provider) => <span key={provider} className="rounded-lg border border-line bg-panel px-7 py-4 font-serif text-xl">{provider}</span>)}<span className="inline-flex items-center rounded-lg border border-dashed border-line px-7 py-4 font-mono text-sm text-muted">+ any OpenAI-compatible</span></div>
          </PageContainer>
        </section>

        <section className="landing-cta relative overflow-hidden border-b border-line">
          <PageContainer data-motion="reveal" className="relative py-24 text-center md:py-28">
            <h2 className="mx-auto max-w-[40rem] font-serif text-[clamp(2.5rem,5vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.025em]">Self-host memory in<br /><em className="text-signal">one command.</em></h2>
            <p className="mx-auto mt-6 max-w-[30rem] font-serif text-xl leading-8 text-muted">Open source, MIT licensed, and self-hostable in a single command. No account, no vendor, no lock-in.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3.5">
              <a data-magnetic href="https://github.com/macayu17/Engram" target="_blank" rel="noreferrer" className="inline-flex min-h-[3.25rem] touch-manipulation items-center gap-2.5 rounded-full bg-signal px-6 font-sans text-xs font-bold uppercase tracking-[0.1em] text-paper shadow-[0_18px_44px_rgb(var(--color-signal)_/_0.28)] transition hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"><Github size={16} aria-hidden="true" />Star on GitHub</a>
              <a href="https://www.npmjs.com/package/engramd" target="_blank" rel="noreferrer" className="inline-flex min-h-[3.25rem] items-center gap-2.5 rounded-full border border-line px-6 font-mono text-sm text-ink transition hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"><span className="opacity-60">npm i</span> engramd</a>
            </div>
          </PageContainer>
        </section>
      </main>
      <LandingFooter />
    </LandingMotion>
  );
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-xl">
      <PageContainer className="flex min-h-16 items-center justify-between gap-4 py-3">
        <a href="#top" className="group shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"><EngramLogo /></a>
        <nav className="hidden items-center gap-7 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted lg:flex">
          <a href="#how" className="transition hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">How it works</a><a href="#interfaces" className="transition hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">Interfaces</a><a href="#compare" className="transition hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">Compare</a><a href="#start" className="transition hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">Quickstart</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <a href="https://github.com/macayu17/Engram" target="_blank" rel="noreferrer" className="hidden min-h-9 items-center gap-2 rounded-full border border-line px-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-signal hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal sm:inline-flex"><Github size={14} aria-hidden="true" />GitHub</a>
          <ThemeToggle />
        </div>
      </PageContainer>
    </header>
  );
}

function MemoryFlowDemo() {
  return (
    <div data-motion="hero-demo" className="landing-flow relative min-w-0 overflow-hidden rounded-lg border border-line bg-panel p-5 shadow-[0_40px_90px_rgb(0_0_0_/_0.28)] sm:p-6">
      <div className="landing-beam pointer-events-none absolute inset-x-0 top-0 h-[44%]" />
      <div className="relative flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-muted"><StatusDots /><span>engram · POST /v1/chat</span></div>
      <div className="relative mt-5 rounded-lg border border-line bg-paper/50 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">user_92f · incoming</p><p className="mt-1.5 font-serif text-[15px] leading-5">&quot;What backend framework should I use for this project?&quot;</p></div>
      <div className="relative mx-1 mt-5">
        <div className="absolute left-[6%] right-[6%] top-[15px] h-px bg-line" /><div className="absolute left-[6%] right-[6%] top-[11px] h-2 overflow-hidden"><span className="landing-pulse absolute h-2 w-2 rounded-full bg-signal shadow-[0_0_14px_rgb(var(--color-signal))]" /></div>
        <div className="relative flex justify-between">{['Embed', 'Search', 'Rank', 'Inject'].map((step, index) => <div key={step} className="w-[22%] text-center"><span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border bg-panel font-mono text-[11px] text-signal", index === 3 ? "border-signal bg-signal/15" : "border-line")}>{index + 1}</span><p className="mt-2 font-sans text-[9px] font-semibold uppercase tracking-[0.1em]">{step}</p></div>)}</div>
      </div>
      <div data-motion="score-group" className="relative mt-4 rounded-lg border border-line bg-paper/50 p-4"><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">[ memory context · 3 injected ]</p>{memoryRows.map(([score, text, tone, delayClass]) => <div key={text} className={cn("landing-memory-row mt-2 flex items-baseline gap-2.5 font-mono text-[11px] leading-4 first:mt-0", delayClass)}><span data-score={score} className={cn("font-semibold tabular-nums", tone === "high" ? "text-high" : "text-caution")}>{score}</span><span>{text}</span></div>)}</div>
      <p className="relative mt-4 font-mono text-[10px] tracking-[0.06em] text-muted">→ forwarded to <span className="text-signal">gpt-4o-mini</span> with context<span className="landing-cursor text-signal">▍</span></p>
    </div>
  );
}

function RetrievalLogDemo() {
  return <div data-motion="reveal" className="overflow-hidden rounded-lg border border-line bg-paper shadow-[0_30px_70px_rgb(0_0_0_/_0.22)]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4"><span className="font-serif text-lg">&quot;what backend should I use&quot;</span><span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">14:23:01 · conv_abc1</span></div><div data-motion="score-group" className="px-5 pb-5 pt-2"><p className="my-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Retrieved 3 memories</p>{memoryRows.map(([score, text, tone]) => <div key={text} className="flex items-baseline gap-3 border-t border-line py-3"><span data-score={score} className={cn("w-11 shrink-0 font-mono text-sm font-semibold tabular-nums", tone === "high" ? "text-high" : "text-caution")}>{score}</span><span className="font-mono text-xs leading-5">{text}</span></div>)}</div></div>;
}

function LandingFooter() {
  return <footer><PageContainer><div className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]"><div><a href="#top" className="group"><EngramLogo /></a><p className="mt-5 max-w-[22rem] font-serif text-base leading-6 text-muted">A self-hostable AI memory layer. Retrieve, inject, forward, extract, and store, with every step inspectable.</p></div><FooterColumn title="Product" links={[["How it works", "#how"], ["Interfaces", "#interfaces"], ["Compare", "#compare"], ["Quickstart", "#start"], ["Dashboard", "/overview"]]} /><FooterColumn title="Open source" links={[["GitHub repository", "https://github.com/macayu17/Engram"], ["npm · engramd", "https://www.npmjs.com/package/engramd"], ["engram.ayushh.in", "https://engram.ayushh.in"]]} /></div><div className="flex flex-wrap justify-between gap-3 border-t border-line py-6 font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-muted"><span>MIT License · © 2026 Ayush</span><span>Built on FastAPI · pgvector · MCP</span></div></PageContainer></footer>;
}

function FooterColumn({ title, links }: { title: string; links: string[][] }) {
  return <div><p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p><div className="grid gap-3 font-sans text-sm">{links.map(([label, href]) => <a key={label} href={href} className="text-ink transition hover:text-signal">{label}</a>)}</div></div>;
}

function PageContainer({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-6", className)} {...props}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="whitespace-nowrap font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</p>;
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("font-serif text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-[1.06] tracking-[-0.02em] [&_em]:font-normal [&_em]:text-signal", className)}>{children}</h2>;
}

function StatusDots() {
  return <span className="inline-flex items-center gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-fault/70" /><span className="h-2 w-2 rounded-full bg-caution/70" /><span className="h-2 w-2 rounded-full bg-high/70" /></span>;
}
