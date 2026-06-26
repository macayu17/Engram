"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import { api, type GraphEntity, type GraphMemoryItem } from "@/lib/api";

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

type GraphState = {
  entities: GraphEntity[];
  loading: boolean;
  error: string | null;
};

type SelectedDetail =
  | { kind: "entity"; entity: GraphEntity; memories: GraphMemoryItem[] }
  | { kind: "memory"; memory: GraphMemoryItem; neighbors: GraphMemoryItem[]; entities: GraphEntity[] };

function entityNodeId(entity: GraphEntity): string {
  return `entity:${entity.entity_type}:${entity.name}`;
}

function memoryNodeId(memoryId: string): string {
  return `memory:${memoryId}`;
}

function layoutEntities(entities: GraphEntity[]): Node[] {
  const count = entities.length || 1;
  if (count <= 12) {
    const radius = Math.max(240, count * 42);
    return entities.map((entity, index) => {
      const angle = (index / count) * Math.PI * 2;
      return makeEntityNode(entity, Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  }
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const spacingX = 230;
  const spacingY = 120;
  return entities.map((entity, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = (col - (cols - 1) / 2) * spacingX;
    const y = (row - Math.ceil(count / cols) / 2) * spacingY;
    return makeEntityNode(entity, x, y);
  });
}

function makeEntityNode(entity: GraphEntity, x: number, y: number): Node {
  return {
    id: entityNodeId(entity),
    position: { x, y },
    data: {
      label: `${entity.name} · ${entity.memory_count}`,
      entity,
    },
    style: {
      background: TYPE_COLORS[entity.entity_type] ?? "#94a3b8",
      color: "#0f172a",
      border: "1px solid rgba(15,23,42,0.25)",
      borderRadius: 9999,
      padding: "6px 14px",
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  } satisfies Node;
}

function layoutMemoryChildren(
  parentId: string,
  parentPos: { x: number; y: number },
  memories: GraphMemoryItem[],
): { nodes: Node[]; edges: Edge[] } {
  const count = memories.length || 1;
  const radius = Math.max(160, count * 22);
  const nodes: Node[] = memories.map((memory, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.PI / 6;
    return {
      id: memoryNodeId(memory.id),
      position: {
        x: parentPos.x + Math.cos(angle) * radius,
        y: parentPos.y + Math.sin(angle) * radius,
      },
      data: {
        label: memory.content.slice(0, 56) + (memory.content.length > 56 ? "…" : ""),
        memory,
      },
      style: {
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        maxWidth: 220,
      },
    } satisfies Node;
  });
  const edges: Edge[] = memories.map((memory) => ({
    id: `${parentId}->${memoryNodeId(memory.id)}`,
    source: parentId,
    target: memoryNodeId(memory.id),
    style: { stroke: "#94a3b8" },
  }));
  return { nodes, edges };
}

function dedupeNodes(nodes: Node[]): Node[] {
  const seen = new Map<string, Node>();
  for (const node of nodes) {
    if (!seen.has(node.id)) seen.set(node.id, node);
  }
  return Array.from(seen.values());
}

function dedupeEdges(edges: Edge[]): Edge[] {
  const seen = new Map<string, Edge>();
  for (const edge of edges) {
    if (!seen.has(edge.id)) seen.set(edge.id, edge);
  }
  return Array.from(seen.values());
}

function GraphCanvas(props: {
  state: GraphState;
  filteredEntities: GraphEntity[];
  extraNodes: Node[];
  extraEdges: Edge[];
  expandedEntityIds: Set<string>;
  onEntityClick: (entity: GraphEntity, position: { x: number; y: number }) => Promise<void>;
  onMemoryClick: (memoryId: string, position: { x: number; y: number }) => Promise<void>;
  onPaneClick: () => void;
}) {
  const { fitView, setCenter } = useReactFlow();
  const entityNodes = useMemo(
    () => layoutEntities(props.filteredEntities),
    [props.filteredEntities],
  );
  const nodes = useMemo(
    () => dedupeNodes([...entityNodes, ...props.extraNodes]),
    [entityNodes, props.extraNodes],
  );
  const edges = useMemo(() => dedupeEdges(props.extraEdges), [props.extraEdges]);

  const fitOnce = useRef(false);
  useEffect(() => {
    if (!fitOnce.current && entityNodes.length > 0) {
      fitOnce.current = true;
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    }
  }, [entityNodes.length, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    async (_, node) => {
      if (node.id.startsWith("entity:")) {
        const entity = (node.data as { entity?: GraphEntity }).entity;
        if (!entity) return;
        await props.onEntityClick(entity, node.position);
      } else if (node.id.startsWith("memory:")) {
        const memoryId = node.id.replace("memory:", "");
        await props.onMemoryClick(memoryId, node.position);
      }
      setTimeout(() => setCenter(node.position.x, node.position.y, { duration: 400, zoom: 1 }), 60);
    },
    [props, setCenter],
  );

  if (props.state.loading) {
    return <div className="flex h-full items-center justify-center font-serif text-base text-muted">Loading graph…</div>;
  }
  if (props.state.error) {
    return <div className="flex h-full items-center justify-center font-serif text-base text-rose-500">{props.state.error}</div>;
  }
  if (props.state.entities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center font-serif text-base text-muted">
        <p>No entities yet. Click <em>Backfill entities</em> above to extract them from your existing memories.</p>
      </div>
    );
  }
  if (props.filteredEntities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-serif text-base text-muted">
        No entities match the active filters.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={handleNodeClick}
      onPaneClick={props.onPaneClick}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}

export function MemoryGraph() {
  const [state, setState] = useState<GraphState>({ entities: [], loading: true, error: null });
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [extraNodes, setExtraNodes] = useState<Node[]>([]);
  const [extraEdges, setExtraEdges] = useState<Edge[]>([]);
  const [expandedEntityIds, setExpandedEntityIds] = useState<Set<string>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);

  const loadEntities = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await api.graph.listEntities();
      setState({ entities: result.entities, loading: false, error: null });
    } catch (error) {
      setState({ entities: [], loading: false, error: error instanceof Error ? error.message : "Failed to load graph" });
    }
  }, []);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (!extractStatus) return;
    const timer = setTimeout(() => setExtractStatus(null), 6000);
    return () => clearTimeout(timer);
  }, [extractStatus]);

  const filteredEntities = useMemo(
    () => state.entities.filter((e) => activeTypes.has(e.entity_type)),
    [state.entities, activeTypes],
  );

  const handleEntityClick = useCallback(
    async (entity: GraphEntity, position: { x: number; y: number }) => {
      const id = entityNodeId(entity);
      if (expandedEntityIds.has(id)) {
        setExtraNodes((prev) => prev.filter((n) => !n.id.startsWith(`memory:`) || !extraEdges.some((e) => e.source === id && e.target === n.id)));
        setExtraEdges((prev) => prev.filter((e) => e.source !== id));
        setExpandedEntityIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (selectedDetail?.kind === "entity" && entityNodeId(selectedDetail.entity) === id) {
          setSelectedDetail(null);
        }
        return;
      }
      try {
        const result = await api.graph.entityMemories(entity.entity_type, entity.name);
        const { nodes: childNodes, edges: childEdges } = layoutMemoryChildren(id, position, result.memories);
        setExtraNodes((prev) => dedupeNodes([...prev, ...childNodes]));
        setExtraEdges((prev) => dedupeEdges([...prev, ...childEdges]));
        setExpandedEntityIds((prev) => new Set(prev).add(id));
        setSelectedDetail({ kind: "entity", entity, memories: result.memories });
      } catch (error) {
        setExtractStatus(error instanceof Error ? error.message : "Failed to load memories for entity");
      }
    },
    [expandedEntityIds, extraEdges, selectedDetail],
  );

  const handleMemoryClick = useCallback(
    async (memoryId: string, position: { x: number; y: number }) => {
      try {
        const result = await api.graph.neighbors(memoryId);
        const parentId = memoryNodeId(memoryId);
        const { nodes: childNodes, edges: childEdges } = layoutMemoryChildren(parentId, position, result.neighbors);
        setExtraNodes((prev) => dedupeNodes([...prev, ...childNodes]));
        setExtraEdges((prev) => dedupeEdges([...prev, ...childEdges]));
        const parent = extraNodes.find((n) => n.id === parentId);
        const memory = (parent?.data as { memory?: GraphMemoryItem } | undefined)?.memory;
        if (memory) {
          setSelectedDetail({
            kind: "memory",
            memory,
            neighbors: result.neighbors,
            entities: result.entities,
          });
        }
      } catch (error) {
        setExtractStatus(error instanceof Error ? error.message : "Failed to load neighbors");
      }
    },
    [extraNodes],
  );

  const handleResetView = () => {
    setExtraNodes([]);
    setExtraEdges([]);
    setExpandedEntityIds(new Set());
    setSelectedDetail(null);
  };

  const handleToggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleExtract = async () => {
    setExtracting(true);
    setExtractStatus(null);
    try {
      const result = await api.graph.extract();
      setExtractStatus(`Processed ${result.processed} memories, created ${result.entities_created} entity links`);
      await loadEntities();
    } catch (error) {
      setExtractStatus(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const hasExpansion = extraNodes.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Entity weave</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Memory Graph</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
            Entities extracted from your memories. Click a node to expand its memories and 1-hop neighbors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {extractStatus && <span className="max-w-xs font-sans text-xs text-muted">{extractStatus}</span>}
          {hasExpansion && (
            <button
              type="button"
              onClick={handleResetView}
              className="rounded-md border border-line bg-paper px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
            >
              Reset view
            </button>
          )}
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
          {filteredEntities.length} of {state.entities.length} entities
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="h-[60vh] flex-1 rounded-lg border border-line bg-paper">
          <ReactFlowProvider>
            <GraphCanvas
              state={state}
              filteredEntities={filteredEntities}
              extraNodes={extraNodes}
              extraEdges={extraEdges}
              expandedEntityIds={expandedEntityIds}
              onEntityClick={handleEntityClick}
              onMemoryClick={handleMemoryClick}
              onPaneClick={() => setSelectedDetail(null)}
            />
          </ReactFlowProvider>
        </div>

        {selectedDetail && (
          <aside className="relative max-h-[60vh] w-full overflow-auto rounded-lg border border-line bg-paper p-5 lg:w-[22rem]">
            <button
              type="button"
              onClick={() => setSelectedDetail(null)}
              aria-label="Close details"
              className="absolute right-3 top-3 rounded-md p-1 font-sans text-xs text-muted hover:bg-line/30 hover:text-ink"
            >
              ✕
            </button>
            {selectedDetail.kind === "entity" ? (
              <>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Entity · {selectedDetail.entity.entity_type}
                </p>
                <h2 className="mt-1 pr-6 font-serif text-2xl font-semibold leading-tight text-ink">
                  {selectedDetail.entity.name}
                </h2>
                <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
                  {selectedDetail.memories.length} linked memories
                </p>
                <ul className="mt-3 space-y-3 font-serif text-base leading-7 text-ink/80">
                  {selectedDetail.memories.map((memory) => (
                    <li key={memory.id} className="border-l-2 border-line pl-3">
                      {memory.content}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Memory · {selectedDetail.memory.category}
                </p>
                <p className="mt-2 pr-6 font-serif text-base leading-7 text-ink">
                  {selectedDetail.memory.content}
                </p>
                {selectedDetail.entities.length > 0 && (
                  <>
                    <p className="mt-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      Linked entities
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedDetail.entities.map((e) => (
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
                {selectedDetail.neighbors.length > 0 && (
                  <>
                    <p className="mt-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      Neighbor memories ({selectedDetail.neighbors.length})
                    </p>
                    <ul className="mt-2 space-y-2 font-serif text-sm leading-6 text-ink/70">
                      {selectedDetail.neighbors.map((memory) => (
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
