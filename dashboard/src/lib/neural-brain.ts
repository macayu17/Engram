type Neuron = { x: number; y: number; z: number; part: string; side: number };
type Synapse = { a: number; b: number; weight: number };
type Pulse = { from: number; to: number; progress: number; speed: number; recall: boolean };
type Projected = { x: number; y: number; z: number; scale: number };
type Label = { text: string; score: number; above: boolean; born: number };

export type BrainHit = { text: string; score: number; above: boolean };

export type BrainTip = { title: string; text: string; x: number; y: number };

export type BrainQuery = { question: string; hits: [string, number][] };

export type BrainCallbacks = {
  onStatus: (status: string) => void;
  onHit: (hit: BrainHit) => void;
  onClear: () => void;
  onTip: (tip: BrainTip | null) => void;
};

export const brainQueries: BrainQuery[] = [
  { question: "what backend should I use?", hits: [["fastapi", 0.91], ["postgres", 0.74], ["typescript", 0.58], ["berlin", 0.21]] },
  { question: "what am I building?", hits: [["sentinel", 0.93], ["marketsim", 0.86], ["fastapi", 0.52], ["darkmode", 0.18]] },
  { question: "how should you answer me?", hits: [["concise", 0.89], ["darkmode", 0.44], ["typescript", 0.31]] },
];

const colorTokens = ["ink", "ink-muted", "hot", "paper", "line", "on-hot"] as const;
type ColorToken = (typeof colorTokens)[number];

export function startNeuralBrain(canvas: HTMLCanvasElement, callbacks: BrainCallbacks) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx = context;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let seed = 21;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const neurons: Neuron[] = [];
  const synapses: Synapse[] = [];
  const adjacency: number[][] = [];

  function tryAdd(point: Neuron, minDistance: number) {
    for (const other of neurons) {
      if (
        Math.abs(other.x - point.x) < minDistance &&
        Math.abs(other.y - point.y) < minDistance &&
        Math.abs(other.z - point.z) < minDistance &&
        Math.hypot(other.x - point.x, other.y - point.y, other.z - point.z) < minDistance
      ) {
        return false;
      }
    }
    neurons.push(point);
    return true;
  }

  function shell(
    cx: number, cy: number, cz: number, ax: number, ay: number, az: number,
    options: { side?: number; flat?: number; inner?: boolean }, count: number, minDistance: number, part: string,
  ) {
    let made = 0;
    let tries = 0;
    while (made < count && tries < count * 40) {
      tries++;
      const u = random() * 6.283;
      const v = Math.acos(2 * random() - 1);
      const dx = Math.sin(v) * Math.cos(u);
      const dy = Math.cos(v);
      const dz = Math.sin(v) * Math.sin(u);
      const depth = options.inner ? 0.55 + random() * 0.35 : 1;
      let x = dx * ax * depth;
      let y = dy * ay * depth;
      const z = dz * az * depth;
      if (options.side && dx * options.side < 0) x *= 0.3;
      if (options.flat != null && y < options.flat) y = options.flat + (y - options.flat) * 0.35;
      if (tryAdd({ x: cx + x, y: cy + y, z: cz + z, part, side: options.side || 0 }, minDistance)) made++;
    }
  }

  [-1, 1].forEach((hemisphere) => {
    shell(hemisphere * 0.2, 0, 0, 0.46, 0.54, 0.82, { side: hemisphere, flat: -0.22 }, 170, 0.085, "cortex");
    shell(hemisphere * 0.2, 0, 0, 0.46, 0.54, 0.82, { side: hemisphere, flat: -0.22, inner: true }, 28, 0.14, "deep");
    shell(hemisphere * 0.3, -0.2, 0.1, 0.3, 0.2, 0.46, { side: hemisphere }, 34, 0.085, "temporal");
  });
  shell(0, -0.38, -0.58, 0.5, 0.2, 0.28, {}, 46, 0.08, "cerebellum");
  for (let i = 0; i < 9; i++) {
    tryAdd({ x: (random() - 0.5) * 0.08, y: -0.36 - i * 0.07, z: -0.3 + (random() - 0.5) * 0.08, part: "stem", side: 0 }, 0.03);
  }
  neurons.forEach(() => adjacency.push([]));
  const seen = new Set<string>();
  function link(a: number, b: number) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    synapses.push({ a, b, weight: 0.25 + random() * 0.75 });
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  neurons.forEach((neuron, i) => {
    const near: [number, number][] = [];
    neurons.forEach((other, j) => {
      if (i === j) return;
      if (neuron.side && other.side && neuron.side !== other.side) return;
      const distance = Math.hypot(neuron.x - other.x, neuron.y - other.y, neuron.z - other.z);
      if (distance < 0.3) near.push([distance, j]);
    });
    near
      .sort((p, q) => p[0] - q[0])
      .slice(0, neuron.part === "deep" ? 5 : 3)
      .forEach(([, j]) => link(i, j));
  });
  const indices = neurons.map((_neuron, i) => i);
  const leftEdge = indices.filter((i) => neurons[i].side === -1 && Math.abs(neurons[i].x + 0.12) < 0.25);
  const rightEdge = indices.filter((i) => neurons[i].side === 1 && Math.abs(neurons[i].x - 0.12) < 0.25);
  for (let i = 0; i < 14 && leftEdge.length && rightEdge.length; i++) {
    const a = leftEdge[Math.floor(random() * leftEdge.length)];
    let best: number | null = null;
    let bestDistance = 9;
    rightEdge.forEach((j) => {
      const distance = Math.hypot(neurons[a].y - neurons[j].y, neurons[a].z - neurons[j].z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = j;
      }
    });
    if (best != null) link(a, best);
  }

  function pick(test: (neuron: Neuron) => boolean) {
    const candidates = indices.filter((i) => test(neurons[i]));
    return candidates[Math.floor(random() * candidates.length)];
  }
  const memories: Record<string, { node: number; text: string }> = {
    fastapi: { node: pick((p) => p.side === -1 && p.z > 0.45 && p.y > 0.1), text: "prefers fastapi" },
    postgres: { node: pick((p) => p.side === -1 && p.z > 0.2 && p.y < 0 && p.part === "cortex"), text: "uses postgres + pgvector" },
    typescript: { node: pick((p) => p.side === 1 && p.z > 0.4 && p.y > 0.2), text: "typescript on the frontend" },
    sentinel: { node: pick((p) => p.side === 1 && p.z < 0 && p.y > 0.25), text: "building sentinel" },
    marketsim: { node: pick((p) => p.side === 1 && p.part === "temporal"), text: "sentinel is a market simulator" },
    concise: { node: pick((p) => p.side === -1 && p.z < -0.2 && p.y > 0.2), text: "wants short answers" },
    darkmode: { node: pick((p) => p.part === "cerebellum"), text: "likes dark mode" },
    berlin: { node: pick((p) => p.side === -1 && p.part === "temporal"), text: "lives in berlin" },
  };
  const memoryByNode = new Map<number, string>();
  Object.entries(memories).forEach(([key, memory]) => memoryByNode.set(memory.node, key));

  let yaw = 0.9;
  let pitch = -0.18;
  let yawSpeed = 0.0012;
  let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
  let hover = -1;
  let pulses: Pulse[] = [];
  const activation = new Float32Array(neurons.length);
  let labels = new Map<number, Label>();
  let last = 0;
  let ambient = 0;
  let frameId = 0;
  const timers: number[] = [];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = {} as Record<ColorToken, string>;
  let monoFont = "monospace";

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    colorTokens.forEach((token) => {
      colors[token] = style.getPropertyValue(`--color-${token}`).trim();
    });
    monoFont = style.getPropertyValue("--font-mono").trim() || getComputedStyle(document.body).getPropertyValue("--font-mono").trim() || "monospace";
  }
  function color(token: ColorToken, alpha = 1) {
    return `oklch(${colors[token]} / ${alpha.toFixed(3)})`;
  }
  const themeObserver = new MutationObserver(readColors);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  readColors();

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const projected: Projected[] = neurons.map(() => ({ x: 0, y: 0, z: 0, scale: 1 }));
  function project() {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const size = Math.min(width * 0.42, height * 0.6);
    const camera = 3.2;
    neurons.forEach((neuron, i) => {
      const x = neuron.x * cy + neuron.z * sy;
      const z = -neuron.x * sy + neuron.z * cy;
      const y = neuron.y + 0.08;
      const y2 = y * cp - z * sp;
      const z2 = y * sp + z * cp;
      const k = camera / (camera - z2);
      projected[i].x = width / 2 + x * size * k;
      projected[i].y = height / 2 - y2 * size * k + height * 0.04;
      projected[i].z = z2;
      projected[i].scale = k;
    });
  }

  function fire(from: number, to: number, delay: number, recall: boolean) {
    pulses.push({ from, to, progress: -delay, speed: 0.0024 + random() * 0.0012, recall });
  }
  function wave(seeds: number[], maxDepth: number, recall: boolean) {
    const depth = new Map<number, number>();
    const queue: number[] = [];
    seeds.forEach((node) => {
      depth.set(node, 0);
      queue.push(node);
    });
    while (queue.length) {
      const a = queue.shift() as number;
      const level = depth.get(a) ?? 0;
      if (level >= maxDepth) continue;
      adjacency[a].forEach((b) => {
        if (!depth.has(b)) {
          depth.set(b, level + 1);
          queue.push(b);
          fire(a, b, level * 260, recall);
        }
      });
    }
    seeds.forEach((node) => {
      activation[node] = 1;
    });
  }

  function ask(index: number) {
    const query = brainQueries[index];
    labels = new Map();
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    const seeds = indices
      .filter((i) => neurons[i].z > 0.55)
      .sort(() => random() - 0.5)
      .slice(0, 4);
    wave(seeds, 7, true);
    callbacks.onClear();
    callbacks.onStatus("embedding · spreading activation…");
    query.hits.forEach(([key, score], position) => {
      timers.push(
        window.setTimeout(() => {
          const memory = memories[key];
          const above = score >= 0.5;
          activation[memory.node] = above ? 1.6 : 0.6;
          labels.set(memory.node, { text: memory.text, score, above, born: performance.now() });
          wave([memory.node], 2, above);
          callbacks.onHit({ text: memory.text, score, above });
          if (position === query.hits.length - 1) {
            const recalled = query.hits.filter(([, value]) => value >= 0.5).length;
            callbacks.onStatus(`${recalled} memories recalled · injected into the prompt`);
          }
        }, reduce ? 0 : 900 + position * 420),
      );
    });
  }

  function onPointerDown(event: PointerEvent) {
    drag = { x: event.clientX, y: event.clientY, yaw, pitch, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    const mx = event.clientX - bounds.left;
    const my = event.clientY - bounds.top;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      yaw = drag.yaw + dx * 0.008;
      pitch = Math.max(-1, Math.min(1, drag.pitch + dy * 0.006));
      yawSpeed = 0;
    }
    let best = -1;
    let bestDistance = 196;
    projected.forEach((point, i) => {
      if (point.z < -0.2) return;
      const distance = (point.x - mx) ** 2 + (point.y - my) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    hover = best;
    canvas.style.cursor = best >= 0 ? "pointer" : drag ? "grabbing" : "grab";
    if (best >= 0) {
      const memoryKey = memoryByNode.get(best);
      callbacks.onTip({
        title: memoryKey ? "memory" : `neuron #${best}`,
        text: memoryKey ? memories[memoryKey].text : `${adjacency[best].length} weights · σ(Σwx+b)`,
        x: projected[best].x,
        y: projected[best].y,
      });
    } else {
      callbacks.onTip(null);
    }
  }
  function onPointerUp() {
    if (drag && !drag.moved && hover >= 0) wave([hover], 6, true);
    drag = null;
    yawSpeed = 0.0012;
  }
  function onPointerLeave() {
    hover = -1;
    callbacks.onTip(null);
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") yaw -= 0.15;
    if (event.key === "ArrowRight") yaw += 0.15;
    if (reduce) {
      project();
      draw(performance.now());
    }
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("keydown", onKeyDown);

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(50, now - (last || now));
    last = now;
    if (!drag && !reduce) yaw += yawSpeed * dt;
    ambient -= dt;
    if (ambient < 0 && !reduce) {
      const origin = Math.floor(random() * neurons.length);
      adjacency[origin].forEach((target) => fire(origin, target, 0, false));
      activation[origin] = 0.8;
      ambient = 140;
    }
    const next: Pulse[] = [];
    pulses.forEach((pulse) => {
      pulse.progress += dt * pulse.speed;
      if (pulse.progress >= 1) {
        activation[pulse.to] = Math.max(activation[pulse.to], pulse.recall ? 1 : 0.7);
        if (!pulse.recall && random() < 0.35) {
          const neighbours = adjacency[pulse.to];
          const neighbour = neighbours[Math.floor(random() * neighbours.length)];
          if (neighbour !== pulse.from) next.push({ from: pulse.to, to: neighbour, progress: 0, speed: 0.0024 + random() * 0.0012, recall: false });
        }
      } else {
        next.push(pulse);
      }
    });
    pulses = next;
    const decay = Math.pow(0.9965, dt);
    for (let i = 0; i < activation.length; i++) activation[i] *= decay;
    project();
    draw(now);
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, width, height);
    const highlighted = new Set<number>();
    if (hover >= 0) {
      highlighted.add(hover);
      adjacency[hover].forEach((b) => highlighted.add(b));
    }
    ctx.lineCap = "round";
    synapses.forEach((synapse) => {
      const a = projected[synapse.a];
      const b = projected[synapse.b];
      const depth = ((a.z + b.z) / 2 + 1) / 2;
      const touched = hover === synapse.a || hover === synapse.b;
      const heat = Math.max(activation[synapse.a], activation[synapse.b]);
      ctx.strokeStyle = touched ? color("hot") : heat > 0.5 ? color("hot", 0.25 + 0.4 * Math.min(1, heat - 0.5)) : color("ink", 0.05 + 0.22 * depth * synapse.weight);
      ctx.lineWidth = touched ? 1.6 : 0.6 + synapse.weight * 0.7 * depth;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    pulses.forEach((pulse) => {
      if (pulse.progress <= 0) return;
      const a = projected[pulse.from];
      const b = projected[pulse.to];
      const head = pulse.progress;
      const tail = Math.max(0, head - 0.25);
      ctx.strokeStyle = pulse.recall ? color("hot") : color("ink", 0.75);
      ctx.lineWidth = pulse.recall ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
      ctx.lineTo(a.x + (b.x - a.x) * head, a.y + (b.y - a.y) * head);
      ctx.stroke();
      ctx.fillStyle = pulse.recall ? color("hot") : color("ink");
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * head, a.y + (b.y - a.y) * head, pulse.recall ? 2.4 : 1.6, 0, 6.283);
      ctx.fill();
    });
    [...indices]
      .sort((p, q) => projected[p].z - projected[q].z)
      .forEach((i) => {
        const point = projected[i];
        const depth = (point.z + 1) / 2;
        const level = Math.min(1, activation[i]);
        const isMemory = memoryByNode.has(i);
        const radius = (isMemory ? 4.2 : 2.6) * point.scale * (0.7 + 0.3 * depth);
        const lit = level > 0.4 || highlighted.has(i);
        ctx.globalAlpha = 0.35 + 0.65 * depth;
        if (level > 0.05) {
          ctx.fillStyle = color("hot", 0.18 * level);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius + 7 * level, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = lit ? color("hot") : color("paper");
        ctx.strokeStyle = lit ? color("hot") : color("ink");
        ctx.lineWidth = isMemory ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, 6.283);
        ctx.fill();
        ctx.stroke();
        if (isMemory && level <= 0.4) {
          ctx.fillStyle = color("ink");
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 0.4, 0, 6.283);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
    ctx.font = `500 12px ${monoFont}`;
    labels.forEach((label, node) => {
      const point = projected[node];
      const age = (now - label.born) / 1000;
      if (age > 7) {
        labels.delete(node);
        return;
      }
      const alpha = Math.min(1, age * 3) * Math.min(1, 7 - age) * (point.z > -0.3 ? 1 : 0.35);
      const text = `${label.text}  ${label.score.toFixed(2)}`;
      const textWidth = ctx.measureText(text).width;
      const lx = Math.max(4, Math.min(width - textWidth - 20, point.x + (point.x > width / 2 ? 18 : -18 - textWidth - 16)));
      const ly = Math.max(4, point.y - 22);
      ctx.globalAlpha = reduce ? 1 : alpha;
      ctx.strokeStyle = label.above ? color("hot") : color("ink-muted");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(Math.max(lx, Math.min(lx + textWidth + 16, point.x)), ly + 9);
      ctx.stroke();
      ctx.fillStyle = label.above ? color("hot") : color("paper");
      ctx.fillRect(lx, ly, textWidth + 16, 19);
      if (!label.above) ctx.strokeRect(lx + 0.5, ly + 0.5, textWidth + 15, 18);
      ctx.fillStyle = label.above ? color("on-hot") : color("ink-muted");
      ctx.fillText(text, lx + 8, ly + 13.5);
      ctx.globalAlpha = 1;
    });
  }

  frameId = requestAnimationFrame(frame);
  if (!reduce) timers.push(window.setTimeout(() => ask(0), 900));

  return {
    ask,
    count: `${neurons.length} neurons · ${synapses.length.toLocaleString("en")} weights`,
    stop() {
      cancelAnimationFrame(frameId);
      timers.forEach((timer) => window.clearTimeout(timer));
      themeObserver.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("keydown", onKeyDown);
    },
  };
}
