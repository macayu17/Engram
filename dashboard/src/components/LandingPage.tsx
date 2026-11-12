import Link from "next/link";

import { ArchitectureMap } from "@/components/site/ArchitectureMap";
import { AsciiScene } from "@/components/site/AsciiScene";
import { CodeBlock, InstallChip } from "@/components/site/CodeBlock";
import { NeuralBrain } from "@/components/site/NeuralBrain";
import { RankingTuner } from "@/components/site/RankingTuner";
import { ReconcileFlow } from "@/components/site/ReconcileFlow";
import { RequestTrace } from "@/components/site/RequestTrace";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { band, button, displayLg, displayXl, eyebrow, focusRing, highlight, lead, pageWrap } from "@/lib/site-styles";

const split = "grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 [&>*]:min-w-0";
const splitReverse = "grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 [&>*]:min-w-0";

const ways = [
  {
    name: "Proxy",
    text: "Point any OpenAI-compatible client at Engram. Same request body, now with memory.",
    title: "POST /v1/chat",
    accent: '"X-Engram-Key: ek_…"',
    code: `curl localhost:8000/v1/chat \\
  -H "X-Engram-Key: ek_…" \\
  -H "X-Engram-Provider: openai" \\
  -d '{"model": "gpt-4o-mini",
       "messages": […]}'`,
  },
  {
    name: "REST API",
    text: "Add, search, edit and forget memories directly. Search returns the exact block the proxy would inject.",
    title: "PATCH /memories/{id}",
    accent: "mem_8f2c",
    code: `curl -X PATCH \\
  localhost:8000/memories/mem_8f2c \\
  -H "X-Engram-Key: ek_…" \\
  -d '{"status": "approved"}'`,
  },
  {
    name: "MCP",
    text: "Seven memory tools for Claude, Codex and any MCP client, scoped to one project at a time.",
    title: "npx engramd",
    accent: "capture_conversation",
    code: `# tools
search_memories   add_memory
list_memories     update_memory
delete_memory     capture_conversation
get_retrieval_log`,
  },
];

const selfHost = `# 1. configure
cp .env.example .env

# 2. start the stack
docker compose up -d

# 3. create a user (the key is shown once)
curl -X POST localhost:8000/users \\
  -H "Content-Type: application/json" \\
  -d '{"external_id": "me"}'`;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-[15px] leading-[1.55] text-ink">
      <a href="#main-content" className={`sr-only fixed left-4 top-4 z-50 rounded-md bg-hot-fill px-4 py-2 text-sm font-medium text-on-hot focus:not-sr-only ${focusRing}`}>
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <div className={pageWrap}>
          <section className="grid items-center gap-12 pb-[72px] pt-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] [&>*]:min-w-0">
            <div>
              <span className={eyebrow}>open source · mit · self-hostable</span>
              <h1 className={displayXl}>
                Memory for <em>every</em> model.
              </h1>
              <p className={lead}>
                <b>Give stateless LLMs a memory</b> you can <span className={highlight}>read, review</span> and run on your own machine.
              </p>
              <div className="mb-5 flex flex-wrap gap-2.5">
                <Link href="/docs" className={button.hot}>
                  Start building
                </Link>
                <a href="#selfhost" className={button.line}>
                  Self-host it
                </a>
              </div>
              <InstallChip command="npx engramd" />
            </div>
            <NeuralBrain />
          </section>
        </div>

        <section id="how" className={band}>
          <div className={pageWrap}>
            <div className={split}>
              <div>
                <span className={eyebrow}>how it works</span>
                <h2 className={displayLg}>Three quiet steps around every request.</h2>
                <p className={lead}>
                  Engram sits between your app and the model. It recalls before the request, steps aside while the model answers, and learns after the reply.
                </p>
              </div>
              <AsciiScene scene="synapse" label="A request wired through memory neurons to the prompt and the model." />
            </div>
            <RequestTrace />
          </div>
        </section>

        <section id="retrieval" className={band}>
          <div className={`${pageWrap} ${splitReverse}`}>
            <AsciiScene
              scene="vectors"
              label="A query dropping into embedding space; a search radius recalls neighbouring memories with scores."
              className="order-2 lg:order-none"
            />
            <div>
              <span className={eyebrow}>retrieval</span>
              <h2 className={displayLg}>Only what matters reaches the model.</h2>
              <p className={lead}>
                Each memory is scored against the new message. Anything weak stays out, and every retrieval is logged so you can see why a fact was used.
              </p>
              <RankingTuner />
            </div>
          </div>
        </section>

        <section id="learn" className={band}>
          <div className={`${pageWrap} ${split}`}>
            <div>
              <span className={eyebrow}>learn</span>
              <h2 className={displayLg}>It remembers what lasts, and asks first.</h2>
              <p className={lead}>
                After the reply, Engram pulls durable facts out of the conversation, rewrites relative dates as absolute ones, and checks them against what it already knows.
              </p>
              <ReconcileFlow />
            </div>
            <AsciiScene scene="extract" label="Durable facts lifting out of a chat into memory cards; small talk is skipped." />
          </div>
        </section>

        <section id="ways" className={band}>
          <div className={pageWrap}>
            <span className={eyebrow}>three ways in</span>
            <h2 className={displayLg}>One memory, three ways in.</h2>
            <div className="mt-9 grid gap-5 lg:grid-cols-3">
              {ways.map((way) => (
                <div key={way.name} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-card p-[22px]">
                  <h3 className="m-0 font-display text-[21px] font-medium leading-[1.27]">{way.name}</h3>
                  <p className="m-0 text-sm text-ink-muted">{way.text}</p>
                  <CodeBlock title={way.title} code={way.code} accent={way.accent} className="mt-auto" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="selfhost" className={`${band} scroll-mt-16`}>
          <div className={`${pageWrap} ${split}`}>
            <div>
              <span className={eyebrow}>self-host</span>
              <h2 className={displayLg}>Yours to run.</h2>
              <p className={lead}>Four services in one Docker Compose file. Bring your own provider key; Engram encrypts it and never falls back to one of its own.</p>
            </div>
            <CodeBlock code={selfHost} accent='"me"' />
          </div>
          <div className={pageWrap}>
            <ArchitectureMap />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
