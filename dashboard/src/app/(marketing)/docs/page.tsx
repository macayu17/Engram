import Link from "next/link";

import { DocsCodeBlock } from "@/components/DocsCodeBlock";

export const metadata = {
  title: "Engram Docs",
  description: "Documentation for installing, connecting, and operating Engram memory.",
};

const quickLinks = [
  { href: "#quick-start", label: "Quick start" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#mcp", label: "MCP clients" },
  { href: "#auto-capture", label: "Auto capture" },
  { href: "#proxy", label: "Proxy API" },
  { href: "#retrieval", label: "Retrieval modes" },
  { href: "#graph", label: "Graph memory" },
  { href: "#namespaces", label: "Namespaces & orgs" },
  { href: "#rest", label: "REST API" },
  { href: "#deploy", label: "Deploy" },
  { href: "#troubleshooting", label: "Troubleshooting" },
];

const memoryRules = [
  "Durable facts about the user",
  "Preferences, projects, skills, and corrections",
  "Long-lived context useful across future sessions",
  "No greetings, throwaway questions, or assistant-only claims",
];

const endpoints = [
  ["Users", "POST /users, GET /users/me, PATCH /users/me/config"],
  ["Memories", "GET /memories, POST /memories, PATCH /memories/{id}, DELETE /memories/{id}"],
  ["Search", "POST /memories/search"],
  ["Capture", "POST /memories/capture"],
  ["Logs", "GET /logs, GET /logs/{id}"],
  ["Proxy", "POST /v1/chat (supports stream: true)"],
  ["Graph", "GET /graph/entities, GET /graph/edges, GET /graph/memories/{id}/neighbors, POST /graph/extract"],
  ["Orgs", "POST /orgs, GET /orgs, POST /orgs/{id}/members, DELETE /orgs/{id}/members/{ext_id}"],
];

export default function DocsPage() {
  return (
    <section className="min-w-0 space-y-16">
      <div className="border-b border-line pb-10">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ IV — Operator manual</p>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
          <div>
            <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl md:text-7xl">
              Documentation
            </h1>
            <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-muted">
              Set up Engram, connect LLM clients, inspect memory behavior, and choose between proxy-based automatic memory and MCP-based tool memory.
            </p>
          </div>
          <div className="border-y border-line py-5">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Read path</p>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {quickLinks.map((link) => (
                <a key={link.href} href={link.href} className="border-b border-line pb-1 hover:border-signal hover:text-signal">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DocsSection id="quick-start" eyebrow="01" title="Quick start">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 font-serif text-base leading-7 text-muted">
            <p>
              Engram runs as a FastAPI service backed by PostgreSQL and pgvector. The dashboard stores one Engram API key in the browser, while workspace provider keys are encrypted by the API.
            </p>
            <p>
              Use the same <InlineCode>ek_...</InlineCode> key across Claude Desktop, VS Code Agent Mode, Cursor-style clients, and the dashboard when you want one shared memory store.
            </p>
          </div>
          <DocsCodeBlock>{`cp .env.example .env
docker compose up -d
curl -X POST http://localhost:8000/users \\
  -H "Content-Type: application/json" \\
  -d '{"external_id":"test_user_1"}'`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="dashboard" eyebrow="02" title="Dashboard workflow">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DocCard title="Home">
            Land on the overview: total memories, pending reviews, entity count, recent activity timeline, top connected entities, and latest retrievals.
          </DocCard>
          <DocCard title="Memories">
            The full ledger at <InlineCode>/memories</InlineCode>. Search, add, edit, approve pending extractions, merge duplicates, export, import, and decay confidence.
          </DocCard>
          <DocCard title="Graph">
            <InlineCode>/graph</InlineCode> renders entities extracted from memories as a force-directed graph. Hover to highlight neighborhoods, click for memory lists, filter by type.
          </DocCard>
          <DocCard title="Chat">
            <InlineCode>/chat</InlineCode> talks to your configured provider through the proxy. Memories are injected automatically, new ones extracted in the background.
          </DocCard>
          <DocCard title="Logs">
            Every retrieval event: which memories were surfaced, their scores, and the conversation that caused it.
          </DocCard>
          <DocCard title="Settings">
            Engram API key, provider config, encrypted provider keys, retrieval thresholds, retrieval mode (vector / hybrid / graph), and dedup tuning.
          </DocCard>
        </div>
      </DocsSection>

      <DocsSection id="mcp" eyebrow="03" title="Connect MCP clients">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4 font-serif text-base leading-7 text-muted">
            <p>
              MCP clients use Engram over stdio. Claude Desktop, VS Code Agent Mode, Cursor, Windsurf, and similar clients can load the same tool server and write to the same memory account.
            </p>
            <p>
              Build the MCP package once, then point the client at <InlineCode>mcp/dist/index.js</InlineCode> with <InlineCode>--transport stdio</InlineCode>.
            </p>
          </div>
          <DocsCodeBlock>{`{
  "servers": {
    "engram": {
      "type": "stdio",
      "command": "C:\\\\nvm4w\\\\nodejs\\\\node.exe",
      "args": [
        "F:\\\\Engram\\\\mcp\\\\dist\\\\index.js",
        "--transport",
        "stdio"
      ],
      "env": {
        "ENGRAM_API_URL": "http://localhost:8000",
        "ENGRAM_API_KEY": "ek_your_key_here"
      }
    }
  }
}`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="auto-capture" eyebrow="04" title="Automatic memory capture">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-serif text-base leading-7 text-muted">
              The MCP tool <InlineCode>capture_conversation</InlineCode> lets clients store memories without the user typing "store this". The assistant sends the latest user message and assistant response, then Engram extracts only durable facts.
            </p>
            <div className="mt-6 border-y border-line py-5">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Memory rules</p>
              <ul className="mt-4 grid gap-3 font-serif text-base text-muted">
                {memoryRules.map((rule) => (
                  <li key={rule} className="border-l border-line pl-4">{rule}</li>
                ))}
              </ul>
            </div>
          </div>
          <DocsCodeBlock wrap>{`Always use Engram memory. Before answering when user context may matter, search Engram for relevant memories. After each meaningful exchange, call capture_conversation with the user message, assistant response, source client name, and session id. Store durable user facts, preferences, project context, and corrections. Do not store greetings, one-off questions, temporary details, or assistant-only claims.`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="proxy" eyebrow="05" title="Proxy mode">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 font-serif text-base leading-7 text-muted">
            <p>
              Proxy mode is the fully automatic path. Your app sends OpenAI-style chat requests to Engram, Engram injects relevant memory, forwards the request, returns the provider response, and extracts new facts in the background.
            </p>
            <p>
              Set <InlineCode>stream: true</InlineCode> in the body for SSE streaming — tokens flow to the client as they arrive and extraction fires once the stream closes.
            </p>
            <p>
              Add <InlineCode>X-Engram-Namespace</InlineCode> to scope retrieval and storage to a sub-store (e.g. <InlineCode>work</InlineCode> vs <InlineCode>personal</InlineCode>). Defaults to <InlineCode>default</InlineCode>.
            </p>
          </div>
          <DocsCodeBlock>{`curl -N -X POST http://localhost:8000/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Engram-Key: ek_your_key_here" \\
  -H "X-Engram-User-ID: test_user_1" \\
  -H "X-Engram-Provider: openai" \\
  -H "X-Engram-Namespace: work" \\
  -d '{"model":"gpt-4o-mini","stream":true,
       "messages":[{"role":"user","content":"What stack should I use?"}]}'`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="retrieval" eyebrow="06" title="Retrieval modes">
        <div className="space-y-4 font-serif text-base leading-7 text-muted">
          <p>
            Each user can pick the retrieval strategy used when memories get injected into the system prompt. Set it via <InlineCode>PATCH /users/me/config</InlineCode> with a <InlineCode>retrieval_mode</InlineCode> field, or from the Settings page.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard title="vector (default)">
            Pure pgvector cosine similarity over the 384-dim embeddings. Fast, single SQL round trip. Best when queries paraphrase memory content.
          </DocCard>
          <DocCard title="hybrid">
            Runs vector and Postgres full-text (<InlineCode>tsvector</InlineCode>) searches in parallel, then merges with Reciprocal Rank Fusion (k=60). Better recall when queries name specific terms the embedding may not weight highly.
          </DocCard>
          <DocCard title="graph">
            Vector seed plus 1-hop expansion through the entity graph (memories sharing entities with the seed are pulled in). Requires <InlineCode>ENABLE_GRAPH=true</InlineCode> and a backfilled entity set.
          </DocCard>
        </div>
        <div className="border-y border-line py-5">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Reranker (optional)</p>
          <p className="mt-3 font-serif text-base leading-7 text-muted">
            Set <InlineCode>ENABLE_RERANKER=true</InlineCode> on the API to load a cross-encoder (<InlineCode>cross-encoder/ms-marco-MiniLM-L-6-v2</InlineCode>) at startup. When loaded, all retrieval modes re-rank their candidate set before returning. Adds ~400 MB to API memory and a small per-query CPU cost.
          </p>
        </div>
      </DocsSection>

      <DocsSection id="graph" eyebrow="07" title="Graph memory">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 font-serif text-base leading-7 text-muted">
            <p>
              Engram extracts named entities (people, projects, skills, technologies, preferences, topics, organizations) from each memory and stores them as a graph in Postgres — no Neo4j required.
            </p>
            <p>
              Set <InlineCode>ENABLE_GRAPH=true</InlineCode> on the API. New memories trigger entity extraction asynchronously (uses your configured extraction provider). Call <InlineCode>POST /graph/extract</InlineCode> to backfill entities on memories that pre-dated the flag.
            </p>
            <p>
              The dashboard <InlineCode>/graph</InlineCode> page renders this as a force-directed graph (Obsidian-style): dots sized by mention count, edges between entities that co-occur in memories, hover to highlight 1-hop neighborhood, click for memory list.
            </p>
          </div>
          <DocsCodeBlock>{`# 1. Enable on the API
ENABLE_GRAPH=true

# 2. Backfill entities for existing memories
curl -X POST http://localhost:8000/graph/extract \\
  -H "X-Engram-Key: ek_..."

# 3. List entities with mention counts
curl http://localhost:8000/graph/entities \\
  -H "X-Engram-Key: ek_..."

# 4. Co-occurrence edges (entities sharing memories)
curl http://localhost:8000/graph/edges \\
  -H "X-Engram-Key: ek_..."

# 5. Switch retrieval to graph mode
curl -X PATCH http://localhost:8000/users/me/config \\
  -H "X-Engram-Key: ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"retrieval_mode":"graph"}'`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="namespaces" eyebrow="08" title="Namespaces & organizations">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4 font-serif text-base leading-7 text-muted">
            <p>
              <strong className="text-ink">Namespaces</strong> partition a single user's memories. Pass <InlineCode>X-Engram-Namespace: &lt;name&gt;</InlineCode> on proxy requests; pass <InlineCode>?namespace=&lt;name&gt;</InlineCode> when listing memories. Default is <InlineCode>default</InlineCode>. Useful for separating work/personal contexts under one Engram key.
            </p>
            <p>
              <strong className="text-ink">Organizations</strong> group users with role-based access (owner / admin / member). Memories tagged with <InlineCode>org_id</InlineCode> are visible to all org members.
            </p>
          </div>
          <DocsCodeBlock>{`# Create an org (you become owner)
curl -X POST http://localhost:8000/orgs \\
  -H "X-Engram-Key: ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Acme"}'

# Add a member by external_id
curl -X POST http://localhost:8000/orgs/<org_id>/members \\
  -H "X-Engram-Key: ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"external_id":"teammate_42","role":"member"}'

# List the orgs you belong to
curl http://localhost:8000/orgs \\
  -H "X-Engram-Key: ek_..."`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="rest" eyebrow="09" title="REST surface">
        <div className="overflow-hidden border-y border-line">
          {endpoints.map(([name, routes]) => (
            <div key={name} className="grid gap-3 border-b border-line py-4 last:border-b-0 md:grid-cols-[12rem_1fr]">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{name}</p>
              <p className="font-mono text-sm leading-6 text-ink">{routes}</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="deploy" eyebrow="10" title="Deployment checklist">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="API">
            Deploy the FastAPI service on a container host (Azure Container Apps, Fly.io, Render, Railway). Set <InlineCode>DATABASE_URL</InlineCode>, <InlineCode>CORS_ORIGINS</InlineCode>, <InlineCode>ENGRAM_SERVICE_KEY</InlineCode>, and <InlineCode>ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY</InlineCode>. Hosted users save their own provider key per workspace.
          </DocCard>
          <DocCard title="Database">
            PostgreSQL with the <InlineCode>vector</InlineCode> extension enabled. Local Docker Postgres and Supabase Postgres both supported. Schema migrates on API startup.
          </DocCard>
          <DocCard title="Dashboard">
            Vercel with Root Directory <InlineCode>dashboard</InlineCode> and <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> pointing at the API. Add the Vercel origin to API <InlineCode>CORS_ORIGINS</InlineCode>.
          </DocCard>
          <DocCard title="MCP">
            Run MCP locally for desktop clients, or expose SSE from a reachable host for clients that support remote MCP.
          </DocCard>
          <DocCard title="Feature flags">
            Optional API env vars: <InlineCode>ENABLE_GRAPH=true</InlineCode> for entity extraction + graph retrieval, <InlineCode>ENABLE_RERANKER=true</InlineCode> for the cross-encoder reranker (adds ~400 MB memory).
          </DocCard>
          <DocCard title="GHCR image">
            Pushing to <InlineCode>main</InlineCode> auto-builds <InlineCode>ghcr.io/&lt;owner&gt;/engram-api:latest</InlineCode>. Container Apps caches by tag — create a new revision (or pin to <InlineCode>:&lt;sha&gt;</InlineCode>) to pull a fresh image.
          </DocCard>
        </div>
      </DocsSection>

      <DocsSection id="troubleshooting" eyebrow="11" title="Troubleshooting">
        <div className="grid gap-4 md:grid-cols-2">
          <Trouble title="Dashboard says invalid key">
            Confirm the browser saved the same <InlineCode>ek_...</InlineCode> key as your MCP client and that API CORS includes the dashboard origin.
          </Trouble>
          <Trouble title="MCP server does not show tools">
            Run <InlineCode>npm --prefix mcp run build</InlineCode>, restart the client, and check that the command path points to Node and the built index file.
          </Trouble>
          <Trouble title="No memories appear">
            Add one manually, call <InlineCode>capture_conversation</InlineCode>, or route a chat through <InlineCode>/v1/chat</InlineCode>. Empty memory stores are valid for new keys.
          </Trouble>
          <Trouble title="Proxy fails provider requests">
            Check the workspace provider key in Settings and verify <InlineCode>X-Engram-Provider</InlineCode> matches the configured provider.
          </Trouble>
          <Trouble title="Graph page shows Not Found">
            The deployed API doesn't have the <InlineCode>/graph/*</InlineCode> routes yet. Update the container to the latest image and create a new revision so it actually pulls.
          </Trouble>
          <Trouble title="Backfill returns 0 entity links">
            Either <InlineCode>ENABLE_GRAPH</InlineCode> isn't set on the API, your extraction provider key is missing, or there are no approved memories yet. Check API logs during the call.
          </Trouble>
          <Trouble title="Streaming requests hang">
            Behind a reverse proxy, ensure SSE buffering is disabled. The proxy already sends <InlineCode>X-Accel-Buffering: no</InlineCode> for nginx; for Cloudflare enable streaming on the route.
          </Trouble>
          <Trouble title="Hybrid retrieval returns empty">
            Verify the <InlineCode>memories.content_tsv</InlineCode> column exists (auto-generated by the schema). Run <InlineCode>apply_schema</InlineCode> against the database if you upgraded from an older version.
          </Trouble>
        </div>
      </DocsSection>

      <div className="border-y border-line py-8">
        <p className="font-serif text-xl leading-8 text-ink">
          Start with <Link href="/settings" className="text-signal hover:text-ink">Settings</Link> to save a key. Land on the <Link href="/" className="text-signal hover:text-ink">home dashboard</Link> for system state, dive into the <Link href="/memories" className="text-signal hover:text-ink">memory ledger</Link> to browse entries, or open the <Link href="/graph" className="text-signal hover:text-ink">entity graph</Link> to see how they connect.
        </p>
      </div>
    </section>
  );
}

function DocsSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="border-b border-line pb-4">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ {eyebrow}</p>
        <h2 className="mt-2 font-serif text-4xl font-semibold leading-tight text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DocCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-y border-line py-5">
      <h3 className="font-serif text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-3 font-serif text-base leading-7 text-muted">{children}</p>
    </div>
  );
}

function Trouble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l border-line pl-5">
      <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-signal">{title}</h3>
      <p className="mt-3 font-serif text-base leading-7 text-muted">{children}</p>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-tag px-1.5 py-0.5 font-mono text-[0.8em] text-ink">{children}</code>;
}
