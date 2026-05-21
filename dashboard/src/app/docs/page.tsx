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
  ["Proxy", "POST /v1/chat"],
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
              Engram runs as a FastAPI service backed by PostgreSQL and pgvector. The dashboard stores one Engram API key in the browser, while provider keys stay on the server.
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
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard title="Settings">
            Save an Engram API key, generate a new key, and verify the current user before inspecting data.
          </DocCard>
          <DocCard title="Memories">
            Search, add, edit, delete, and inspect durable user memories with confidence and access metadata.
          </DocCard>
          <DocCard title="Logs">
            Review retrieval events to see which memories were injected for a query and why they matched.
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
              Use this when you control the app or can set a custom OpenAI-compatible base URL.
            </p>
          </div>
          <DocsCodeBlock>{`curl -X POST http://localhost:8000/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Engram-Key: ek_your_key_here" \\
  -H "X-Engram-User-ID: test_user_1" \\
  -H "X-Engram-Provider: openai" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"What stack should I use?"}]}'`}</DocsCodeBlock>
        </div>
      </DocsSection>

      <DocsSection id="rest" eyebrow="06" title="REST surface">
        <div className="overflow-hidden border-y border-line">
          {endpoints.map(([name, routes]) => (
            <div key={name} className="grid gap-3 border-b border-line py-4 last:border-b-0 md:grid-cols-[12rem_1fr]">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{name}</p>
              <p className="font-mono text-sm leading-6 text-ink">{routes}</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="deploy" eyebrow="07" title="Deployment checklist">
        <div className="grid gap-4 md:grid-cols-2">
          <DocCard title="API">
            Deploy the FastAPI service on a container host and set database, provider, CORS, and service-key environment variables.
          </DocCard>
          <DocCard title="Database">
            Use PostgreSQL with pgvector enabled. Local Docker Postgres and Supabase Postgres are both supported.
          </DocCard>
          <DocCard title="Dashboard">
            Deploy the Next.js dashboard with root directory set to <InlineCode>dashboard</InlineCode> and <InlineCode>NEXT_PUBLIC_API_URL</InlineCode> pointing at the API.
          </DocCard>
          <DocCard title="MCP">
            Run MCP locally for desktop clients, or expose SSE from a reachable host for clients that support remote MCP.
          </DocCard>
        </div>
      </DocsSection>

      <DocsSection id="troubleshooting" eyebrow="08" title="Troubleshooting">
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
            Check provider keys in server environment variables and verify <InlineCode>X-Engram-Provider</InlineCode> matches the configured provider.
          </Trouble>
        </div>
      </DocsSection>

      <div className="border-y border-line py-8">
        <p className="font-serif text-xl leading-8 text-ink">
          Start with <Link href="/settings" className="text-signal hover:text-ink">Settings</Link> to save a key, then inspect the <Link href="/" className="text-signal hover:text-ink">memory ledger</Link> as clients begin writing context.
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
