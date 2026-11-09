"use client";

import { useEffect, useRef } from "react";

type Palette = { ink: number; signal: number; edgeOpacity: number };

const palettes: Record<"dark" | "light", Palette> = {
  dark: { ink: 0xefe9df, signal: 0xf3ae5f, edgeOpacity: 0.11 },
  light: { ink: 0x2a2621, signal: 0xbb5d00, edgeOpacity: 0.16 },
};

const nodeCount = 440;
const neighbourCount = 3;
const recallInterval = 3.4;
const pulseDuration = 1.4;
const maxRadius = 1.45;
const maxEdgeLength = 0.42;

const vertexShader = `
attribute float aSize;
attribute float aGlow;
uniform float uRatio;
varying float vGlow;
varying float vDepth;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  vDepth = clamp((-viewPosition.z - 3.4) / 3.2, 0.0, 1.0);
  vGlow = aGlow;
  gl_PointSize = aSize * (1.0 + aGlow * 1.4) * uRatio * (6.0 / -viewPosition.z);
}
`;

const fragmentShader = `
uniform vec3 uInk;
uniform vec3 uSignal;
varying float vGlow;
varying float vDepth;
void main() {
  float distanceFromCenter = length(gl_PointCoord - 0.5);
  if (distanceFromCenter > 0.5) discard;
  float disc = smoothstep(0.5, 0.18, distanceFromCenter);
  vec3 color = mix(uInk, uSignal, vGlow);
  float alpha = disc * mix(0.9, 0.18, vDepth);
  alpha = max(alpha, disc * vGlow);
  gl_FragColor = vec4(color, alpha);
}
`;

function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function buildGraph() {
  const clusterCenters = Array.from({ length: 8 }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.55 + Math.random() * 0.55;
    return [radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta) * 0.8, radius * Math.cos(phi)];
  });

  const positions = new Float32Array(nodeCount * 3);
  const sizes = new Float32Array(nodeCount);
  for (let index = 0; index < nodeCount; index++) {
    const halo = index % 9 === 0;
    const center = clusterCenters[index % clusterCenters.length];
    const spread = halo ? 0.42 : 0.24;
    const x = center[0] * (halo ? 1.15 : 1) + gaussian() * spread;
    const y = center[1] * (halo ? 1.15 : 1) + gaussian() * spread * 0.85;
    const z = center[2] * (halo ? 1.15 : 1) + gaussian() * spread;
    const shrink = Math.min(1, maxRadius / Math.hypot(x, y, z));
    positions[index * 3] = x * shrink;
    positions[index * 3 + 1] = y * shrink;
    positions[index * 3 + 2] = z * shrink;
    sizes[index] = halo ? 1.6 + Math.random() * 1.2 : 2 + Math.random() * 3.2;
  }

  const neighbours: number[][] = Array.from({ length: nodeCount }, () => []);
  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  for (let source = 0; source < nodeCount; source++) {
    const nearest = [];
    for (let target = 0; target < nodeCount; target++) {
      if (target === source) continue;
      const dx = positions[source * 3] - positions[target * 3];
      const dy = positions[source * 3 + 1] - positions[target * 3 + 1];
      const dz = positions[source * 3 + 2] - positions[target * 3 + 2];
      nearest.push({ target, distance: dx * dx + dy * dy + dz * dz });
    }
    nearest.sort((first, second) => first.distance - second.distance);
    for (const { target, distance } of nearest.slice(0, neighbourCount)) {
      if (distance > maxEdgeLength * maxEdgeLength) continue;
      const key = source < target ? `${source}-${target}` : `${target}-${source}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([source, target]);
      neighbours[source].push(target);
      neighbours[target].push(source);
    }
  }

  return { positions, sizes, edges, neighbours };
}

function recallTree(root: number, neighbours: number[][], limit: number) {
  const visited = new Set([root]);
  const tree: [number, number, number][] = [];
  let frontier = [root];
  for (let depth = 0; depth < 4 && visited.size < limit; depth++) {
    const next: number[] = [];
    for (const node of frontier) {
      const options = neighbours[node].filter((candidate) => !visited.has(candidate)).sort(() => Math.random() - 0.5);
      for (const candidate of options.slice(0, depth === 0 ? 3 : 2)) {
        if (visited.size >= limit) break;
        visited.add(candidate);
        tree.push([node, candidate, depth]);
        next.push(candidate);
      }
    }
    frontier = next;
  }
  return { nodes: visited, tree };
}

export function MemoryField({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (disposed) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      renderer.domElement.className = "block h-full w-full";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
      camera.position.set(0, 0, 5);
      const group = new THREE.Group();
      scene.add(group);

      const { positions, sizes, edges, neighbours } = buildGraph();
      const glow = new Float32Array(nodeCount);
      const glowTarget = new Float32Array(nodeCount);

      const nodeGeometry = new THREE.BufferGeometry();
      nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      nodeGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      const glowAttribute = new THREE.BufferAttribute(glow, 1);
      nodeGeometry.setAttribute("aGlow", glowAttribute);
      const nodeMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRatio: { value: renderer.getPixelRatio() },
          uInk: { value: new THREE.Color() },
          uSignal: { value: new THREE.Color() },
        },
      });
      group.add(new THREE.Points(nodeGeometry, nodeMaterial));

      const edgePositions = new Float32Array(edges.length * 6);
      edges.forEach(([source, target], index) => {
        edgePositions.set(positions.subarray(source * 3, source * 3 + 3), index * 6);
        edgePositions.set(positions.subarray(target * 3, target * 3 + 3), index * 6 + 3);
      });
      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
      const edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
      group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

      const pathPositions = new Float32Array(64 * 6);
      const pathGeometry = new THREE.BufferGeometry();
      pathGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions, 3));
      pathGeometry.setDrawRange(0, 0);
      const pathMaterial = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
      group.add(new THREE.LineSegments(pathGeometry, pathMaterial));

      const pulsePositions = new Float32Array(64 * 3);
      const pulseGeometry = new THREE.BufferGeometry();
      pulseGeometry.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
      pulseGeometry.setDrawRange(0, 0);
      const pulseMaterial = new THREE.PointsMaterial({ size: 0.045, transparent: true, depthWrite: false });
      group.add(new THREE.Points(pulseGeometry, pulseMaterial));

      function applyTheme() {
        const palette = palettes[document.documentElement.dataset.theme === "light" ? "light" : "dark"];
        nodeMaterial.uniforms.uInk.value.setHex(palette.ink);
        nodeMaterial.uniforms.uSignal.value.setHex(palette.signal);
        edgeMaterial.color.setHex(palette.ink);
        edgeMaterial.opacity = palette.edgeOpacity;
        pathMaterial.color.setHex(palette.signal);
        pulseMaterial.color.setHex(palette.signal);
      }
      applyTheme();

      let tree: [number, number, number][] = [];
      let recallStarted = 0;

      function recall(now: number) {
        const candidates = [];
        const rotation = group.rotation.y;
        for (let index = 0; index < nodeCount; index++) {
          const depth = positions[index * 3] * Math.sin(rotation) + positions[index * 3 + 2] * Math.cos(rotation);
          if (depth > 0.2 && neighbours[index].length >= 3) candidates.push(index);
        }
        const root = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
        const result = recallTree(root, neighbours, 14);
        tree = result.tree.slice(0, 64);
        glowTarget.fill(0);
        result.nodes.forEach((node) => (glowTarget[node] = node === root ? 1 : 0.85));
        tree.forEach(([source, target], index) => {
          pathPositions.set(positions.subarray(source * 3, source * 3 + 3), index * 6);
          pathPositions.set(positions.subarray(target * 3, target * 3 + 3), index * 6 + 3);
        });
        pathGeometry.attributes.position.needsUpdate = true;
        pathGeometry.setDrawRange(0, tree.length * 2);
        pulseGeometry.setDrawRange(0, tree.length);
        recallStarted = now;
      }

      const pointer = { x: 0, y: 0 };
      function onPointerMove(event: PointerEvent) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      }

      function resize() {
        const width = container!.clientWidth;
        const height = container!.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width / height < 1.2 ? 4.4 : 4.5;
        camera.updateProjectionMatrix();
      }

      let elapsed = 0;
      let last = performance.now();
      let frame = 0;
      let visible = true;

      function step(now: number) {
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        elapsed += delta;

        group.rotation.y += delta * 0.045;
        group.rotation.x += (pointer.y * 0.12 + 0.12 - group.rotation.x) * 0.03;
        group.rotation.z += (pointer.x * -0.05 - group.rotation.z) * 0.03;

        if (elapsed - recallStarted > recallInterval) recall(elapsed);
        const age = elapsed - recallStarted;
        const fade = age < recallInterval - 0.8 ? 1 : Math.max(0, (recallInterval - age) / 0.8);

        for (let index = 0; index < nodeCount; index++) {
          glow[index] += (glowTarget[index] * fade - glow[index]) * 0.08;
        }
        glowAttribute.needsUpdate = true;
        pathMaterial.opacity = Math.min(1, age * 2) * fade * 0.55;

        tree.forEach(([source, target, depth], index) => {
          const progress = Math.min(1, Math.max(0, (age - depth * 0.35) / pulseDuration));
          const eased = 1 - Math.pow(1 - progress, 3);
          for (let axis = 0; axis < 3; axis++) {
            pulsePositions[index * 3 + axis] = positions[source * 3 + axis] + (positions[target * 3 + axis] - positions[source * 3 + axis]) * eased;
          }
        });
        pulseGeometry.attributes.position.needsUpdate = true;
        pulseMaterial.opacity = age < pulseDuration + 1.4 ? fade : Math.max(0, 1 - (age - pulseDuration - 1.4) * 2);

        renderer.render(scene, camera);
      }

      function tick(now: number) {
        step(now);
        if (visible) frame = requestAnimationFrame(tick);
      }

      function renderStill() {
        recall(0);
        elapsed = 1.6;
        recallStarted = 0;
        for (let index = 0; index < 90; index++) step(last + 16);
      }

      resize();
      const resizeObserver = new ResizeObserver(() => {
        resize();
        if (reduced) renderer.render(scene, camera);
      });
      resizeObserver.observe(container);

      const themeObserver = new MutationObserver(() => {
        applyTheme();
        renderer.render(scene, camera);
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      const visibilityObserver = new IntersectionObserver(([entry]) => {
        const wasVisible = visible;
        visible = entry.isIntersecting;
        if (visible && !wasVisible && !reduced) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      });

      if (reduced) {
        renderStill();
      } else {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        visibilityObserver.observe(container);
        frame = requestAnimationFrame(tick);
      }

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        themeObserver.disconnect();
        visibilityObserver.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        [nodeGeometry, edgeGeometry, pathGeometry, pulseGeometry, nodeMaterial, edgeMaterial, pathMaterial, pulseMaterial].forEach((item) => item.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" className={className} />;
}
