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
  { href: "#retrieval", label: "Retrieval" },
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
  ["Orgs", "POST /orgs, GET /orgs, POST /orgs/{id}/members, DELETE /orgs/{id}/members/{ext_id}"],
];

export default function DocsPage() {
  return (
    <section className="min-w-0 space-y-16">
      <div className="border-b border-line pb-10">
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
          <div>
            <h1 className="max-w-4xl font-mono text-4xl leading-tight tracking-[-0.045em] text-ink sm:text-5xl">
              Documentation
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">
              Set up Engram, connect LLM clients, inspect memory behavior, and choose between proxy-based automatic memory and MCP-based tool memory.
            </p>
          </div>
          <div className="border-y border-line py-5">
            <p className="font-sans text-xs font-medium text-muted">Read path</p>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 font-sans text-xs font-medium text-muted">
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
          <div className="space-y-4 text-base leading-7 text-muted">
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
            Land on the overview: total memories, pending reviews, proposed changes, recent activity and latest retrievals.
          </DocCard>
          <DocCard title="Memories">
            The full ledger at <InlineCode>/memories</InlineCode>. Search, add, edit, approve pending extractions, review proposed changes, export and import.
          </DocCard>
          <DocCard title="Chat">
            <InlineCode>/chat</InlineCode> talks to your configured provider through the proxy. Memories are injected automatically, new ones extracted in the background.
          </DocCard>
          <DocCard title="Logs">
            Every retrieval event: which memories were surfaced, their scores, and the conversation that caused it.
          </DocCard>
          <DocCard title="Settings">
            Engram API key, provider config, encrypted provider keys, retrieval thresholds and dedup tuning.
          </DocCard>
        </div>
      </DocsSection>

      <DocsSection id="mcp" eyebrow="03" title="Connect MCP clients">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4 text-base leading-7 text-muted">
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
            <p className="text-base leading-7 text-muted">
              The MCP tool <InlineCode>capture_conversation</InlineCode> lets clients store memories without the user typing "store this". The assistant sends the latest user message and assistant response, then Engram extracts only durable facts.
            </p>
            <div className="mt-6 border-y border-line py-5">
              <p className="font-sans text-xs font-medium text-muted">Memory rules</p>
              <ul className="mt-4 grid gap-3 text-base text-muted">
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
          <div className="space-y-4 text-base leading-7 text-muted">
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

      <DocsSection id="retrieval" eyebrow="06" title="How retrieval ranks memories">
        <div className="space-y-4 text-base leading-7 text-muted">
          <p>
            Every proxy call, search and MCP lookup runs the same single SQL query over your approved memories in the active project. There are no modes to pick.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard title="Meaning plus keywords">
            Each memory scores its cosine similarity to the query, plus a Postgres full-text rank so exact names, codes and terms count too. Memories below <InlineCode>retrieval_threshold</InlineCode> are skipped unless pinned.
          </DocCard>
          <DocCard title="Light recency tilt">
            Newer or recently confirmed facts get a small boost that halves every 30 days, so an updated preference outranks the one it replaced. Pinned memories get a fixed boost.
          </DocCard>
          <DocCard title="Only what is close to the best match">
            Results keep only memories within 0.08 of the top score, up to <InlineCode>max_memories_injected</InlineCode>. Unrelated facts stay out of the prompt instead of padding it.
          </DocCard>
        </div>
        <div className="border-y border-line py-5">
          <p className="font-sans text-xs font-medium text-muted">Measured, not guessed</p>
          <p className="mt-3 text-base leading-7 text-muted">
            <InlineCode>python -m api.eval.retrieval_eval</InlineCode> scores recall, rank, precision and false hits against a golden set. Run it before changing any ranking weight.
          </p>
        </div>
      </DocsSection>

      <DocsSection id="namespaces" eyebrow="07" title="Namespaces & organizations">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4 text-base leading-7 text-muted">
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

      <DocsSection id="rest" eyebrow="08" title="REST surface">
        <div className="overflow-hidden border-y border-line">
          {endpoints.map(([name, routes]) => (
            <div key={name} className="grid gap-3 border-b border-line py-4 last:border-b-0 md:grid-cols-[12rem_1fr]">
              <p className="font-sans text-xs font-medium text-muted">{name}</p>
              <p className="font-mono text-sm leading-6 text-ink">{routes}</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="deploy" eyebrow="09" title="Deployment checklist">
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
          <DocCard title="GHCR image">
            Pushing to <InlineCode>main</InlineCode> auto-builds <InlineCode>ghcr.io/&lt;owner&gt;/engram-api:latest</InlineCode>. Container Apps caches by tag — create a new revision (or pin to <InlineCode>:&lt;sha&gt;</InlineCode>) to pull a fresh image.
          </DocCard>
        </div>
      </DocsSection>

      <DocsSection id="troubleshooting" eyebrow="10" title="Troubleshooting">
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
          <Trouble title="Streaming requests hang">
            Behind a reverse proxy, ensure SSE buffering is disabled. The proxy already sends <InlineCode>X-Accel-Buffering: no</InlineCode> for nginx; for Cloudflare enable streaming on the route.
          </Trouble>
          <Trouble title="Keyword matches never count">
            Verify the <InlineCode>memories.content_tsv</InlineCode> column exists (auto-generated by the schema). Run <InlineCode>apply_schema</InlineCode> against the database if you upgraded from an older version.
          </Trouble>
        </div>
      </DocsSection>

      <div className="border-y border-line py-8">
        <p className="text-xl leading-8 text-ink">
          Start with <Link href="/settings" className="text-signal hover:text-ink">Settings</Link> to save a key. Land on the <Link href="/" className="text-signal hover:text-ink">home dashboard</Link> for system state, or dive into the <Link href="/memories" className="text-signal hover:text-ink">memory ledger</Link> to browse entries.
        </p>
      </div>
    </section>
  );
}

function DocsSection({ id, title, children }: { id: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="border-b border-line pb-4">
        <h2 className="mt-2 font-mono text-3xl leading-tight tracking-[-0.04em] text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DocCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-y border-line py-5">
      <h3 className="text-2xl font-normal text-ink">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </div>
  );
}

function Trouble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l border-line pl-5">
      <h3 className="font-sans text-xs font-medium text-signal">{title}</h3>
      <p className="mt-3 text-base leading-7 text-muted">{children}</p>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="rounded-lg bg-tag px-1.5 py-0.5 font-mono text-[0.8em] text-ink">{children}</code>;
}
