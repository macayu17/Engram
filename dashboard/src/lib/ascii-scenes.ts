export type Ink = "d" | "m" | "i" | "h";
export type InkPalette = Record<Ink, string>;
export type SceneState = Record<string, number>;
export type SceneKey = "synapse" | "vectors" | "extract" | "review" | "helix" | "torus";

export type Grid = {
  width: number;
  height: number;
  clear: () => void;
  put: (x: number, y: number, text: string, ink: Ink) => void;
  zput: (x: number, y: number, char: string, ink: Ink, depth: number) => void;
  html: (palette: InkPalette) => string;
};

export type Scene = {
  width: number;
  height: number;
  loop: number;
  caption: (time: number, state: SceneState) => string;
  frame: (grid: Grid, time: number, state: SceneState) => void;
};

export const scenePalette: InkPalette = {
  d: "text-scene-dim",
  m: "text-scene-muted",
  i: "text-scene-ink",
  h: "text-scene-hot",
};

export const paperPalette: InkPalette = {
  d: "text-line",
  m: "text-ink-muted",
  i: "text-ink",
  h: "text-hot",
};

function clamp(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function seg(time: number, start: number, end: number) {
  return clamp((time - start) / (end - start));
}

function repeat(char: string, count: number) {
  return count > 0 ? char.repeat(count) : "";
}

export function createGrid(width: number, height: number): Grid {
  let chars: string[][] = [];
  let inks: Ink[][] = [];
  let depths: number[][] = [];
  const grid: Grid = {
    width,
    height,
    clear() {
      chars = [];
      inks = [];
      depths = [];
      for (let y = 0; y < height; y++) {
        chars.push(new Array<string>(width).fill(" "));
        inks.push(new Array<Ink>(width).fill("d"));
        depths.push(new Array<number>(width).fill(-9));
      }
    },
    put(x, y, text, ink) {
      const col = Math.round(x);
      const row = Math.round(y);
      if (row < 0 || row >= height) return;
      for (let i = 0; i < text.length; i++) {
        const xx = col + i;
        if (xx >= 0 && xx < width) {
          chars[row][xx] = text[i];
          inks[row][xx] = ink;
        }
      }
    },
    zput(x, y, char, ink, depth) {
      const col = Math.round(x);
      const row = Math.round(y);
      if (row < 0 || row >= height || col < 0 || col >= width) return;
      if (depth >= depths[row][col]) {
        depths[row][col] = depth;
        chars[row][col] = char;
        inks[row][col] = ink;
      }
    },
    html(palette) {
      let out = "";
      for (let y = 0; y < height; y++) {
        let current: Ink | null = null;
        let buffer = "";
        for (let x = 0; x < width; x++) {
          const ink = inks[y][x];
          const char = chars[y][x];
          if (ink !== current) {
            if (current !== null) out += `<span class="${palette[current]}">${buffer}</span>`;
            current = ink;
            buffer = "";
          }
          buffer += char === "<" ? "&lt;" : char === "&" ? "&amp;" : char;
        }
        out += `<span class="${palette[current ?? "d"]}">${buffer}</span>\n`;
      }
      return out;
    },
  };
  grid.clear();
  return grid;
}

function slopeChar(dx: number, dy: number) {
  if (Math.abs(dy) < Math.abs(dx) * 0.4) return "─";
  if (Math.abs(dx) < Math.abs(dy) * 0.4) return "│";
  return dx * dy > 0 ? "╲" : "╱";
}

function line(grid: Grid, x0: number, y0: number, x1: number, y1: number, ink: Ink, char?: string | null, progress?: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  const glyph = char || slopeChar(dx, dy);
  const limit = progress == null ? steps : Math.floor(progress * steps);
  for (let i = 0; i <= steps; i++) grid.put(x0 + (dx * i) / steps, y0 + (dy * i) / steps, glyph, i <= limit ? ink : "d");
  return [x0 + (dx * limit) / steps, y0 + (dy * limit) / steps];
}

function box(grid: Grid, x: number, y: number, width: number, height: number, title: string, ink: Ink) {
  grid.put(x, y, `┌─ ${title} ${repeat("─", Math.max(1, width - title.length - 4) - 1)}┐`, ink);
  for (let row = 1; row < height - 1; row++) {
    grid.put(x, y + row, "│", ink);
    grid.put(x + width - 1, y + row, "│", ink);
  }
  grid.put(x, y + height - 1, `└${repeat("─", width - 2)}┘`, ink);
}

function typed(grid: Grid, x: number, y: number, lines: string[], progress: number, ink: Ink) {
  const total = lines.join("").length;
  const shown = Math.floor(progress * total);
  let used = 0;
  lines.forEach((text, index) => {
    const count = Math.max(0, Math.min(text.length, shown - used));
    grid.put(x, y + index, text.slice(0, count), ink);
    used += text.length;
  });
}

type Wire = [number, number, string, string?];

const synapseMemories = [
  { name: "prefers fastapi", score: 0.91, row: 2, tag: "fastapi" },
  { name: "building sentinel", score: 0.84, row: 4, tag: "sentinel" },
  { name: "wants short answers", score: 0.72, row: 6, tag: "concise" },
  { name: "asked about weather", score: 0.31, row: 10, tag: "" },
];

const synapse: Scene = {
  width: 84,
  height: 14,
  loop: 11000,
  caption: (time) =>
    `[ request · ${time < 2600 ? "embedding" : time < 4300 ? "scoring memories" : time < 6600 ? "building prompt" : "answering"} ]`,
  frame(grid, time) {
    function wire(cells: Wire[], progress: number, ink: Ink) {
      const lit = Math.floor(progress * cells.length);
      cells.forEach((cell, index) => grid.put(cell[0], cell[1], index < lit ? cell[2] : cell[3] || "·", index < lit ? ink : "d"));
      if (progress > 0 && progress < 1 && cells[lit]) grid.put(cells[lit][0], cells[lit][1], "●", "h");
    }
    box(grid, 0, 3, 20, 6, "stimulus", "m");
    const typing = seg(time, 200, 1600);
    typed(grid, 2, 4, ["what backend", "should i use?"], typing, "i");
    if (time < 2000 && Math.floor(time / 450) % 2 === 0) {
      const typedChars = typing * 25;
      grid.put(2 + Math.min(13, Math.floor(typedChars) - (typedChars > 12 ? 12 : 0)), typedChars > 12 ? 5 : 4, "▍", "h");
    }
    if (time > 1600) grid.put(2, 7, "embedded · 4ms", "m");
    wire([[20, 5, "─"], [21, 5, "─"], [22, 5, "─"], [23, 5, "┤", "┤"]], seg(time, 1800, 2200), "h");
    const spread = seg(time, 2200, 2600);
    wire([[23, 4, "│"], [23, 3, "│"], [23, 2, "┌", "┌"]], spread, "h");
    wire([[23, 6, "│"], [23, 7, "│"], [23, 8, "│"], [23, 9, "│"], [23, 10, "└", "└"]], spread, "h");
    grid.put(27, 0, "neurons · scope:sentinel", "m");
    synapseMemories.forEach((memory, index) => {
      const start = 2500 + index * 280;
      const progress = seg(time, start, start + 250);
      const scoring = seg(time, start + 200, start + 900);
      const above = memory.score >= 0.5;
      const done = scoring >= 1;
      if (memory.row !== 10) grid.put(23, memory.row, memory.row === 2 ? "┌" : "├", progress > 0 ? "h" : "d");
      wire([[24, memory.row, "─"], [25, memory.row, above && done ? "◉" : "○", "○"]], progress, above ? "h" : "m");
      grid.put(27, memory.row, `${memory.name}                    `.slice(0, 20), scoring > 0 ? (above || !done ? "i" : "m") : "d");
      grid.put(48, memory.row, scoring > 0 ? (memory.score * scoring).toFixed(2) : "0.00", scoring > 0 ? (above ? "h" : "m") : "d");
      const bars = Math.round(memory.score * 10 * scoring);
      grid.put(53, memory.row, repeat("█", bars) + repeat("░", 10 - bars), above ? "h" : "m");
      if (done && !above) grid.put(64, memory.row, "✕", "m");
    });
    const threshold = "─ ─ ─ ─ ─ ─ threshold 0.50 ─ ─ ─ ─ ─ ─ ─ ";
    grid.put(27, 8, threshold.slice(0, Math.floor(seg(time, 3300, 3900) * threshold.length)), "m");
    const out = seg(time, 4300, 5000);
    [2, 4, 6].forEach((row) => wire([[64, row, "─"], [65, row, "─"], [66, row, row === 2 ? "┐" : row === 6 ? "┘" : "┼", "·"]], out, "h"));
    wire([[66, 3, "│"], [66, 5, "│"]], out, "h");
    wire([[67, 4, "─"], [68, 4, "▶", "·"]], seg(time, 4900, 5200), "h");
    box(grid, 70, 0, 14, 7, "prompt", "m");
    synapseMemories
      .filter((memory) => memory.tag)
      .forEach((memory, index) => {
        const progress = seg(time, 5200 + index * 260, 5400 + index * 260);
        if (progress > 0) grid.put(72, 1 + index, `+ ${memory.tag}`.slice(0, Math.max(1, Math.ceil(progress * 11))), "h");
      });
    if (time > 6000) grid.put(72, 4, "user: what…", "i");
    if (time > 6100) grid.put(72, 5, "→ gpt-4o", "m");
    wire([[76, 7, "│"], [76, 8, "▼", "·"]], seg(time, 6300, 6600), "h");
    box(grid, 70, 9, 14, 5, "model", "m");
    typed(grid, 71, 10, ["use fastapi.", "you already", "do."], seg(time, 6700, 8200), "i");
  },
};

type VectorPoint = { x: number; y: number; phase: number; label?: string };

const vectorPoints: VectorPoint[] = (() => {
  let seed = 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clusters: [number, number][] = [
    [18, 9],
    [58, 7],
    [44, 18],
  ];
  const points: VectorPoint[] = [];
  clusters.forEach(([cx, cy]) => {
    for (let i = 0; i < 16; i++) {
      const angle = random() * 6.283;
      const distance = Math.sqrt(random()) * 6;
      points.push({ x: cx + Math.cos(angle) * distance * 1.8, y: cy + Math.sin(angle) * distance * 0.6, phase: random() * 6.28 });
    }
  });
  const labels: [number, number, string][] = [
    [16, 8, "fastapi"],
    [23, 11, "typescript"],
    [13, 12, "postgres"],
    [56, 5, "sentinel"],
    [62, 9, "market sim"],
    [40, 17, "berlin"],
    [48, 20, "dark mode"],
  ];
  labels.forEach(([x, y, label], index) => {
    points[index * 2].x = x;
    points[index * 2].y = y;
    points[index * 2].label = label;
  });
  return points;
})();

const vectors: Scene = {
  width: 80,
  height: 24,
  loop: 9000,
  caption: (_time, state) => `[ cosine search · ${state.recalled || 0} recalled ]`,
  frame(grid, time, state) {
    const qx = 20;
    const qy = 9;
    const drop = seg(time, 300, 1000);
    const radius = seg(time, 1100, 3400) * 5.5;
    grid.put(0, 0, "embedding space · 384-d → 2-d", "m");
    grid.put(grid.width - 18, grid.height - 1, "bge-small-en-v1.5", "m");
    grid.put(10, 2, "[ code ]", "d");
    grid.put(56, 1, "[ projects ]", "d");
    grid.put(38, 22, "[ personal ]", "d");
    if (radius > 0) {
      for (let angle = 0; angle < 6.283; angle += 0.07) grid.put(qx + Math.cos(angle) * radius * 2, qy + Math.sin(angle) * radius, "·", radius >= 5.4 ? "m" : "h");
    }
    const placed = vectorPoints.map((point) => {
      const x = point.x + Math.sin(time * 0.0007 + point.phase) * 0.5;
      const y = point.y + Math.cos(time * 0.0006 + point.phase) * 0.25;
      const dx = (x - qx) / 2;
      const dy = y - qy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return { point, x, y, distance, inside: radius > 0 && distance <= radius };
    });
    placed.forEach((item) => {
      if (item.inside && time > 3500 && item.point.label) line(grid, qx, qy, item.x, item.y, "h", "·");
    });
    let recalled = 0;
    placed.forEach((item) => {
      grid.put(item.x, item.y, item.inside ? "●" : "o", item.inside ? "h" : "i");
      if (item.inside) recalled++;
    });
    placed.forEach((item) => {
      if (item.point.label) {
        const score = item.inside && time > 3500 ? ` ${(1 - item.distance / 12).toFixed(2)}` : "";
        grid.put(item.x + 2, item.y, item.point.label + score, item.inside ? "h" : "i");
      }
    });
    state.recalled = recalled;
    if (drop > 0) {
      const dropY = Math.round(qy - (1 - drop) * 7);
      grid.put(qx, dropY, "◆", "h");
      grid.put(qx + 3, dropY - 2, '"what backend should i use?"', "h");
    }
  },
};

const chat: [string, string][] = [
  ["user", "i always build python apis with fastapi"],
  ["engram", "noted."],
  ["user", "the sentinel repo is my market simulator"],
  ["user", "also it's raining in berlin today"],
];

const picks = [
  { line: 0, word: "fastapi", to: [62, 3], card: "prefers fastapi" },
  { line: 2, word: "sentinel", to: [62, 8], card: "project: sentinel" },
];

const extract: Scene = {
  width: 84,
  height: 16,
  loop: 9500,
  caption: (time) =>
    `[ ${time < 2600 ? "reading the conversation" : time < 5200 ? "extracting durable facts" : "2 memories · pending review"} ]`,
  frame(grid, time) {
    grid.put(0, 0, "conversation", "m");
    chat.forEach(([speaker, text], index) => {
      const progress = seg(time, 200 + index * 550, 700 + index * 550);
      grid.put(0, 2 + index * 2, `${speaker}: ${text}`.slice(0, Math.floor(progress * 60)), speaker === "engram" ? "m" : "i");
      if (index === 3 && time > 3600) grid.put(0, 2 + index * 2, `${speaker}: ${text}`.replace(/[^ ]/g, "·"), "d");
    });
    grid.put(58, 0, "memory · pending", "m");
    picks.forEach((pick, index) => {
      const source = `${chat[pick.line][0]}: ${chat[pick.line][1]}`;
      const sx = source.indexOf(pick.word);
      const sy = 2 + pick.line * 2;
      if (time > 2600 + index * 300) grid.put(sx, sy, pick.word, "h");
      const [bx, by] = pick.to;
      const show = seg(time, 3000 + index * 500, 4200 + index * 500);
      if (show > 0) {
        for (let j = 0; j < pick.word.length; j++) {
          const p = clamp(show * 1.4 - j * 0.04);
          grid.put(sx + j + (bx + 2 - sx) * p, sy + (by + 1 - sy) * p - Math.sin(p * 3.14) * 2, pick.word[j], "h");
        }
      }
      if (show >= 1) {
        box(grid, bx, by, 22, 4, index ? "mem_91ad" : "mem_8f2c", "m");
        grid.put(bx + 2, by + 1, pick.card, "i");
        const approved = time > 6200 + index * 500;
        grid.put(bx + 2, by + 2, approved ? "✓ approved" : "○ pending ", approved ? "h" : "m");
      }
    });
    if (time > 3600) {
      grid.put(58, 13, '✕ "raining in berlin"', "m");
      grid.put(60, 14, "not durable · skipped", "d");
    }
  },
};

const helixMemories = ["prefers fastapi", "project: sentinel", "short answers", "uses postgres", "typescript on web", "dark mode", "lives in berlin", "pgvector"];

const helix: Scene = {
  width: 76,
  height: 26,
  loop: 16000,
  caption: () => "[ long-term store · consolidating ]",
  frame(grid, time) {
    const cx = 26;
    const radius = 8;
    const spin = time * 0.0012;
    const pulse = ((time / 60) % (grid.height + 10)) - 5;
    for (let y = 0; y < grid.height; y++) {
      const phase = y * 0.42 + spin;
      const ax = cx + Math.cos(phase) * radius * 2;
      const az = Math.sin(phase);
      const bx = cx - Math.cos(phase) * radius * 2;
      const bz = -az;
      const near = Math.abs(y - pulse) < 1.5;
      if (y % 2 === 0) {
        const low = Math.min(ax, bx);
        const high = Math.max(ax, bx);
        for (let x = low + 1; x < high; x += 1) grid.zput(x, y, "-", near ? "h" : "d", -0.5);
      }
      grid.zput(ax, y, az > 0.3 ? "@" : az > -0.3 ? "o" : ".", near ? "h" : az > 0 ? "i" : "m", az);
      grid.zput(bx, y, bz > 0.3 ? "@" : bz > -0.3 ? "o" : ".", near ? "h" : bz > 0 ? "i" : "m", bz);
      if (y % 3 === 1) {
        const memory = helixMemories[Math.floor(y / 3) % helixMemories.length];
        const front = Math.abs(Math.cos(phase)) < 0.5;
        grid.put(cx + radius * 2 + 6, y, (near ? "◆ " : "· ") + memory, near ? "h" : front ? "i" : "d");
      }
    }
  },
};

const reviewCards: [string, boolean][] = [
  ["prefers fastapi", true],
  ["raining in berlin", false],
  ["project: sentinel", true],
  ["said 'thanks'", false],
  ["short answers", true],
];

const review: Scene = {
  width: 84,
  height: 15,
  loop: 15000,
  caption: (_time, state) => `[ review queue · ${state.approved || 0} approved · ${state.forgotten || 0} forgotten ]`,
  frame(grid, time, state) {
    const belt = 8;
    const gate = 40;
    state.approved = 0;
    state.forgotten = 0;
    for (let x = 0; x < grid.width; x++) grid.put(x, belt + 1, (x + Math.floor(time / 120)) % 4 === 0 ? "╪" : "═", "d");
    grid.put(gate - 1, 0, "▼ review", "m");
    for (let y = 1; y < belt + 1; y++) if (y % 2) grid.put(gate + 4, y, "┊", "m");
    grid.put(grid.width - 10, 12, "[ store ]", "m");
    grid.put(2, 12, "[ forget ]", "d");
    reviewCards.forEach(([label, keep], index) => {
      const local = time - index * 2600;
      if (local < 0) return;
      const arrive = (gate - 8 + 24) / 0.02;
      let x = -24 + local * 0.02;
      const hold = Math.max(0, Math.min(1200, local - arrive));
      if (x > gate - 8) x = gate - 8 + Math.max(0, local - arrive - 1200) * 0.02;
      const decided = hold >= 600;
      let y = belt - 3;
      if (decided && !keep && x > gate - 6) y += (x - gate + 6) * 0.5;
      if (decided) {
        if (keep) state.approved++;
        else state.forgotten++;
      }
      if (y > 13 || x > grid.width) return;
      const ink: Ink = decided ? (keep ? "h" : "d") : "i";
      grid.put(x, y, `┌${repeat("─", 22)}┐`, ink);
      grid.put(x, y + 1, `│ ${`${label}                    `.slice(0, 20)} │`, ink);
      grid.put(x, y + 2, `└${repeat("─", 22)}┘`, ink);
      if (decided) grid.put(x + 2, y - 1, keep ? "✓ approved" : "✕ forgotten", keep ? "h" : "m");
    });
  },
};

const torus: Scene = {
  width: 76,
  height: 26,
  loop: 20000,
  caption: () => "[ consolidation loop · short-term → long-term ]",
  frame(grid, time) {
    const angleA = time * 0.0007;
    const angleB = time * 0.0003;
    const cA = Math.cos(angleA);
    const sA = Math.sin(angleA);
    const cB = Math.cos(angleB);
    const sB = Math.sin(angleB);
    const band = (time * 0.0018) % 6.283;
    const tube = 1;
    const ring = 2.1;
    const distance = 6;
    const scale = (grid.height * 0.9 * distance * 3) / (8 * (tube + ring));
    for (let theta = 0; theta < 6.283; theta += 0.09) {
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      for (let phi = 0; phi < 6.283; phi += 0.03) {
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const cx = ring + tube * ct;
        const cy = tube * st;
        const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
        const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
        const z = distance + cA * cx * sp + cy * sA;
        const ooz = 1 / z;
        const xp = grid.width / 2 + scale * ooz * x * 2;
        const yp = grid.height / 2 - scale * ooz * y;
        const light = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
        const gap = Math.abs(((phi - band + 9.42) % 6.283) - 3.14);
        const hot = gap > 2.95;
        const char = light > 0 ? ".,-~:;=!*#$@"[Math.min(11, Math.floor(light * 8))] : ".";
        grid.zput(xp, yp, hot ? "@" : char, hot ? "h" : light > 0.6 ? "i" : "m", ooz);
      }
    }
  },
};

export const scenes: Record<SceneKey, Scene> = { synapse, vectors, extract, review, helix, torus };
