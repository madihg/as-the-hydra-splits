// as the hydra - branching tree (split-driven)
// public api: new Tree(canvas).init() then tree.splitOnce() per realtime event.

export const TREE_CONFIG = {
  rootRadius: 6,
  pulseAlphaMin: 0.4,
  pulseAlphaMax: 0.85,
  pulsePeriodMs: 3000,

  // each split bifurcates into 2 or 3 branches (weighted)
  branchCountWeights: { 2: 0.7, 3: 0.3 },

  branchLenMin: 70,
  branchLenMax: 130,
  branchAngleSpread: Math.PI * 0.6,

  growthDurationMs: 1500,
  growthEase: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic

  greyLevels: [
    "rgba(0,0,0,1)",
    "rgba(0,0,0,0.55)",
    "rgba(0,0,0,0.35)",
    "rgba(0,0,0,0.22)",
    "rgba(0,0,0,0.13)",
    "rgba(0,0,0,0.08)",
  ],

  canvasPadding: 40,
  nodeMinDistance: 20,
  maxBranchPlacementAttempts: 12,
};

let _nextId = 0;
const newId = () => _nextId++;

export class Tree {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cfg = { ...TREE_CONFIG, ...opts };

    this.nodes = new Map();
    this.edges = []; // { fromId, toId, bornAt, isChosen, greyLevel }
    this.activeLeafId = null;
    this.rootId = null;
    this.splitsApplied = 0;

    this.reducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  init() {
    this._resize();
    window.addEventListener("resize", () => this._resize());

    const { width, height } = this._cssSize();
    const root = this._mkNode(width / 2, height / 2, null, true);
    root.isRoot = true;
    this.nodes.set(root.id, root);
    this.rootId = root.id;
    this.activeLeafId = root.id;

    requestAnimationFrame((t) => this._render(t));
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _cssSize() {
    return {
      width: parseFloat(this.canvas.style.width) || this.canvas.width,
      height: parseFloat(this.canvas.style.height) || this.canvas.height,
    };
  }

  _mkNode(x, y, parentId, isChosen) {
    return {
      id: newId(),
      x,
      y,
      parentId,
      bornAt: performance.now(),
      isChosen: !!isChosen,
      isRoot: false,
      greyLevel: 0,
    };
  }

  // --- public ---

  reset() {
    this.nodes.clear();
    this.edges = [];
    this.activeLeafId = null;
    this.rootId = null;
    this.splitsApplied = 0;

    const { width, height } = this._cssSize();
    const root = this._mkNode(width / 2, height / 2, null, true);
    root.isRoot = true;
    this.nodes.set(root.id, root);
    this.rootId = root.id;
    this.activeLeafId = root.id;
  }

  // call once per realtime split event. lineId is opaque, used as data.
  splitOnce(lineId) {
    if (!this.activeLeafId) return;
    const parent = this.nodes.get(this.activeLeafId);
    if (!parent) return;

    const branchCount = this._weightedPick(this.cfg.branchCountWeights);
    const positions = this._planBranches(parent, branchCount);

    if (positions.length === 0) return;

    // step the previously-chosen frontier up one grey level
    for (const [, n] of this.nodes) {
      if (!n.isChosen && !n.isRoot) {
        n.greyLevel = Math.min(n.greyLevel + 1, 5);
      }
    }
    for (const e of this.edges) {
      if (!e.isChosen) e.greyLevel = Math.min(e.greyLevel + 1, 5);
    }

    // root loses its primacy after first split
    if (parent.isRoot) {
      parent.isChosen = true;
    }

    const chosenIdx = Math.floor(Math.random() * positions.length);
    let newActiveId = null;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const isChosen = i === chosenIdx;
      const child = this._mkNode(pos.x, pos.y, parent.id, isChosen);
      child.greyLevel = isChosen ? 0 : 1;
      child.lineId = isChosen ? lineId : null;
      this.nodes.set(child.id, child);
      this.edges.push({
        fromId: parent.id,
        toId: child.id,
        bornAt: performance.now(),
        isChosen,
        greyLevel: isChosen ? 0 : 1,
      });
      if (isChosen) newActiveId = child.id;
    }

    this.activeLeafId = newActiveId;
    this.splitsApplied++;
  }

  _weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return parseInt(k);
    }
    return parseInt(entries[entries.length - 1][0]);
  }

  _planBranches(parent, count) {
    const { width, height } = this._cssSize();
    const pad = this.cfg.canvasPadding;
    const minLen = this.cfg.branchLenMin;
    const maxLen = this.cfg.branchLenMax;

    // base direction = away from parent's parent (or random if root)
    let baseAngle = Math.random() * Math.PI * 2;
    if (parent.parentId !== null) {
      const grand = this.nodes.get(parent.parentId);
      if (grand) baseAngle = Math.atan2(parent.y - grand.y, parent.x - grand.x);
    }

    const spread = this.cfg.branchAngleSpread;
    const positions = [];

    for (let i = 0; i < count; i++) {
      const slot = count === 1 ? 0 : i / (count - 1) - 0.5;
      const targetAngle = baseAngle + slot * spread;

      let placed = null;
      for (
        let attempt = 0;
        attempt < this.cfg.maxBranchPlacementAttempts;
        attempt++
      ) {
        const jitter = (Math.random() - 0.5) * 0.4;
        const angle = targetAngle + jitter;
        const length = minLen + Math.random() * (maxLen - minLen);
        const x = parent.x + Math.cos(angle) * length;
        const y = parent.y + Math.sin(angle) * length;

        if (x < pad || x > width - pad || y < pad || y > height - pad) {
          continue;
        }

        let overlap = false;
        for (const [, n] of this.nodes) {
          const dx = n.x - x;
          const dy = n.y - y;
          if (dx * dx + dy * dy < this.cfg.nodeMinDistance ** 2) {
            overlap = true;
            break;
          }
        }
        if (!overlap) {
          placed = { x, y };
          break;
        }
      }

      if (!placed) {
        // last-resort: place at edge of canvas in target direction
        const length = (minLen + maxLen) / 2;
        let x = parent.x + Math.cos(targetAngle) * length;
        let y = parent.y + Math.sin(targetAngle) * length;
        x = Math.max(pad, Math.min(width - pad, x));
        y = Math.max(pad, Math.min(height - pad, y));
        placed = { x, y };
      }

      positions.push(placed);
    }

    return positions;
  }

  // --- render ---

  _render(timestamp) {
    const { width, height } = this._cssSize();
    this.ctx.clearRect(0, 0, width, height);

    // draw grey edges first, then chosen
    for (const e of this.edges) {
      if (!e.isChosen) this._drawEdge(e, timestamp);
    }
    for (const e of this.edges) {
      if (e.isChosen) this._drawEdge(e, timestamp);
    }

    // draw nodes
    for (const [, n] of this.nodes) {
      if (!n.isChosen && !n.isRoot) this._drawNode(n, timestamp);
    }
    for (const [, n] of this.nodes) {
      if (n.isChosen || n.isRoot) this._drawNode(n, timestamp);
    }

    requestAnimationFrame((t) => this._render(t));
  }

  _drawEdge(edge, timestamp) {
    const from = this.nodes.get(edge.fromId);
    const to = this.nodes.get(edge.toId);
    if (!from || !to) return;

    const elapsed = timestamp - edge.bornAt;
    let t = 1;
    if (elapsed < this.cfg.growthDurationMs) {
      const raw = elapsed / this.cfg.growthDurationMs;
      t = this.reducedMotion ? 1 : this.cfg.growthEase(raw);
    }

    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    this.ctx.save();
    this.ctx.strokeStyle =
      this.cfg.greyLevels[edge.greyLevel] || this.cfg.greyLevels[5];
    this.ctx.lineWidth = edge.isChosen ? 2 : 1.2;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _drawNode(node, timestamp) {
    const elapsed = timestamp - node.bornAt;
    let appear = 1;
    if (elapsed < this.cfg.growthDurationMs) {
      appear = this.reducedMotion
        ? 1
        : this.cfg.growthEase(elapsed / this.cfg.growthDurationMs);
    }

    let radius = node.isRoot
      ? this.cfg.rootRadius
      : node.id === this.activeLeafId
        ? 5
        : 3.5;
    radius *= appear;

    let color = this.cfg.greyLevels[node.greyLevel] || this.cfg.greyLevels[5];

    // pulsing root or active leaf when nothing has happened yet
    if (
      (node.isRoot && this.splitsApplied === 0) ||
      (node.id === this.activeLeafId && this.edges.length === 0)
    ) {
      const phase =
        (Math.sin((timestamp / this.cfg.pulsePeriodMs) * Math.PI * 2) + 1) / 2;
      const alpha =
        this.cfg.pulseAlphaMin +
        (this.cfg.pulseAlphaMax - this.cfg.pulseAlphaMin) * phase;
      color = `rgba(0,0,0,${alpha.toFixed(3)})`;
    }

    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y, Math.max(0.5, radius), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
}
