"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  Position,
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

function entityNodeId(entity: GraphEntity): string {
  return `entity:${entity.entity_type}:${entity.name}`;
}

function memoryNodeId(memoryId: string): string {
  return `memory:${memoryId}`;
}

function layoutEntities(entities: GraphEntity[]): Node[] {
  const count = entities.length || 1;
  if (count <= 12) {
    const radius = Math.max(220, count * 40);
    return entities.map((entity, index) => {
      const angle = (index / count) * Math.PI * 2;
      return makeEntityNode(entity, Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  }
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const spacingX = 220;
  const spacingY = 110;
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

function layoutMemoryChildren(parentId: string, parentPos: { x: number; y: number }, memories: GraphMemoryItem[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = memories.map((memory, index) => {
    const angle = (index / Math.max(memories.length, 1)) * Math.PI * 2;
    const r = 140;
    return {
      id: memoryNodeId(memory.id),
      position: { x: parentPos.x + Math.cos(angle) * r, y: parentPos.y + Math.sin(angle) * r },
      data: { label: memory.content.slice(0, 64) + (memory.content.length > 64 ? "…" : ""), memory },
      style: {
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        maxWidth: 200,
      },
    } satisfies Node;
  });
  const edges: Edge[] = memories.map((memory) => ({
    id: `${parentId}->${memoryNodeId(memory.id)}`,
    source: parentId,
    target: memoryNodeId(memory.id),
    style: { stroke: "#94a3b8" },
    animated: false,
  }));
  return { nodes, edges };
}

export function MemoryGraph() {
  const [state, setState] = useState<GraphState>({ entities: [], loading: true, error: null });
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [extraNodes, setExtraNodes] = useState<Node[]>([]);
  const [extraEdges, setExtraEdges] = useState<Edge[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<GraphEntity | null>(null);
  const [selectedMemories, setSelectedMemories] = useState<GraphMemoryItem[]>([]);
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

  const filteredEntities = useMemo(
    () => state.entities.filter((e) => activeTypes.has(e.entity_type)),
    [state.entities, activeTypes],
  );

  const entityNodes = useMemo(() => layoutEntities(filteredEntities), [filteredEntities]);

  const nodes = useMemo(() => [...entityNodes, ...extraNodes], [entityNodes, extraNodes]);
  const edges = useMemo(() => extraEdges, [extraEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(async (_, node) => {
    if (node.id.startsWith("entity:")) {
      const entity = (node.data as { entity?: GraphEntity }).entity;
      if (!entity) return;
      setSelectedEntity(entity);
      try {
        const result = await api.graph.entityMemories(entity.entity_type, entity.name);
        setSelectedMemories(result.memories);
        const { nodes: childNodes, edges: childEdges } = layoutMemoryChildren(node.id, node.position, result.memories);
        setExtraNodes(childNodes);
        setExtraEdges(childEdges);
      } catch (error) {
        setSelectedMemories([]);
        setExtraNodes([]);
        setExtraEdges([]);
        setExtractStatus(error instanceof Error ? error.message : "Failed to load memories for entity");
      }
      return;
    }
    if (node.id.startsWith("memory:")) {
      const memoryId = node.id.replace("memory:", "");
      try {
        const result = await api.graph.neighbors(memoryId);
        const { nodes: childNodes, edges: childEdges } = layoutMemoryChildren(node.id, node.position, result.neighbors);
        setExtraNodes((prev) => [...prev, ...childNodes]);
        setExtraEdges((prev) => [...prev, ...childEdges]);
      } catch (error) {
        setExtractStatus(error instanceof Error ? error.message : "Failed to load neighbors");
      }
    }
  }, []);

  const handleToggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
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

  return (
    <div className="flex h-[78vh] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Entity weave</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Memory Graph</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
            Entities extracted from your memories. Click a node to expand its memories and 1-hop neighbors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {extractStatus && <span className="font-sans text-xs text-muted">{extractStatus}</span>}
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="rounded-md border border-line bg-paper px-3 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.12em] hover:bg-line/40 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Backfill entities"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {ENTITY_TYPES.map((type) => {
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleToggleType(type)}
              className="rounded-full border px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{
                background: active ? TYPE_COLORS[type] : "transparent",
                color: active ? "#0f172a" : "var(--ink, #475569)",
                borderColor: TYPE_COLORS[type],
              }}
            >
              {type}
            </button>
          );
        })}
      </div>

      <div className="flex-1 rounded-lg border border-line bg-paper">
        {state.loading ? (
          <div className="flex h-full items-center justify-center font-sans text-sm text-muted">Loading graph…</div>
        ) : state.error ? (
          <div className="flex h-full items-center justify-center font-sans text-sm text-rose-500">{state.error}</div>
        ) : state.entities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 font-sans text-sm text-muted">
            <p>No entities yet. Enable <code className="rounded bg-line/40 px-1">ENABLE_GRAPH=true</code> on the API and click <em>Backfill entities</em>.</p>
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>

      {selectedEntity && (
        <aside className="rounded-lg border border-line bg-paper p-5">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            {selectedEntity.entity_type}
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight text-ink">
            {selectedEntity.name}
          </h2>
          <ul className="mt-3 space-y-2 font-serif text-base leading-7 text-ink/80">
            {selectedMemories.map((memory) => (
              <li key={memory.id}>{memory.content}</li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
