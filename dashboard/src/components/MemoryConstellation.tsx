import type { CSSProperties } from "react";


const clusters = [
  { id: "profile", cx: 128, cy: 132, radius: 82, label: "PROFILE FACTS" },
  { id: "work", cx: 242, cy: 292, radius: 96, label: "PROJECT CONTEXT" },
  { id: "preferences", cx: 116, cy: 430, radius: 76, label: "PREFERENCES" },
];

const nodes = [
  { cx: 82, cy: 102, r: 3 }, { cx: 132, cy: 78, r: 2 }, { cx: 176, cy: 120, r: 3 }, { cx: 104, cy: 158, r: 4 }, { cx: 158, cy: 174, r: 2 },
  { cx: 184, cy: 252, r: 3 }, { cx: 244, cy: 224, r: 2 }, { cx: 294, cy: 270, r: 4 }, { cx: 260, cy: 334, r: 3 }, { cx: 198, cy: 348, r: 2 },
  { cx: 72, cy: 400, r: 2 }, { cx: 122, cy: 380, r: 3 }, { cx: 164, cy: 424, r: 2 }, { cx: 126, cy: 470, r: 4 }, { cx: 76, cy: 458, r: 2 },
];

const meshPaths = [
  "M82 102L132 78L176 120L158 174L104 158L82 102M104 158L176 120",
  "M184 252L244 224L294 270L260 334L198 348L184 252M184 252L260 334M244 224L198 348",
  "M72 400L122 380L164 424L126 470L76 458L72 400M122 380L126 470",
];

const signalTarget = { cx: 808, cy: 270 };
const gateway = { cx: 470, cy: 280 };
const signalPaths = [
  `M128 132C250 116 354 184 ${gateway.cx} ${gateway.cy}C590 286 700 274 ${signalTarget.cx} ${signalTarget.cy}`,
  `M242 292C326 292 388 286 ${gateway.cx} ${gateway.cy}C588 246 700 248 ${signalTarget.cx} ${signalTarget.cy}`,
  `M116 430C256 408 350 346 ${gateway.cx} ${gateway.cy}C596 212 708 238 ${signalTarget.cx} ${signalTarget.cy}`,
];

const memoryRows = [
  "candidate profile.preference",
  "candidate project.engram",
  "embedding bge-small 384d",
  "vector search cosine",
  "rank score 0.91",
  "rank score 0.84",
  "dedupe threshold 0.95",
  "context block ready",
];

type RowStyle = CSSProperties & { "--row-index": number };

export function MemoryConstellation() {
  return (
    <div aria-hidden="true" className="memory-constellation pointer-events-none absolute inset-0 overflow-hidden">
      <div className="memory-constellation__ledger" />
      <div className="memory-constellation__scan">{memoryRows.map((row, index) => <span key={row} style={{ "--row-index": index } as RowStyle}>{row}</span>)}</div>
      <svg className="memory-constellation__network" viewBox="0 0 980 560" role="presentation">
        <defs><filter id="memory-signal-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="memory-constellation__clusters">{clusters.map((cluster) => <g key={cluster.id}><circle cx={cluster.cx} cy={cluster.cy} r={cluster.radius} /><text x={cluster.cx - cluster.radius + 10} y={cluster.cy - cluster.radius + 16}>{cluster.label}</text></g>)}</g>
        <g className="memory-constellation__mesh">{meshPaths.map((path) => <path key={path} d={path} />)}</g>
        <g className="memory-constellation__nodes">{nodes.map((node) => <circle key={`${node.cx}-${node.cy}`} cx={node.cx} cy={node.cy} r={node.r} />)}</g>
        <g className="memory-constellation__gateway"><circle cx={gateway.cx} cy={gateway.cy} r="28" /><circle cx={gateway.cx} cy={gateway.cy} r="5" /><text x={gateway.cx - 24} y={gateway.cy + 48}>RANK</text></g>
        <g className="memory-constellation__core"><circle cx={signalTarget.cx} cy={signalTarget.cy} r="88" /><circle cx={signalTarget.cx} cy={signalTarget.cy} r="138" /><circle cx={signalTarget.cx} cy={signalTarget.cy} r="190" /></g>
        <g className="memory-constellation__paths">{signalPaths.map((path) => <path key={path} d={path} />)}</g>
        <g className="memory-constellation__flow">{signalPaths.map((path) => <path key={path} d={path} />)}</g>
        <g className="memory-constellation__beacons" filter="url(#memory-signal-glow)"><circle cx={signalTarget.cx} cy={signalTarget.cy} r="5" /></g>
      </svg>
      <div className="memory-constellation__labels"><span className="memory-constellation__label memory-constellation__label--one">candidate memory</span><span className="memory-constellation__label memory-constellation__label--two">ranked retrieval</span><span className="memory-constellation__label memory-constellation__label--three">injected context</span></div>
    </div>
  );
}
