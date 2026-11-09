import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { CopyCommand, DocsCodeBlock } from "@/components/DocsCodeBlock";
import { EngramLogo } from "@/components/EngramLogo";
import { MemoryField } from "@/components/MemoryField";
import { ThemeToggle } from "@/components/ThemeToggle";

const github = "https://github.com/macayu17/Engram";

const steps = [
  { name: "Recall", text: "The latest message is embedded locally and matched against approved memories in Postgres. Weak matches stay out." },
  { name: "Answer", text: "The few facts that matter go quietly at the top of the system prompt, and the request continues to your provider." },
  { name: "Learn", text: "After the reply, durable facts are drawn from the exchange in the background and wait for your approval." },
];

const recalled = [
  { text: "Prefers FastAPI for Python backends", score: "0.91", width: "w-[91%]" },
  { text: "Building a market simulator called Sentinel", score: "0.84", width: "w-[84%]" },
  { text: "Likes concise answers without filler", score: "0.72", width: "w-[72%]" },
  { text: "Asked about the weather once", score: "0.41", width: "w-[41%]", rejected: true },
];

const interfaces = [
  { name: "Proxy", text: "Point any OpenAI-compatible client at Engram. Same request body, now with memory.", tech: "POST /v1/chat/completions" },
  { name: "REST API", text: "Add, search, edit and forget memories directly. Every retrieval is logged and explainable.", tech: "POST /memories/search" },
  { name: "MCP", text: "Seven memory tools for Claude, Codex and any MCP client, scoped to one project at a time.", tech: "search_memories · capture_conversation" },
];

const specification = [
  ["Runtime", "Docker Compose"],
  ["Storage", "PostgreSQL + pgvector"],
  ["Embeddings", "Local · bge-small-en-v1.5"],
  ["Providers", "OpenAI · Anthropic · Gemini · Ollama"],
  ["Review", "Pending inbox · revisions · history"],
  ["License", "MIT"],
];

const quickstart = `cp .env.example .env
docker compose up -d

curl -X POST localhost:8000/users \\
  -H "Content-Type: application/json" \\
  -d '{"external_id": "me"}'`;

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const sectionTitle = "font-mono text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight tracking-[-0.04em]";
const cell = "border-line px-5 py-10 sm:px-10 [&:not(:first-child)]:border-t md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-t-0";

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#main-content" className="sr-only bg-signal px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">
        Skip to content
      </a>

      <div className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5 text-[13px] sm:px-8">
          <p className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
            Engram is open source and MIT licensed
          </p>
          <a href={github} className={`hidden items-center gap-1 text-muted transition-colors hover:text-ink sm:inline-flex ${focusRing}`}>
            View on GitHub <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </div>

      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className={focusRing}>
            <EngramLogo />
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#how" className={`hidden px-3 py-2 text-muted transition-colors hover:text-ink md:inline-flex ${focusRing}`}>
              How it works
            </a>
            <Link href="/docs" className={`hidden px-3 py-2 text-muted transition-colors hover:text-ink sm:inline-flex ${focusRing}`}>
              Docs
            </Link>
            <ThemeToggle />
            <Link href="/overview" className={`ml-1 bg-signal px-4 py-2 press font-medium text-paper hover:opacity-90 ${focusRing}`}>
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl items-stretch border-x border-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="px-5 py-20 sm:px-10 lg:py-28">
              <h1 className="settle font-mono text-[clamp(2.4rem,5.2vw,4rem)] leading-[1.05] tracking-[-0.045em]">
                Memory for
                <br />
                every model.
              </h1>
              <p className="settle mt-7 max-w-lg text-[clamp(1.15rem,1.6vw,1.4rem)] leading-snug [animation-delay:70ms]">
                Give stateless LLMs a memory <span className="text-muted">you can read, review and run on your own machine.</span>
              </p>
              <div className="settle mt-10 flex flex-wrap gap-3 [animation-delay:140ms]">
                <Link href="/overview" className={`bg-signal px-5 py-3 press font-medium text-paper hover:opacity-90 ${focusRing}`}>
                  Start building
                </Link>
                <a href="#start" className={`bg-ink px-5 py-3 press font-medium text-paper hover:opacity-90 ${focusRing}`}>
                  Self-host it
                </a>
              </div>
              <div className="settle mt-5 [animation-delay:210ms]">
                <CopyCommand command="npx engramd" />
              </div>
            </div>
            <div className="relative h-[22rem] border-t border-line lg:h-auto lg:min-h-[34rem] lg:border-l lg:border-t-0">
              <MemoryField className="settle absolute inset-0 h-full w-full [animation-delay:120ms] [animation-duration:1600ms]" />
              <p className="absolute bottom-4 left-5 flex items-center gap-2 font-mono text-xs text-muted">
                <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
                recalled for this message
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-4 border-b border-line">
          <div className="mx-auto max-w-6xl border-x border-line">
            <div className="px-5 py-16 sm:px-10">
              <h2 className={sectionTitle}>Three quiet steps around every request.</h2>
            </div>
            <ol className="grid border-t border-line md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.name} className={cell}>
                  <p className="font-mono text-xs text-muted">0{index + 1}</p>
                  <h3 className="mt-6 text-xl">{step.name}</h3>
                  <p className="mt-3 leading-7 text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl border-x border-line lg:grid-cols-2">
            <div className="px-5 py-16 sm:px-10 lg:py-24">
              <h2 className={sectionTitle}>Only what matters reaches the model.</h2>
              <p className="mt-6 max-w-md leading-8 text-muted">
                Each memory is scored against the new message. Anything below the threshold is left out, and every retrieval is logged so you can see exactly why a fact was used.
              </p>
            </div>
            <figure className="border-t border-line px-5 py-12 sm:px-10 lg:border-l lg:border-t-0 lg:py-24">
              <figcaption className="font-mono text-xs text-muted">query</figcaption>
              <p className="mt-2 text-lg">What backend should I use for this project?</p>
              <ul className="mt-8 space-y-5">
                {recalled.map((memory) => (
                  <li key={memory.text} className={memory.rejected ? "opacity-50" : undefined}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.95rem] leading-6">{memory.text}</span>
                      <span className="shrink-0 font-mono text-xs text-muted">{memory.rejected ? "below 0.50" : memory.score}</span>
                    </div>
                    <div className="mt-2 h-[3px] bg-tag">
                      <div className={`h-full ${memory.width} ${memory.rejected ? "bg-muted" : "bg-signal"}`} />
                    </div>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl border-x border-line">
            <div className="px-5 py-16 sm:px-10">
              <h2 className={sectionTitle}>One memory, three ways in.</h2>
            </div>
            <ul className="border-t border-line">
              {interfaces.map((item) => (
                <li
                  key={item.name}
                  className="grid gap-3 border-b border-line px-5 py-8 transition-colors last:border-b-0 hover:bg-panel/60 sm:px-10 md:grid-cols-[10rem_minmax(0,1fr)_16rem] md:items-baseline md:gap-10"
                >
                  <h3 className="font-mono text-lg tracking-[-0.03em]">{item.name}</h3>
                  <p className="max-w-xl leading-7 text-muted">{item.text}</p>
                  <p className="font-mono text-xs text-signal md:text-right">{item.tech}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="start" className="scroll-mt-4 border-b border-line">
          <div className="mx-auto grid max-w-6xl border-x border-line lg:grid-cols-2">
            <div className="px-5 py-16 sm:px-10 lg:py-24">
              <h2 className={sectionTitle}>Yours to run.</h2>
              <dl className="mt-10 border-t border-line">
                {specification.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-6 border-b border-line py-3 text-sm">
                    <dt className="font-mono text-muted">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="border-t border-line px-5 py-16 sm:px-10 lg:border-l lg:border-t-0 lg:py-24">
              <DocsCodeBlock>{quickstart}</DocsCodeBlock>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <Link href="/docs" className={`inline-flex items-center gap-1 text-signal hover:underline hover:underline-offset-4 ${focusRing}`}>
                  Read the docs <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
                <a href={github} className={`inline-flex items-center gap-1 text-signal hover:underline hover:underline-offset-4 ${focusRing}`}>
                  View the source <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto max-w-6xl border-x border-line px-5 pb-10 pt-24 sm:px-10">
          <p className="text-center font-mono text-sm tracking-[0.3em] text-muted">models forget · engram remembers</p>
          <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
            <EngramLogo />
            <p>MIT licensed · © 2026 Ayush</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
