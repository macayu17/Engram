const edgeClass = "fill-none stroke-ink opacity-50 [stroke-width:1.4]";
const boxRect = "fill-card stroke-line [stroke-width:1.2]";
const title = "fill-ink font-display text-[15px] font-medium";
const detail = "fill-ink-muted font-mono text-[11px]";

const clients = [
  { y: 44, name: "your app", note: "any OpenAI-style client" },
  { y: 139, name: "Claude · Codex", note: "via mcp · engramd :3000" },
  { y: 234, name: "you, reviewing", note: "dashboard · Next.js :3001" },
];

const providers = [
  { x: 760, width: 72, name: "openai" },
  { x: 838, width: 86, name: "anthropic" },
  { x: 930, width: 68, name: "gemini" },
  { x: 1004, width: 70, name: "ollama" },
];

const packets = [
  { path: "arch-app", duration: "2.6s", begin: "0s", hot: false },
  { path: "arch-mcp", duration: "3.4s", begin: "0.8s", hot: false },
  { path: "arch-dashboard", duration: "3.8s", begin: "1.6s", hot: false },
  { path: "arch-postgres", duration: "1.8s", begin: "0.4s", hot: true },
  { path: "arch-provider", duration: "2.2s", begin: "1.1s", hot: false },
];

export function ArchitectureMap() {
  return (
    <div className="mt-12 overflow-x-auto">
      <svg
        viewBox="0 0 1100 330"
        role="img"
        aria-label="Architecture: your app, the dashboard and MCP clients talk to the Engram API on port 8000, which stores memories in Postgres with pgvector on port 5432 and forwards chats to OpenAI, Anthropic, Gemini or Ollama."
        className="block h-auto w-full min-w-[760px]"
      >
        <path id="arch-app" className={edgeClass} d="M190 70 H420" />
        <path id="arch-mcp" className={edgeClass} d="M190 165 H300 V140 H420" />
        <path id="arch-dashboard" className={edgeClass} d="M190 260 H300 V190 H420" />
        <path id="arch-postgres" className={edgeClass} d="M640 150 H760" />
        <path id="arch-provider" className={`${edgeClass} [stroke-dasharray:4_4]`} d="M640 110 C700 110 700 40 760 40" />
        {clients.map((client) => (
          <g key={client.name}>
            <rect x="20" y={client.y} width="170" height="52" rx="6" className={boxRect} />
            <text x="36" y={client.y + 22} className={title}>
              {client.name}
            </text>
            <text x="36" y={client.y + 40} className={detail}>
              {client.note}
            </text>
          </g>
        ))}
        <g>
          <rect x="420" y="34" width="220" height="252" rx="10" className="fill-scene" />
          <text x="440" y="64" className="fill-scene-ink font-display text-[15px] font-medium">
            api · FastAPI
          </text>
          <text x="440" y="82" className="fill-scene-ink font-mono text-[11px] opacity-80">
            :8000
          </text>
          {[
            [130, "proxy  /v1/chat"],
            [152, "REST   /memories"],
            [174, "logs   /logs"],
            [222, "embeddings run here"],
          ].map(([y, label]) => (
            <text key={label} x="440" y={y} className="whitespace-pre fill-scene-ink font-mono text-[11px] opacity-80">
              {label}
            </text>
          ))}
          <text x="440" y="240" className="fill-scene-hot font-display text-[13px] font-medium">
            bge-small-en-v1.5
          </text>
          <text x="440" y="262" className="fill-scene-ink font-mono text-[11px] opacity-80">
            local · 384-d
          </text>
        </g>
        <rect x="760" y="124" width="200" height="56" rx="6" className={boxRect} />
        <text x="776" y="146" className={title}>
          postgres 16
        </text>
        <text x="776" y="166" className={detail}>
          + pgvector · :5432
        </text>
        <text x="760" y="22" className={detail}>
          your provider key, encrypted
        </text>
        {providers.map((provider) => (
          <g key={provider.name}>
            <rect x={provider.x} y="30" width={provider.width} height="22" rx="11" className="fill-none stroke-ink [stroke-width:1.2]" />
            <text x={provider.x + provider.width / 2} y="45" textAnchor="middle" className="fill-ink font-mono text-[11px]">
              {provider.name}
            </text>
          </g>
        ))}
        <text x="760" y="230" className={detail}>
          one docker compose file · MIT
        </text>
        {packets.map((packet) => (
          <circle key={packet.path} r="4" className={`motion-reduce:hidden ${packet.hot ? "fill-hot" : "fill-ink"}`}>
            <animateMotion dur={packet.duration} begin={packet.begin} repeatCount="indefinite">
              <mpath href={`#${packet.path}`} />
            </animateMotion>
          </circle>
        ))}
      </svg>
    </div>
  );
}
