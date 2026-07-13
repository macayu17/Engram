"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  api,
  type GraphEdge,
  type GraphEntity,
  type GraphMemoryItem,
} from "@/lib/api";
import { cn } from "@/lib/cn";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as unknown as React.ComponentType<ForceGraphProps>;

type ForceGraphProps = {
  ref?: React.RefObject<ForceGraphHandle | null>;
  graphData: { nodes: ForceNode[]; links: ForceLink[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeCanvasObject?: (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodeCanvasObjectMode?: () => "before" | "after" | "replace";
  nodePointerAreaPaint?: (node: ForceNode, color: string, ctx: CanvasRenderingContext2D) => void;
  linkColor?: (link: ForceLink) => string;
  linkWidth?: (link: ForceLink) => number;
  linkCurvature?: number | ((link: ForceLink) => number);
  linkCanvasObject?: (link: ForceLink, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  linkCanvasObjectMode?: () => "before" | "after" | "replace";
  linkDirectionalParticles?: number | ((link: ForceLink) => number);
  linkDirectionalParticleSpeed?: number | ((link: ForceLink) => number);
  linkDirectionalParticleColor?: (link: ForceLink) => string;
  linkDirectionalParticleWidth?: number | ((link: ForceLink) => number);
  onNodeClick?: (node: ForceNode, event: MouseEvent) => void;
  onNodeRightClick?: (node: ForceNode, event: MouseEvent) => void;
  onNodeHover?: (node: ForceNode | null) => void;
  onBackgroundClick?: () => void;
  onBackgroundRightClick?: () => void;
  onZoom?: (transform: { k: number; x: number; y: number }) => void;
  onRenderFramePre?: (ctx: CanvasRenderingContext2D, globalScale: number) => void;
  onRenderFramePost?: (ctx: CanvasRenderingContext2D, globalScale: number) => void;
  cooldownTicks?: number;
  d3VelocityDecay?: number;
  d3AlphaDecay?: number;
  enableNodeDrag?: boolean;
  warmupTicks?: number;
  onEngineStop?: () => void;
};

type ForceGraphHandle = {
  zoomToFit: (durationMs?: number, padding?: number) => void;
  centerAt: (x?: number, y?: number, durationMs?: number) => void;
  zoom: (zoom: number, durationMs?: number) => void;
  d3Force: (forceName: string, force?: unknown) => unknown;
  d3ReheatSimulation: () => void;
  resumeAnimation: () => void;
};

type LinkForce = {
  distance: (distance: number | ((link: ForceLink) => number)) => LinkForce;
  strength: (strength: number | ((link: ForceLink) => number)) => LinkForce;
};

type ChargeForce = {
  strength: (strength: number | ((node: ForceNode) => number)) => ChargeForce;
  distanceMax: (distance: number) => ChargeForce;
};

type FloatingForce = {
  initialize?: (nodes: ForceNode[]) => void;
  (alpha: number): void;
};

type ForceNode = {
  id: string;
  name: string;
  entityType: string;
  memoryCount: number;
  radius: number;
  phase: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
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

const LABEL_FULL_ZOOM = 1.6;
const LABEL_FADE_ZOOM = 0.55;

type ThemePalette = {
  canvasBg: string;
  sidebarBg: string;
  dotGrid: string;
  labelColor: string;
  labelDimColor: string;
  selectedRingColor: string;
  pinnedDotColor: string;
  edgeBaseAlpha: number;
  edgeHighlightAlpha: number;
  edgeFadeAlpha: number;
  haloAlphaBase: number;
  haloAlphaDim: number;
};

const DARK_PALETTE: ThemePalette = {
  canvasBg: "#0b0a09",
  sidebarBg: "rgba(18,17,15,0.96)",
  dotGrid: "rgba(166,160,148,0.10)",
  labelColor: "#f4efe5",
  labelDimColor: "#6f6a61",
  selectedRingColor: "#5aa89e",
  pinnedDotColor: "#12110f",
  edgeBaseAlpha: 0.32,
  edgeHighlightAlpha: 0.7,
  edgeFadeAlpha: 0.15,
  haloAlphaBase: 0.14,
  haloAlphaDim: 0.05,
};

const LIGHT_PALETTE: ThemePalette = {
  canvasBg: "#e0ded7",
  sidebarBg: "rgba(233,231,224,0.96)",
  dotGrid: "rgba(25,27,25,0.08)",
  labelColor: "#191b19",
  labelDimColor: "#5b605a",
  selectedRingColor: "#25746b",
  pinnedDotColor: "#e9e7e0",
  edgeBaseAlpha: 0.45,
  edgeHighlightAlpha: 0.85,
  edgeFadeAlpha: 0.18,
  haloAlphaBase: 0.18,
  haloAlphaDim: 0.06,
};

function useTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = (): "dark" | "light" =>
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function computeRadius(memoryCount: number): number {
  return 3 + Math.sqrt(memoryCount) * 2.2;
}

function stablePhase(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 10000;
  }
  return (hash / 10000) * Math.PI * 2;
}

function hasForceMethod<TMethod extends string>(
  force: unknown,
  method: TMethod,
): force is Record<TMethod, (...args: unknown[]) => unknown> {
  return typeof force === "object" && force !== null && method in force && typeof force[method as keyof typeof force] === "function";
}

function createFloatingForce(): FloatingForce {
  let nodes: ForceNode[] = [];
  const force = ((alpha: number) => {
    const time = performance.now() / 1000;
    for (const node of nodes) {
      if (node.fx != null || node.fy != null) continue;
      const pulse = Math.sin(time * 0.7 + node.phase);
      const sway = Math.cos(time * 0.55 + node.phase);
      node.vx = (node.vx ?? 0) + sway * alpha * 0.035;
      node.vy = (node.vy ?? 0) + pulse * alpha * 0.035;
    }
  }) as FloatingForce;
  force.initialize = (forceNodes: ForceNode[]) => {
    nodes = forceNodes;
  };
  return force;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getNodeX(end: string | ForceNode): number | undefined {
  return typeof end === "string" ? undefined : end.x;
}
function getNodeY(end: string | ForceNode): number | undefined {
  return typeof end === "string" ? undefined : end.y;
}
function getNodeColor(end: string | ForceNode): string {
  if (typeof end === "string") return "#6f6a61";
  return TYPE_COLORS[end.entityType] ?? "#6f6a61";
}
function getNodeId(end: string | ForceNode): string {
  return typeof end === "string" ? end : end.id;
}

export function MemoryGraph() {
  const [entities, setEntities] = useState<GraphEntity[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [contextMenu, setContextMenu] = useState<
    | { x: number; y: number; node: ForceNode }
    | null
  >(null);
  const [selected, setSelected] = useState<
    | { kind: "entity"; entity: GraphEntity; memories: GraphMemoryItem[] }
    | { kind: "memory"; memory: GraphMemoryItem; neighbors: GraphMemoryItem[]; entities: GraphEntity[] }
    | null
  >(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoFitRef = useRef(false);
  const minimapNodesRef = useRef<ForceNode[]>([]);

  const themeMode = useTheme();
  const palette = themeMode === "light" ? LIGHT_PALETTE : DARK_PALETTE;

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
      setExtractStatus("Edges endpoint unavailable. Update the API to see connections.");
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
    if (!canvasRef.current) return;
    const el = canvasRef.current;
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

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    for (const e of filteredEntities) {
      if (e.name.toLowerCase().includes(q)) matches.add(e.id);
    }
    return matches;
  }, [searchQuery, filteredEntities]);

  const graphData = useMemo(() => {
    const nodes: ForceNode[] = filteredEntities.map((e) => ({
      id: e.id,
      name: e.name,
      entityType: e.entity_type,
      memoryCount: e.memory_count,
      radius: computeRadius(e.memory_count),
      phase: stablePhase(e.id),
    }));
    const links: ForceLink[] = edges
      .filter((edge) => filteredIdSet.has(edge.source) && filteredIdSet.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target, weight: edge.weight }));
    return { nodes, links };
  }, [filteredEntities, edges, filteredIdSet]);

  useEffect(() => {
    minimapNodesRef.current = graphData.nodes;
    autoFitRef.current = false;
  }, [graphData]);

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    const linkForce = fgRef.current.d3Force("link");
    if (hasForceMethod(linkForce, "distance") && hasForceMethod(linkForce, "strength")) {
      const typedLinkForce = linkForce as LinkForce;
      typedLinkForce.distance((link) => 118 + Math.min(90, link.weight * 18));
      typedLinkForce.strength((link) => Math.min(0.32, 0.1 + link.weight * 0.025));
    }

    const chargeForce = fgRef.current.d3Force("charge");
    if (hasForceMethod(chargeForce, "strength") && hasForceMethod(chargeForce, "distanceMax")) {
      const typedChargeForce = chargeForce as ChargeForce;
      typedChargeForce.strength((node) => -300 - node.radius * 24);
      typedChargeForce.distanceMax(560);
    }

    fgRef.current.d3Force("float", createFloatingForce());
    fgRef.current.d3ReheatSimulation();
    fgRef.current.resumeAnimation();
  }, [graphData]);

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
      const s = getNodeId(link.source);
      const t = getNodeId(link.target);
      return s === hoveredId || t === hoveredId;
    },
    [hoveredId],
  );

  const isDimmed = useCallback(
    (id: string): boolean => {
      if (searchMatches && !searchMatches.has(id)) return true;
      if (hoveredId !== null && !isHighlighted(id)) return true;
      return false;
    },
    [searchMatches, hoveredId, isHighlighted],
  );

  const renderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const positionedNodes = graphData.nodes.filter(
        (n) => n.x !== undefined && n.y !== undefined,
      );
      if (positionedNodes.length === 0) return;
      const byType = new Map<string, ForceNode[]>();
      for (const node of positionedNodes) {
        if (!byType.has(node.entityType)) byType.set(node.entityType, []);
        byType.get(node.entityType)!.push(node);
      }
      ctx.save();
      for (const [type, group] of byType.entries()) {
        if (group.length < 2) continue;
        const cx = group.reduce((s, n) => s + (n.x ?? 0), 0) / group.length;
        const cy = group.reduce((s, n) => s + (n.y ?? 0), 0) / group.length;
        let maxDist = 0;
        for (const n of group) {
          const dx = (n.x ?? 0) - cx;
          const dy = (n.y ?? 0) - cy;
          const d = Math.sqrt(dx * dx + dy * dy) + n.radius;
          if (d > maxDist) maxDist = d;
        }
        const radius = maxDist + 14;
        const color = TYPE_COLORS[type] ?? "#6f6a61";
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, withAlpha(color, 0.08));
        gradient.addColorStop(0.7, withAlpha(color, 0.03));
        gradient.addColorStop(1, withAlpha(color, 0));
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      ctx.restore();
    },
    [graphData.nodes],
  );

  const drawLink = useCallback(
    (link: ForceLink, ctx: CanvasRenderingContext2D) => {
      const sx = getNodeX(link.source);
      const sy = getNodeY(link.source);
      const tx = getNodeX(link.target);
      const ty = getNodeY(link.target);
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) return;

      const highlighted = isLinkHighlighted(link);
      const fade = hoveredId && !highlighted ? 0.15 : 1;
      const weightThickness = Math.min(2.4, 0.5 + Math.sqrt(link.weight) * 0.55);
      const thickness = highlighted ? weightThickness + 1 : weightThickness;

      const dx = tx - sx;
      const dy = ty - sy;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const offset = Math.sqrt(dx * dx + dy * dy) * 0.12;
      const nx = -dy;
      const ny = dx;
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      const cx = mx + (nx / len) * offset;
      const cy = my + (ny / len) * offset;

      const sColor = getNodeColor(link.source);
      const tColor = getNodeColor(link.target);
      const gradient = ctx.createLinearGradient(sx, sy, tx, ty);
      const baseAlpha = highlighted ? palette.edgeHighlightAlpha : palette.edgeBaseAlpha;
      gradient.addColorStop(0, withAlpha(sColor, baseAlpha * fade));
      gradient.addColorStop(1, withAlpha(tColor, baseAlpha * fade));

      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      ctx.stroke();
      ctx.restore();
    },
    [isLinkHighlighted, hoveredId, palette],
  );

  const drawNode = useCallback(
    (node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x === undefined || node.y === undefined) return;
      const baseColor = TYPE_COLORS[node.entityType] ?? "#6f6a61";
      const dimmed = isDimmed(node.id);
      const isSearchMatch = searchMatches !== null && searchMatches.has(node.id);
      const isPinned = pinnedIds.has(node.id);
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredId === node.id;
      const time = performance.now() / 1000;
      const hoverOffsetX = (node.fx != null) ? 0 : Math.cos(time * 0.7 + node.phase) * 1.8;
      const hoverOffsetY = (node.fy != null) ? 0 : Math.sin(time * 0.85 + node.phase) * 1.8;
      const drawX = node.x + hoverOffsetX;
      const drawY = node.y + hoverOffsetY;
      const pulse = 0.5 + Math.sin(time * 1.3 + node.phase) * 0.5;
      ctx.save();

      if (isHovered) {
        const glowRadius = node.radius + 18;
        const glow = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowRadius);
        glow.addColorStop(0, withAlpha(baseColor, 0.5));
        glow.addColorStop(0.6, withAlpha(baseColor, 0.15));
        glow.addColorStop(1, withAlpha(baseColor, 0));
        ctx.beginPath();
        ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      if (isSearchMatch && !isHovered) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, node.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(baseColor, 0.2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(drawX, drawY, node.radius + 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = dimmed ? palette.haloAlphaDim : palette.haloAlphaBase + pulse * 0.08;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(drawX, drawY, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = dimmed ? 0.3 : 1;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, node.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = palette.selectedRingColor;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
      }

      if (isPinned) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, Math.max(1.2, node.radius * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = palette.pinnedDotColor;
        ctx.globalAlpha = 0.9;
        ctx.fill();
      }

      const labelOpacityFromZoom = globalScale <= LABEL_FADE_ZOOM
        ? 0
        : globalScale >= LABEL_FULL_ZOOM
          ? 1
          : (globalScale - LABEL_FADE_ZOOM) / (LABEL_FULL_ZOOM - LABEL_FADE_ZOOM);
      const showLabel = isHovered || isSelected || isSearchMatch || labelOpacityFromZoom > 0.05;
      if (showLabel) {
        const labelAlpha = (isHovered || isSelected || isSearchMatch) ? 0.95 : labelOpacityFromZoom * 0.85;
        const fontSize = Math.max(10, 12 / Math.sqrt(globalScale));
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dimmed ? palette.labelDimColor : palette.labelColor;
        ctx.globalAlpha = dimmed ? labelAlpha * 0.4 : labelAlpha;
        ctx.fillText(node.name, drawX, drawY + node.radius + 6);
      }
      ctx.restore();
    },
    [isDimmed, searchMatches, pinnedIds, selectedNodeId, hoveredId, palette],
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
    async (node: ForceNode, event: MouseEvent) => {
      if (event.shiftKey) {
        setPinnedIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
            node.fx = null;
            node.fy = null;
            fgRef.current?.d3ReheatSimulation();
          } else {
            next.add(node.id);
            node.fx = node.x ?? 0;
            node.fy = node.y ?? 0;
          }
          return next;
        });
        return;
      }
      setContextMenu(null);
      setSelectedNodeId(node.id);
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

  const handleNodeRightClick = useCallback(
    (node: ForceNode, event: MouseEvent) => {
      event.preventDefault?.();
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = rect ? event.clientX - rect.left : event.clientX;
      const y = rect ? event.clientY - rect.top : event.clientY;
      setContextMenu({ x, y, node });
    },
    [],
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

  const handleSelectAll = () => setActiveTypes(new Set(ENTITY_TYPES));
  const handleSelectNone = () => setActiveTypes(new Set());

  const handleResetView = useCallback(() => {
    for (const node of graphData.nodes) {
      node.fx = null;
      node.fy = null;
    }
    setPinnedIds(new Set());
    setSelectedNodeId(null);
    setSelected(null);
    setSearchQuery("");
    fgRef.current?.d3ReheatSimulation();
    fgRef.current?.zoomToFit(600, 60);
  }, [graphData.nodes]);

  const handleFitView = useCallback(() => {
    fgRef.current?.zoomToFit(600, 60);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Escape") {
        setSelected(null);
        setSelectedNodeId(null);
        setContextMenu(null);
        if (isInput && target instanceof HTMLInputElement) {
          setSearchQuery("");
          target.blur();
        }
        return;
      }
      if (isInput) return;
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "r" || event.key === "R") {
        handleResetView();
      } else if (event.key === "f" || event.key === "F") {
        handleFitView();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleResetView, handleFitView]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const linkParticles = useCallback(
    (link: ForceLink): number => (isLinkHighlighted(link) ? Math.min(3, 1 + Math.floor(link.weight / 2)) : 0),
    [isLinkHighlighted],
  );

  const linkParticleColor = useCallback(
    (link: ForceLink): string => getNodeColor(link.source),
    [],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entities) counts[e.entity_type] = (counts[e.entity_type] ?? 0) + 1;
    return counts;
  }, [entities]);

  const visibleTypeCount = Object.values(typeCounts).filter((c) => c > 0).length;

  return (
    <div
      className="-mx-4 -mt-10 flex flex-col gap-0 border-y border-line sm:-mx-6 md:-mt-16 lg:h-[calc(100vh-6rem)] lg:flex-row"
      style={{ background: palette.canvasBg }}
    >
      <aside
        className="flex w-full shrink-0 flex-col gap-5 border-b border-line/40 p-5 lg:w-72 lg:border-b-0 lg:border-r"
        style={{ background: palette.sidebarBg }}
      >
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Entity weave</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">Memory Graph</h1>
          <p className="mt-2 font-serif text-sm leading-6 text-muted">
            Entities extracted from your memories. Hover to highlight a neighborhood. Shift-click to pin. Right-click for actions.
          </p>
        </div>

        <div>
          <label className="block">
            <span className="sr-only">Search entities</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities  ( / )"
              className="w-full rounded-md border border-line/60 bg-paper/40 px-3 py-2 font-sans text-[11px] text-ink placeholder:text-muted focus:border-signal focus:outline-none"
            />
          </label>
          {searchMatches !== null && (
            <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
              {searchMatches.size} match{searchMatches.size === 1 ? "" : "es"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 border-y border-line/40 py-3">
          <Stat label="Entities" value={filteredEntities.length} sub={`/ ${entities.length}`} />
          <Stat label="Edges" value={graphData.links.length} />
          <Stat label="Types" value={visibleTypeCount} sub={`/ ${ENTITY_TYPES.length}`} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Filter</span>
            <div className="flex gap-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
              <button type="button" onClick={handleSelectAll} className="hover:text-signal">All</button>
              <span aria-hidden>·</span>
              <button type="button" onClick={handleSelectNone} className="hover:text-signal">None</button>
            </div>
          </div>
          <ul className="space-y-1">
            {ENTITY_TYPES.map((type) => {
              const active = activeTypes.has(type);
              const count = typeCounts[type] ?? 0;
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => handleToggleType(type)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.1em] transition hover:border-line/60",
                      active ? "text-ink" : "text-muted opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: TYPE_COLORS[type], opacity: active ? 1 : 0.5 }}
                      />
                      {type}
                    </span>
                    <span className={cn("font-sans text-[10px] tabular-nums", active ? "text-ink/80" : "text-muted")}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-line/40 pt-3">
          <p className="mb-2 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Shortcuts</p>
          <ul className="space-y-1 font-sans text-[10px] text-muted">
            <li><kbd className="rounded bg-line/30 px-1.5 py-0.5 text-ink/70">/</kbd>  search</li>
            <li><kbd className="rounded bg-line/30 px-1.5 py-0.5 text-ink/70">F</kbd>  fit to view</li>
            <li><kbd className="rounded bg-line/30 px-1.5 py-0.5 text-ink/70">R</kbd>  reset (unpin + zoom)</li>
            <li><kbd className="rounded bg-line/30 px-1.5 py-0.5 text-ink/70">Esc</kbd>  close panel</li>
            <li><kbd className="rounded bg-line/30 px-1.5 py-0.5 text-ink/70">Shift</kbd> + click  pin</li>
          </ul>
          {pinnedIds.size > 0 && (
            <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
              {pinnedIds.size} pinned
            </p>
          )}
        </div>

        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="w-full rounded-md border border-line bg-paper/10 px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:bg-paper/20 disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "Backfill entities"}
          </button>
          {extractStatus && (
            <p className="font-sans text-[11px] leading-5 text-muted">{extractStatus}</p>
          )}
        </div>
      </aside>

      <div
        ref={canvasRef}
        className="relative h-[70vh] flex-1 lg:h-auto"
        style={{
          background: palette.canvasBg,
          backgroundImage: `radial-gradient(${palette.dotGrid} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center font-serif text-base text-muted">Loading graph…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center font-serif text-base text-fault">{error}</div>
        ) : entities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center font-serif text-base text-muted">
            <p>No entities yet. Click <em>Backfill entities</em> in the sidebar to extract them from your existing memories.</p>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="flex h-full items-center justify-center font-serif text-base text-muted">
            No entities match the active filters.
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={size.width}
              height={size.height}
              backgroundColor="rgba(0,0,0,0)"
              nodeCanvasObject={drawNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={drawNodePointerArea}
              linkColor={() => "rgba(0,0,0,0)"}
              linkWidth={() => 0}
              linkCanvasObject={drawLink}
              linkCanvasObjectMode={() => "replace"}
              linkCurvature={0.12}
              linkDirectionalParticles={linkParticles}
              linkDirectionalParticleSpeed={0.006}
              linkDirectionalParticleColor={linkParticleColor}
              linkDirectionalParticleWidth={2}
              onNodeClick={handleNodeClick}
              onNodeRightClick={handleNodeRightClick}
              onNodeHover={(node) => setHoveredId(node ? node.id : null)}
              onBackgroundClick={() => {
                setSelected(null);
                setSelectedNodeId(null);
                setContextMenu(null);
              }}
              onZoom={(t) => setZoom(t.k)}
              onRenderFramePre={renderFramePre}
              cooldownTicks={Infinity}
              warmupTicks={80}
              d3VelocityDecay={0.48}
              d3AlphaDecay={0.012}
              onEngineStop={() => {
                if (!autoFitRef.current && fgRef.current) {
                  autoFitRef.current = true;
                  fgRef.current.zoomToFit(700, 60);
                }
                fgRef.current?.resumeAnimation();
              }}
              enableNodeDrag={true}
            />

            {/* Floating type legend */}
            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-1.5">
              {ENTITY_TYPES.filter((t) => activeTypes.has(t) && (typeCounts[t] ?? 0) > 0).map((type) => (
                <span
                  key={type}
                  className="rounded-full px-2.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.12em]"
                  style={{
                    background: withAlpha(TYPE_COLORS[type], 0.18),
                    color: TYPE_COLORS[type],
                    border: `1px solid ${withAlpha(TYPE_COLORS[type], 0.35)}`,
                  }}
                >
                  {type}
                </span>
              ))}
            </div>

            {/* Zoom indicator */}
            <div className="pointer-events-none absolute bottom-4 left-4 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
              zoom · {zoom.toFixed(2)}×
            </div>

            {/* Minimap */}
            <Minimap nodes={minimapNodesRef.current} size={{ width: size.width, height: size.height }} palette={palette} />

            {/* Right-click context menu */}
            {contextMenu && (
              <div
                className="absolute z-30 min-w-[12rem] overflow-hidden rounded-md border border-line/60 bg-paper shadow-2xl"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <ContextMenuItem
                  label={pinnedIds.has(contextMenu.node.id) ? "Unpin node" : "Pin node"}
                  onClick={() => {
                    setPinnedIds((prev) => {
                      const next = new Set(prev);
                      const node = contextMenu.node;
                      if (next.has(node.id)) {
                        next.delete(node.id);
                        node.fx = null;
                        node.fy = null;
                        fgRef.current?.d3ReheatSimulation();
                      } else {
                        next.add(node.id);
                        node.fx = node.x ?? 0;
                        node.fy = node.y ?? 0;
                      }
                      return next;
                    });
                    setContextMenu(null);
                  }}
                />
                <ContextMenuItem
                  label="Center on node"
                  onClick={() => {
                    const node = contextMenu.node;
                    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
                      fgRef.current.centerAt(node.x, node.y, 600);
                      fgRef.current.zoom(2.4, 600);
                    }
                    setContextMenu(null);
                  }}
                />
                <ContextMenuItem
                  label="Hide entity type"
                  onClick={() => {
                    setActiveTypes((prev) => {
                      const next = new Set(prev);
                      next.delete(contextMenu.node.entityType);
                      return next;
                    });
                    setContextMenu(null);
                  }}
                />
              </div>
            )}
          </>
        )}

        {selected && (
          <aside className="absolute right-4 top-4 z-20 max-h-[calc(100%-2rem)] w-[22rem] max-w-[calc(100%-2rem)] overflow-auto rounded-lg border border-line/60 bg-paper p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => { setSelected(null); setSelectedNodeId(null); }}
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
                          style={{ background: TYPE_COLORS[e.entity_type] ?? "#6f6a61", color: "#0b0a09" }}
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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold text-ink tabular-nums">
        {value.toLocaleString()}
        {sub && <span className="ml-1 font-sans text-[10px] font-normal text-muted">{sub}</span>}
      </p>
    </div>
  );
}

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-ink/80 hover:bg-line/30 hover:text-ink"
    >
      {label}
    </button>
  );
}

function Minimap({ nodes, size, palette }: { nodes: ForceNode[]; size: { width: number; height: number }; palette: ThemePalette }) {
  const positioned = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (positioned.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of positioned) {
    if ((n.x ?? 0) < minX) minX = n.x ?? 0;
    if ((n.x ?? 0) > maxX) maxX = n.x ?? 0;
    if ((n.y ?? 0) < minY) minY = n.y ?? 0;
    if ((n.y ?? 0) > maxY) maxY = n.y ?? 0;
  }
  const padding = 20;
  const w = Math.max(1, maxX - minX + padding * 2);
  const h = Math.max(1, maxY - minY + padding * 2);
  const miniW = 140;
  const miniH = Math.max(70, Math.min(110, (miniW * h) / w));
  const scaleX = miniW / w;
  const scaleY = miniH / h;
  void size;
  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-line/40 p-2"
      style={{ background: palette.sidebarBg }}
    >
      <svg width={miniW} height={miniH}>
        {positioned.map((n) => (
          <circle
            key={n.id}
            cx={((n.x ?? 0) - minX + padding) * scaleX}
            cy={((n.y ?? 0) - minY + padding) * scaleY}
            r={Math.max(1, Math.min(3, n.radius * 0.35))}
            fill={TYPE_COLORS[n.entityType] ?? "#6f6a61"}
            opacity={0.85}
          />
        ))}
      </svg>
      <p className="mt-1 text-center font-sans text-[9px] uppercase tracking-[0.12em] text-muted">overview</p>
    </div>
  );
}
