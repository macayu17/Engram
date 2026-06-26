"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  api,
  type GraphEdge,
  type GraphEntity,
  type GraphMemoryItem,
} from "@/lib/api";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as unknown as React.ComponentType<ForceGraphProps>;

type ForceGraphProps = {
  ref?: React.RefObject<ForceGraphHandle | null>;
  graphData: { nodes: ForceNode[]; links: ForceLink[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeCanvasObject?: (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodePointerAreaPaint?: (node: ForceNode, color: string, ctx: CanvasRenderingContext2D) => void;
  linkColor?: (link: ForceLink) => string;
  linkWidth?: (link: ForceLink) => number;
  onNodeClick?: (node: ForceNode) => void;
  onNodeHover?: (node: ForceNode | null) => void;
  onBackgroundClick?: () => void;
  cooldownTicks?: number;
  d3VelocityDecay?: number;
  d3AlphaDecay?: number;
  enableNodeDrag?: boolean;
  warmupTicks?: number;
};

type ForceGraphHandle = {
  zoomToFit: (durationMs?: number, padding?: number) => void;
  centerAt: (x?: number, y?: number, durationMs?: number) => void;
  zoom: (zoom: number, durationMs?: number) => void;
};

type ForceNode = {
  id: string;
  name: string;
  entityType: string;
  memoryCount: number;
  radius: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type ForceLink = {
  source: string | ForceNode;
  target: string | ForceNode;
  weight: number;
};

const ENTITY_TYPES = [
  "person",
  "project",
  "skill",
  "technology",
  "preference",
  "topic",
  "organization",
] as const;

const TYPE_COLORS: Record<string, string> = {
  person: "#fb7185",
  project: "#a78bfa",
  skill: "#34d399",
  technology: "#60a5fa",
  preference: "#fbbf24",
  topic: "#f472b6",
  organization: "#22d3ee",
};

const BACKGROUND = "#0b0d12";

function computeRadius(memoryCount: number): number {
  return 3 + Math.sqrt(memoryCount) * 2.2;
}

export function MemoryGraph() {
  const [entities, setEntities] = useState<GraphEntity[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    | { kind: "entity"; entity: GraphEntity; memories: GraphMemoryItem[] }
    | { kind: "memory"; memory: GraphMemoryItem; neighbors: GraphMemoryItem[]; entities: GraphEntity[] }
    | null
  >(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphHandle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entityRes = await api.graph.listEntities();
      setEntities(entityRes.entities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
      setEntities([]);
      setEdges([]);
      setLoading(false);
      return;
    }
    try {
      const edgeRes = await api.graph.listEdges();
      setEdges(edgeRes.edges);
    } catch {
      setEdges([]);
      setExtractStatus("Edges endpoint unavailable — showing entities without connections. Update the API to get co-occurrence edges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!extractStatus) return;
    const t = setTimeout(() => setExtractStatus(null), 6000);
    return () => clearTimeout(t);
  }, [extractStatus]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.max(320, rect.width), height: Math.max(400, rect.height) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const filteredEntities = useMemo(
    () => entities.filter((e) => activeTypes.has(e.entity_type)),
    [entities, activeTypes],
  );

  const filteredIdSet = useMemo(() => new Set(filteredEntities.map((e) => e.id)), [filteredEntities]);

  const graphData = useMemo(() => {
    const nodes: ForceNode[] = filteredEntities.map((e) => ({
      id: e.id,
      name: e.name,
      entityType: e.entity_type,
      memoryCount: e.memory_count,
      radius: computeRadius(e.memory_count),
    }));
    const links: ForceLink[] = edges
      .filter((edge) => filteredIdSet.has(edge.source) && filteredIdSet.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target, weight: edge.weight }));
    return { nodes, links };
  }, [filteredEntities, edges, filteredIdSet]);

  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!filteredIdSet.has(edge.source) || !filteredIdSet.has(edge.target)) continue;
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }, [edges, filteredIdSet]);

  const isHighlighted = useCallback(
    (id: string): boolean => {
      if (!hoveredId) return false;
      if (hoveredId === id) return true;
      return neighborMap.get(hoveredId)?.has(id) ?? false;
    },
    [hoveredId, neighborMap],
  );

  const isLinkHighlighted = useCallback(
    (link: ForceLink): boolean => {
      if (!hoveredId) return false;
      const s = typeof link.source === "string" ? link.source : link.source.id;
      const t = typeof link.target === "string" ? link.target : link.target.id;
      return s === hoveredId || t === hoveredId;
    },
    [hoveredId],
  );

  const drawNode = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x === undefined || node.y === undefined) return;
      const baseColor = TYPE_COLORS[node.entityType] ?? "#94a3b8";
      const dimmed = hoveredId !== null && !isHighlighted(node.id);
      ctx.save();

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = dimmed ? 0.08 : 0.18;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = dimmed ? 0.35 : 1;
      ctx.fill();

      const fontSize = Math.max(10, 12 / Math.sqrt(globalScale));
      ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = dimmed ? "#475569" : "#cbd5e1";
      ctx.globalAlpha = dimmed ? 0.4 : 0.9;
      ctx.fillText(node.name, node.x, node.y + node.radius + 4);
      ctx.restore();
    },
    [hoveredId, isHighlighted],
  );

  const drawNodePointerArea = useCallback(
    (node: ForceNode, color: string, ctx: CanvasRenderingContext2D) => {
      if (node.x === undefined || node.y === undefined) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
      ctx.fill();
    },
    [],
  );

  const handleNodeClick = useCallback(
    async (node: ForceNode) => {
      const entity = entities.find((e) => e.id === node.id);
      if (!entity) return;
      try {
        const result = await api.graph.entityMemories(entity.entity_type, entity.name);
        setSelected({ kind: "entity", entity, memories: result.memories });
        if (fgRef.current && node.x !== undefined && node.y !== undefined) {
          fgRef.current.centerAt(node.x, node.y, 600);
          fgRef.current.zoom(2, 600);
        }
      } catch (err) {
        setExtractStatus(err instanceof Error ? err.message : "Failed to load memories");
      }
    },
    [entities],
  );

  const handleMemoryRowClick = useCallback(async (memory: GraphMemoryItem) => {
    try {
      const result = await api.graph.neighbors(memory.id);
      setSelected({ kind: "memory", memory, neighbors: result.neighbors, entities: result.entities });
    } catch (err) {
      setExtractStatus(err instanceof Error ? err.message : "Failed to load neighbors");
    }
  }, []);

  const handleExtract = async () => {
    setExtracting(true);
    setExtractStatus(null);
    try {
      const result = await api.graph.extract();
      setExtractStatus(`Processed ${result.processed} memories, ${result.entities_created} entity links`);
      await load();
    } catch (err) {
      setExtractStatus(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleToggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const linkColor = useCallback(
    (link: ForceLink): string => {
      if (isLinkHighlighted(link)) return "rgba(148, 163, 184, 0.75)";
      if (hoveredId) return "rgba(71, 85, 105, 0.18)";
      return "rgba(100, 116, 139, 0.35)";
    },
    [isLinkHighlighted, hoveredId],
  );

  const linkWidth = useCallback(
    (link: ForceLink): number => (isLinkHighlighted(link) ? 1.4 : 0.6),
    [isLinkHighlighted],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Entity weave</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Memory Graph</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
            Entities extracted from your memories, connected when they co-occur. Hover to highlight neighborhood, click a node for details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {extractStatus && <span className="max-w-xs font-sans text-xs text-muted">{extractStatus}</span>}
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="rounded-md border border-line bg-paper px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] hover:bg-line/40 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Backfill entities"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Filter:</span>
        {ENTITY_TYPES.map((type) => {
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleToggleType(type)}
              className="rounded-full border px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] transition"
              style={{
                background: active ? TYPE_COLORS[type] : "transparent",
                color: active ? "#0f172a" : TYPE_COLORS[type],
                borderColor: TYPE_COLORS[type],
                opacity: active ? 1 : 0.45,
              }}
              aria-pressed={active}
            >
              {type}
            </button>
          );
        })}
        <span className="ml-auto font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {filteredEntities.length} of {entities.length} entities · {graphData.links.length} edges
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div
          ref={containerRef}
          className="relative h-[70vh] flex-1 overflow-hidden rounded-lg border border-line"
          style={{ background: BACKGROUND }}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center font-serif text-base text-muted">Loading graph…</div>
          ) : error ? (
            <div className="flex h-full items-center justify-center font-serif text-base text-rose-500">{error}</div>
          ) : entities.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center font-serif text-base text-muted">
              <p>No entities yet. Click <em>Backfill entities</em> above to extract them from your existing memories.</p>
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="flex h-full items-center justify-center font-serif text-base text-muted">
              No entities match the active filters.
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={size.width}
              height={size.height}
              backgroundColor={BACKGROUND}
              nodeCanvasObject={drawNode}
              nodePointerAreaPaint={drawNodePointerArea}
              linkColor={linkColor}
              linkWidth={linkWidth}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => setHoveredId(node ? node.id : null)}
              onBackgroundClick={() => setSelected(null)}
              cooldownTicks={120}
              warmupTicks={30}
              d3VelocityDecay={0.35}
              d3AlphaDecay={0.025}
              enableNodeDrag={true}
            />
          )}
        </div>

        {selected && (
          <aside className="relative max-h-[70vh] w-full overflow-auto rounded-lg border border-line bg-paper p-5 lg:w-[22rem]">
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close details"
              className="absolute right-3 top-3 rounded-md p-1 font-sans text-xs text-muted hover:bg-line/30 hover:text-ink"
            >
              ✕
            </button>
            {selected.kind === "entity" ? (
              <>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Entity · {selected.entity.entity_type}
                </p>
                <h2 className="mt-1 pr-6 font-serif text-2xl font-semibold leading-tight text-ink">
                  {selected.entity.name}
                </h2>
                <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
                  {selected.memories.length} linked memories
                </p>
                <ul className="mt-3 space-y-3 font-serif text-base leading-7 text-ink/80">
                  {selected.memories.map((memory) => (
                    <li key={memory.id}>
                      <button
                        type="button"
                        onClick={() => handleMemoryRowClick(memory)}
                        className="block w-full border-l-2 border-line pl-3 text-left transition hover:border-signal hover:text-ink"
                      >
                        {memory.content}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Memory · {selected.memory.category}
                </p>
                <p className="mt-2 pr-6 font-serif text-base leading-7 text-ink">
                  {selected.memory.content}
                </p>
                {selected.entities.length > 0 && (
                  <>
                    <p className="mt-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      Linked entities
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.entities.map((e) => (
                        <span
                          key={e.id}
                          className="rounded-full px-2 py-0.5 font-sans text-[10px] font-medium"
                          style={{ background: TYPE_COLORS[e.entity_type] ?? "#94a3b8", color: "#0f172a" }}
                        >
                          {e.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {selected.neighbors.length > 0 && (
                  <>
                    <p className="mt-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      Neighbor memories ({selected.neighbors.length})
                    </p>
                    <ul className="mt-2 space-y-2 font-serif text-sm leading-6 text-ink/70">
                      {selected.neighbors.map((memory) => (
                        <li key={memory.id} className="border-l-2 border-line pl-3">
                          {memory.content}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
