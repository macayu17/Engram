const leftNodes = [
  { cx: 74, cy: 72, r: 3 },
  { cx: 128, cy: 96, r: 2 },
  { cx: 48, cy: 142, r: 2 },
  { cx: 172, cy: 158, r: 3 },
  { cx: 96, cy: 210, r: 4 },
  { cx: 214, cy: 238, r: 2 },
  { cx: 52, cy: 292, r: 2 },
  { cx: 158, cy: 318, r: 3 },
  { cx: 246, cy: 342, r: 2 },
  { cx: 112, cy: 392, r: 2 },
  { cx: 288, cy: 426, r: 3 },
  { cx: 196, cy: 468, r: 2 },
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
          <path d="M74 72L128 96L48 142L96 210L172 158L214 238L158 318L52 292L112 392L196 468L288 426L246 342L158 318L96 210" />
          <path d="M128 96L172 158L96 210L52 292L158 318L246 342L288 426" />
          <path d="M48 142L172 158L246 342L112 392" />
        </g>
        <g className="memory-constellation__nodes">
          {leftNodes.map((node) => (
            <circle key={`${node.cx}-${node.cy}`} cx={node.cx} cy={node.cy} r={node.r} />
          ))}
        </g>
        <g className="memory-constellation__paths">
          <path d="M284 268C432 210 526 184 628 214C730 244 760 154 902 168" />
          <path d="M236 420C364 354 472 356 572 392C688 434 740 338 894 316" />
          <path d="M312 126C470 98 548 126 620 168C710 220 754 250 910 248" />
        </g>
        <g className="memory-constellation__flow">
          <path d="M284 268C432 210 526 184 628 214C730 244 760 154 902 168" />
          <path d="M236 420C364 354 472 356 572 392C688 434 740 338 894 316" />
          <path d="M312 126C470 98 548 126 620 168C710 220 754 250 910 248" />
        </g>
        <g className="memory-constellation__beacons" filter="url(#memory-signal-glow)">
          <circle cx="902" cy="168" r="5" />
          <circle cx="894" cy="316" r="4" />
          <circle cx="620" cy="168" r="3" />
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
import type { CSSProperties } from "react";
