import { CodeBlock } from "@/components/site/CodeBlock";
import { DocsNav, type DocsNavGroup } from "@/components/site/DocsNav";
import { eyebrow, pageWrap } from "@/lib/site-styles";

export const metadata = {
  title: "Docs · Engram",
  description: "Install Engram, connect clients, and see how retrieval and extraction work.",
};

const groups: DocsNavGroup[] = [
  { title: "Start", items: [{ id: "quick-start", label: "Quick start" }, { id: "dashboard-login", label: "Dashboard login" }] },
  {
    title: "Use",
    items: [
      { id: "proxy", label: "Proxy" },
      { id: "memories-api", label: "Memories API" },
      { id: "mcp", label: "MCP server" },
      { id: "auto-capture", label: "Auto capture" },
      { id: "namespaces", label: "Projects & orgs" },
    ],
  },
  { title: "How it works", items: [{ id: "retrieval", label: "Retrieval" }, { id: "extraction", label: "Extraction" }] },
  {
    title: "Run",
    items: [
      { id: "deploy", label: "Deploy" },
      { id: "supabase", label: "Supabase" },
      { id: "limits", label: "Limits" },
      { id: "troubleshooting", label: "Troubleshooting" },
    ],
  },
];

const heading = "mb-3 mt-14 scroll-mt-[90px] font-display text-[32px] font-normal leading-[1.1] tracking-[-0.015em] text-ink";
const subheading = "mb-2 mt-7 font-display text-lg font-medium text-ink";
const prose = "text-ink-muted [&_b]:font-medium [&_b]:text-ink";
const codeBlock = "my-3.5";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-sm bg-tint px-[5px] py-px font-mono text-[13px] text-ink">{children}</code>;
}

function Table({ head, rows, numeric = [] }: { head?: string[]; rows: React.ReactNode[][]; numeric?: number[] }) {
  const cell = "border-b border-line py-[9px] pr-3 text-left align-top";
  return (
    <div className="my-3.5 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {head && (
          <thead>
            <tr>
              {head.map((title, index) => (
                <th key={title} className={`${cell} font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted ${numeric.includes(index) ? "text-right" : ""}`}>
                  {title}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, index) => (
                <td key={index} className={`${cell} ${numeric.includes(index) ? "text-right font-mono tabular-nums" : "text-ink-muted [&_code]:whitespace-nowrap"}`}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const quickStart: { title: React.ReactNode; detail?: React.ReactNode; file?: string; code: string; accent?: string }[] = [
  { title: "Copy the environment file.", code: "cp .env.example .env" },
  {
    title: "Set a database password and an extraction provider.",
    detail: (
      <>
        {" "}Leave <Code>ENGRAM_SERVICE_KEY</Code> and the Clerk keys empty for a self-hosted start.
      </>
    ),
    file: ".env",
    code: "POSTGRES_PASSWORD=replace_with_a_strong_password\nEXTRACTION_PROVIDER=openai\nOPENAI_API_KEY=your_key_here",
    accent: "replace_with_a_strong_password",
  },
  { title: "Start the stack.", code: "docker compose up -d" },
  {
    title: "Create a user.",
    detail: (
      <>
        {" "}Save the returned <Code>api_key</Code>. It is shown once; Engram stores only a hash.
      </>
    ),
    code: `curl -X POST http://localhost:8000/users \\
  -H "Content-Type: application/json" \\
  -d '{"external_id": "test_user_1"}'`,
  },
  {
    title: "Send the first conversation through the proxy.",
    code: `curl -X POST http://localhost:8000/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Engram-Key: <api_key>" \\
  -H "X-Engram-User-ID: test_user_1" \\
  -H "X-Engram-Provider: openai" \\
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user",
       "content": "I prefer FastAPI for backend development."}]}'`,
    accent: "<api_key>",
  },
  {
    title: "Review what it learned.",
    detail: " After a few seconds, new memories wait in the pending queue.",
    code: `curl 'http://localhost:8000/memories?status=pending' \\
  -H "X-Engram-Key: <api_key>"`,
    accent: "<api_key>",
  },
  {
    title: "Approve a memory",
    detail: " before expecting the proxy to retrieve it.",
    code: `curl -X PATCH http://localhost:8000/memories/<memory_id> \\
  -H "Content-Type: application/json" \\
  -H "X-Engram-Key: <api_key>" \\
  -d '{"status": "approved"}'`,
    accent: "<memory_id>",
  },
];

export default function DocsPage() {
  return (
    <div className={`${pageWrap} grid gap-10 pb-24 pt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14`}>
      <DocsNav groups={groups} />
      <article className="min-w-0 max-w-[760px]">
        <span className={eyebrow}>docs</span>

        <h2 id="quick-start" className={`${heading} !mt-3.5`}>
          Quick start
        </h2>
        <p className={prose}>Run the whole stack locally with Docker, create a user, and send a first conversation through the proxy.</p>
        <ol className="m-0 grid list-none gap-[22px] p-0">
          {quickStart.map((step, index) => (
            <li key={index} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
              <span className="h-6 w-6 rounded-full border border-ink text-center font-mono text-xs font-medium leading-[22px] text-ink">{index + 1}</span>
              <div className={`min-w-0 ${prose}`}>
                <b>{step.title}</b>
                {step.detail}
                <CodeBlock title={step.file} code={step.code} accent={step.accent} className="mt-3" />
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-line bg-card px-4 py-3.5 text-sm text-ink-muted">
          <i className="font-mono text-[11px] font-medium not-italic text-hot-ink">note</i>
          <span>
            Memories you create by hand are approved by default. Extraction proposes changes to existing memories as revisions; accept one to replace the fact, and earlier versions stay available to restore.
          </span>
        </div>

        <h2 id="dashboard-login" className={heading}>
          Dashboard login
        </h2>
        <p className={prose}>
          The dashboard uses Clerk for sign-in. Set the same <Code>ENGRAM_SERVICE_KEY</Code> on the <b>api</b> and <b>dashboard</b> services; the dashboard uses it server-side to issue an Engram key for the signed-in user without exposing it to the browser.
        </p>
        <CodeBlock
          title=".env"
          className={codeBlock}
          accent="generate_a_long_random_value"
          code={"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...\nCLERK_SECRET_KEY=sk_test_...\nENGRAM_SERVICE_KEY=generate_a_long_random_value"}
        />
        <p className={prose}>
          Without Clerk, paste an <Code>ek_…</Code> key in <b>Settings</b>. The browser keeps it in local storage, and every dashboard page uses it.
        </p>

        <h2 id="proxy" className={heading}>
          Proxy
        </h2>
        <p className={prose}>
          Send chat requests to <Code>POST /v1/chat</Code>, or the OpenAI-compatible <Code>POST /v1/chat/completions</Code>, with your Engram key and a provider header. Engram retrieves, injects, forwards, and returns the provider&apos;s response immediately; extraction happens afterwards.
        </p>
        <Table
          head={["Header", "Purpose"]}
          rows={[
            [<Code key="k">X-Engram-Key</Code>, <>Your workspace API key (<Code>ek_…</Code>)</>],
            [<Code key="u">X-Engram-User-ID</Code>, "Whose memories to use"],
            [<Code key="p">X-Engram-Provider</Code>, <><Code>openai</Code>, <Code>anthropic</Code>, <Code>gemini</Code> or <Code>ollama</Code></>],
            [<Code key="n">X-Engram-Namespace</Code>, <>The project to read and write; defaults to <Code>default</Code></>],
          ]}
        />
        <p className={prose}>
          Set <Code>stream: true</Code> for server-sent events. Tokens flow as they arrive, and extraction starts once the stream closes.
        </p>
        <CodeBlock
          className={codeBlock}
          accent='"stream":true'
          code={`curl -N -X POST http://localhost:8000/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Engram-Key: ek_your_key_here" \\
  -H "X-Engram-User-ID: test_user_1" \\
  -H "X-Engram-Provider: openai" \\
  -d '{"model":"gpt-4o-mini","stream":true,
       "messages":[{"role":"user","content":"What stack should I use?"}]}'`}
        />

        <h2 id="memories-api" className={heading}>
          Memories API
        </h2>
        <Table
          head={["Route", "Does"]}
          rows={[
            [<Code key="1">GET /memories?status=pending</Code>, "List memories waiting for review"],
            [<Code key="2">POST /memories/search</Code>, <>Search; the response includes <Code>context</Code>, the exact block the proxy would inject</>],
            [<Code key="3">PATCH /memories/{"{id}"}</Code>, "Edit or approve a memory"],
            [<Code key="4">GET /memories/{"{id}"}/history</Code>, "Every revision of a fact"],
            [<Code key="5">GET /memories/{"{id}"}/source</Code>, "The conversation it came from"],
            [<Code key="6">DELETE /memories/{"{id}"}</Code>, "Forget it; saved retrieval text is redacted"],
            [<Code key="7">GET /memories/export</Code>, "Export everything"],
            [<Code key="8">GET /logs/{"{id}"}</Code>, "One retrieval: the query, the memories, their scores"],
          ]}
        />

        <h2 id="mcp" className={heading}>
          MCP server
        </h2>
        <p className={prose}>
          The <Code>engramd</Code> package on npm runs an MCP server with seven tools, scoped to one project at a time. It speaks stdio by default; <Code>--transport http</Code> serves Streamable HTTP at <Code>POST /mcp</Code> on port 3000.
        </p>
        <CodeBlock
          title="claude_desktop_config.json"
          className={codeBlock}
          accent="ek_your_key_here"
          code={`{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engramd"],
      "env": { "ENGRAM_API_KEY": "ek_your_key_here" }
    }
  }
}`}
        />
        <CodeBlock title="Claude Code" className={codeBlock} code="claude mcp add engram -e ENGRAM_API_KEY=ek_your_key_here -- npx -y engramd" />
        <p className={prose}>
          Set <Code>ENGRAM_API_URL</Code> to point at your own API, and <Code>ENGRAM_NAMESPACE</Code> to pick a project.
        </p>
        <Table
          rows={[
            [<Code key="a">search_memories</Code>, <Code key="b">add_memory</Code>, <Code key="c">list_memories</Code>],
            [<Code key="d">update_memory</Code>, <Code key="e">delete_memory</Code>, <Code key="f">capture_conversation</Code>],
            [<Code key="g">get_retrieval_log</Code>, "", ""],
          ]}
        />

        <h2 id="auto-capture" className={heading}>
          Auto capture
        </h2>
        <p className={prose}>
          <Code>capture_conversation</Code> lets an assistant store memories without you saying &quot;remember this&quot;. It sends the latest user message and reply, and Engram extracts only durable facts: preferences, projects, skills and corrections. Greetings, one-off questions and the assistant&apos;s own claims are skipped. Add an instruction like this to your client:
        </p>
        <CodeBlock
          title="system prompt"
          className={codeBlock}
          code={`Before answering when user context may matter, search Engram for relevant memories.
After each meaningful exchange, call capture_conversation with the user message,
assistant response, source client name, and session id.`}
        />

        <h2 id="namespaces" className={heading}>
          Projects & orgs
        </h2>
        <p className={prose}>
          <b>Namespaces</b> split one user&apos;s memories into projects. Pass <Code>X-Engram-Namespace</Code> on proxy requests and <Code>?namespace=</Code> on REST calls; the default is <Code>default</Code>. <b>Organizations</b> group users with owner, admin and member roles; memories tagged with an <Code>org_id</Code> are visible to every member.
        </p>
        <CodeBlock
          className={codeBlock}
          accent='"Acme"'
          code={`# create an org (you become the owner)
curl -X POST http://localhost:8000/orgs \\
  -H "X-Engram-Key: ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Acme"}'

# add a member by external_id
curl -X POST http://localhost:8000/orgs/<org_id>/members \\
  -H "X-Engram-Key: ek_..." \\
  -H "Content-Type: application/json" \\
  -d '{"external_id":"teammate_42","role":"member"}'`}
        />

        <h2 id="retrieval" className={heading}>
          Retrieval
        </h2>
        <p className={prose}>
          Engram builds a query from up to six recent user messages, embeds it with <Code>BAAI/bge-small-en-v1.5</Code>, and scores approved memories in the user&apos;s workspace and namespace in one SQL query.
        </p>
        <Table
          head={["Setting", "Default", "Effect"]}
          numeric={[1]}
          rows={[
            [<Code key="1">RETRIEVAL_KEYWORD_WEIGHT</Code>, "0.3", "Full-text rank, so exact names count"],
            [<Code key="2">RETRIEVAL_RECENCY_HALF_LIFE_DAYS</Code>, "30", "Light boost for recent facts"],
            [<Code key="3">RETRIEVAL_THRESHOLD</Code>, "0.3", "Skip weaker memories unless pinned"],
            [<Code key="4">RETRIEVAL_RELATIVE_CUTOFF</Code>, "0.08", "Inject only near the top score"],
          ]}
        />
        <p className={prose}>
          Run <Code>python -m api.eval.retrieval_eval</Code> before changing a weight. On the golden set it scores <b>recall@5 0.969</b> and <b>precision 0.745</b>, injecting 1.8 memories per query.
        </p>

        <h2 id="extraction" className={heading}>
          Extraction
        </h2>
        <p className={prose}>
          Extraction runs as a Postgres-backed job with bounded retries. When a new fact lands near an existing memory (cosine above <Code>RECONCILE_THRESHOLD</Code>, default 0.6), one extra model call decides: add it, propose an update, flag a conflict, or discard it as redundant. Updates and conflicts need approval. Disable with <Code>ENABLE_RECONCILIATION=false</Code>.
        </p>

        <h2 id="deploy" className={heading}>
          Deploy
        </h2>
        <h3 className={subheading}>API</h3>
        <p className={prose}>
          Run the FastAPI image on any container host. Set <Code>DATABASE_URL</Code>, <Code>CORS_ORIGINS</Code>, <Code>ENGRAM_SERVICE_KEY</Code> and <Code>ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY</Code>. Hosted users save their own provider key per workspace.
        </p>
        <h3 className={subheading}>Database</h3>
        <p className={prose}>
          PostgreSQL with the <Code>vector</Code> extension. Local Docker Postgres and Supabase both work; the schema applies on API startup.
        </p>
        <h3 className={subheading}>Dashboard</h3>
        <p className={prose}>
          Deploy <Code>dashboard/</Code> to Vercel with <Code>NEXT_PUBLIC_API_URL</Code> pointing at the API, and add its origin to the API&apos;s <Code>CORS_ORIGINS</Code>.
        </p>

        <h2 id="supabase" className={heading}>
          Supabase
        </h2>
        <p className={prose}>
          Enable the <Code>vector</Code> extension, put the connection string in <Code>DATABASE_URL</Code>, and apply the schema. Prefer the Session pooler; with the Transaction pooler on port 6543, set <Code>DATABASE_STATEMENT_CACHE_SIZE=0</Code>.
        </p>
        <CodeBlock className={codeBlock} code="docker compose -f docker-compose.supabase.yml run --rm api python -m api.apply_schema" />

        <h2 id="limits" className={heading}>
          Limits
        </h2>
        <p className={prose}>
          Hosted workspaces have fixed limits; requests over one return <Code>429</Code> with <Code>X-Engram-Quota-*</Code> headers. Self-hosters can raise them freely.
        </p>
        <Table
          head={["Setting", "Default"]}
          numeric={[1]}
          rows={[
            [<Code key="1">WORKSPACE_MEMBER_LIMIT</Code>, "5"],
            [<Code key="2">WORKSPACE_MEMORY_LIMIT</Code>, "2,000"],
            [<Code key="3">WORKSPACE_MONTHLY_RETRIEVAL_LIMIT</Code>, "10,000"],
          ]}
        />

        <h2 id="troubleshooting" className={heading}>
          Troubleshooting
        </h2>
        <Table
          head={["Symptom", "Check"]}
          rows={[
            ["The dashboard says the key is invalid", <>The browser saved the same <Code>ek_…</Code> key as your client, and the API&apos;s <Code>CORS_ORIGINS</Code> includes the dashboard origin.</>],
            ["The MCP server shows no tools", <>Restart the client and check that <Code>ENGRAM_API_KEY</Code> is set in its MCP config.</>],
            ["No memories appear", <>New facts wait as pending. Approve them on the review screen, or add one by hand.</>],
            ["The proxy fails provider requests", <>Check the provider key in Settings and that <Code>X-Engram-Provider</Code> matches it.</>],
            ["Streaming hangs behind a reverse proxy", <>Disable response buffering. Engram already sends <Code>X-Accel-Buffering: no</Code> for nginx.</>],
          ]}
        />
      </article>
    </div>
  );
}
