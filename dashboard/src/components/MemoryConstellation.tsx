import type { CSSProperties } from "react";

const leftNodes = [
  { cx: 74, cy: 72, r: 3 },
  { cx: 128, cy: 96, r: 2 },
  { cx: 48, cy: 142, r: 2 },
  { cx: 172, cy: 158, r: 3 },
  { cx: 252, cy: 176, r: 2 },
  { cx: 96, cy: 210, r: 4 },
  { cx: 214, cy: 238, r: 2 },
  { cx: 306, cy: 268, r: 3 },
  { cx: 52, cy: 292, r: 2 },
  { cx: 158, cy: 318, r: 3 },
  { cx: 246, cy: 342, r: 2 },
  { cx: 336, cy: 356, r: 2 },
  { cx: 112, cy: 392, r: 2 },
  { cx: 288, cy: 426, r: 3 },
  { cx: 196, cy: 468, r: 2 },
  { cx: 82, cy: 484, r: 2 },
];

const signalPaths = [
  "M74 72C220 18 390 94 524 166C638 228 732 235 900 246",
  "M128 96C288 112 362 136 512 198C652 256 720 238 900 246",
  "M172 158C280 150 448 168 574 222C684 270 770 252 900 246",
  "M96 210C270 206 400 230 548 254C682 276 760 256 900 246",
  "M158 318C306 318 432 300 568 286C704 272 800 254 900 246",
  "M112 392C282 388 412 348 552 316C704 280 776 260 900 246",
  "M196 468C324 426 440 382 572 338C710 292 800 262 900 246",
];

const memoryRows = [
  "vector_index 0.84 recall",
  "fact: project=engram",
  "retrieval.log 41a60a6d",
  "async_extract queued",
  "memory.score 0.71",
  "provider=openai",
  "pgvector cosine",
  "dedupe.threshold 0.95",
  "source conversation",
  "semantic query",
  "embedding 384d",
  "last_accessed now",
];

type RowStyle = CSSProperties & {
  "--row-index": number;
};

export function MemoryConstellation() {
  return (
    <div aria-hidden="true" className="memory-constellation pointer-events-none absolute inset-0 overflow-hidden">
      <div className="memory-constellation__ledger" />
      <div className="memory-constellation__scan">
        {memoryRows.map((row, index) => (
          <span key={row} style={{ "--row-index": index } as RowStyle}>
            {row}
          </span>
        ))}
      </div>
      <svg className="memory-constellation__network" viewBox="0 0 980 560" role="presentation">
        <defs>
          <filter id="memory-signal-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="memory-constellation__mesh">
          <path d="M74 72L128 96L48 142L96 210L172 158L252 176L214 238L306 268L246 342L336 356L288 426L196 468L82 484L112 392L52 292L158 318L96 210" />
          <path d="M128 96L172 158L96 210L52 292L158 318L246 342L288 426L336 356L306 268L214 238" />
          <path d="M48 142L172 158L306 268L158 318L112 392L196 468L246 342" />
          <path d="M74 72L252 176L336 356L196 468" />
        </g>
        <g className="memory-constellation__core">
          <circle cx="172" cy="258" r="88" />
          <circle cx="172" cy="258" r="138" />
          <circle cx="172" cy="258" r="190" />
        </g>
        <g className="memory-constellation__nodes">
          {leftNodes.map((node) => (
            <circle key={`${node.cx}-${node.cy}`} cx={node.cx} cy={node.cy} r={node.r} />
          ))}
        </g>
        <g className="memory-constellation__paths">
          {signalPaths.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
        <g className="memory-constellation__flow">
          {signalPaths.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
        <g className="memory-constellation__beacons" filter="url(#memory-signal-glow)">
          <circle cx="900" cy="246" r="5" />
        </g>
      </svg>
      <div className="memory-constellation__labels">
        <span className="memory-constellation__label memory-constellation__label--one">semantic_search</span>
        <span className="memory-constellation__label memory-constellation__label--two">async_extract</span>
        <span className="memory-constellation__label memory-constellation__label--three">memory.inject</span>
      </div>
    </div>
  );
}
