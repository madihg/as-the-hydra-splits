// ============================================================
// As The Hydra — Interactive branching tree
// ============================================================

// --- Constants ---

const GREY_LEVELS = [
  "#000000", // 0: chosen path
  "#555555", // 1: just unchosen
  "#888888", // 2: medium
  "#AAAAAA", // 3: light
  "#CCCCCC", // 4: very light
  "#E8E8E8", // 5: barely visible
];

const MAX_GREY_DEPTH = 4;
const BRANCH_LEN_MIN = 50;
const BRANCH_LEN_MAX = 100;
const GREY_BRANCH_LEN_MIN = 30;
const GREY_BRANCH_LEN_MAX = 60;
const FRONTIER_HIT_RADIUS = 18;
const EDGE_HIT_RADIUS = 10;
const CLICK_DEBOUNCE_MS = 200;
const MIN_FIRST_CLICK_DIST = 40;
const NODE_MIN_DISTANCE = 15;
const CANVAS_PADDING = 20;

// --- Poem Lines ---

let poemLines = [
  "The graying lines of longing",
  "The branches othered",
  "deprecating futures",
  "Composting futures",
  "Wilting once",
  "Fell from the hand of possibility",
  "All here crammed into heaven",
  "Larking home",
  "Cosplay of the sedentary type",
  "Lineage of eccentrics",
  "Desire foregone",
  "The roots muttering",
  "Distance from catastrophe",
  "In a recent retrospective in Berlin, a video of Joseph Beuys drives home the importance of warmth when incubating the future",
  "Heartbreak, the nomadic art form par excellence",
  "How will *you* be reborn? Yenna to Philippa, The witcher",
];
let poemShuffled = [];
let poemIndex = 0;

function loadPoem() {
  shufflePoem();
}

function shufflePoem() {
  poemShuffled = [...poemLines];
  for (let i = poemShuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poemShuffled[i], poemShuffled[j]] = [poemShuffled[j], poemShuffled[i]];
  }
  poemIndex = 0;
}

function nextPoemLine() {
  if (poemIndex >= poemShuffled.length) shufflePoem();
  return poemShuffled[poemIndex++];
}

// --- Data Model ---

let nextNodeId = 0;

function createNode(x, y, parentId, creationStep, state) {
  return {
    id: nextNodeId++,
    x,
    y,
    parentId,
    childIds: [],
    state: state || "frontier",
    creationStep,
    greyLevel: 0,
    isFrontier: false,
    glowing: false,
  };
}

function createEdge(fromId, toId, creationStep, lineStyle) {
  return {
    fromId,
    toId,
    state: "dotted",
    creationStep,
    greyLevel: 0,
    lineStyle: lineStyle || "dotted",
  };
}

// --- Tree State ---

const tree = {
  nodes: new Map(),
  edges: [],
  currentStep: 0,
  snapshots: [],
  frontierIds: new Set(),
  chosenPath: [],
  rootId: null,
  activeNodeId: null,
};

function addNode(node) {
  tree.nodes.set(node.id, node);
  if (node.parentId !== null) {
    const parent = tree.nodes.get(node.parentId);
    if (parent) parent.childIds.push(node.id);
  }
  return node;
}

function addEdge(edge) {
  tree.edges.push(edge);
  return edge;
}

function takeSnapshot(poemLine) {
  const clonedNodes = new Map();
  for (const [id, n] of tree.nodes) {
    clonedNodes.set(id, { ...n, childIds: [...n.childIds] });
  }
  const clonedEdges = tree.edges.map((e) => ({ ...e }));
  tree.snapshots.push({
    step: tree.currentStep,
    nodes: clonedNodes,
    edges: clonedEdges,
    poemLine,
  });
}

// --- Geometry ---

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function clampToCanvas(x, y, w, h) {
  return {
    x: Math.max(CANVAS_PADDING, Math.min(w - CANVAS_PADDING, x)),
    y: Math.max(CANVAS_PADDING, Math.min(h - CANVAS_PADDING, y)),
  };
}

function randomBranchPosition(origin, minLen, maxLen, canvasW, canvasH) {
  const angle = Math.random() * Math.PI * 2;
  const length = minLen + Math.random() * (maxLen - minLen);
  let x = origin.x + Math.cos(angle) * length;
  let y = origin.y + Math.sin(angle) * length;
  const clamped = clampToCanvas(x, y, canvasW, canvasH);
  return clamped;
}

function computeMirror(origin, target) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return { x: origin.x - dx, y: origin.y + dy };
}

function hasOverlap(x, y, minDist) {
  for (const [, n] of tree.nodes) {
    if (dist(x, y, n.x, n.y) < minDist) return true;
  }
  return false;
}

function safeRandomBranch(origin, minLen, maxLen, canvasW, canvasH) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pos = randomBranchPosition(origin, minLen, maxLen, canvasW, canvasH);
    if (!hasOverlap(pos.x, pos.y, NODE_MIN_DISTANCE)) return pos;
  }
  return randomBranchPosition(origin, minLen, maxLen, canvasW, canvasH);
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

// --- Grey Deprecation ---

function getGreyDepth(node) {
  let depth = 0;
  let current = node;
  while (current.state === "grey-child" || current.state === "unchosen") {
    depth++;
    if (current.parentId === null) break;
    current = tree.nodes.get(current.parentId);
    if (!current) break;
  }
  return depth;
}

function deprecateGreys() {
  for (const edge of tree.edges) {
    if (edge.state !== "solid-chosen") {
      edge.greyLevel = Math.min(edge.greyLevel + 1, 5);
    }
  }
  for (const [, node] of tree.nodes) {
    if (
      node.state !== "chosen" &&
      node.state !== "frontier" &&
      node.state !== "root"
    ) {
      node.greyLevel = Math.min(node.greyLevel + 1, 5);
    }
  }
}

function spawnGreyChildren(step, canvasW, canvasH) {
  const leaves = [];
  for (const [, n] of tree.nodes) {
    if (n.childIds.length === 0 && !n.isFrontier && n.state !== "frontier") {
      if (getGreyDepth(n) < MAX_GREY_DEPTH) {
        leaves.push(n);
      }
    }
  }

  for (const leaf of leaves) {
    for (let i = 0; i < 2; i++) {
      const pos = safeRandomBranch(
        leaf,
        GREY_BRANCH_LEN_MIN,
        GREY_BRANCH_LEN_MAX,
        canvasW,
        canvasH,
      );
      const child = createNode(pos.x, pos.y, leaf.id, step, "grey-child");
      child.greyLevel = 1;
      addNode(child);
      const edge = createEdge(leaf.id, child.id, step, "dotted");
      edge.state = "grey";
      edge.greyLevel = 1;
      addEdge(edge);
    }
  }
}

// --- Shudder Animation ---

const shudders = [];

function triggerShudder(edge) {
  shudders.push({ edge, startTime: performance.now(), duration: 400 });
}

function getShudderOffset(shudder, timestamp) {
  const elapsed = timestamp - shudder.startTime;
  if (elapsed > shudder.duration) return null;
  const progress = elapsed / shudder.duration;
  const decay = 1 - progress;
  return Math.sin(elapsed * 0.05) * 4 * decay;
}

// --- Renderer ---

const canvas = document.getElementById("tree-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * 0.8 * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight * 0.8 + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawEdge(edge, nodesMap, timestamp) {
  const from = nodesMap.get(edge.fromId);
  const to = nodesMap.get(edge.toId);
  if (!from || !to) return;

  const color =
    edge.state === "solid-chosen"
      ? "#000"
      : GREY_LEVELS[edge.greyLevel] || GREY_LEVELS[5];
  const width = edge.state === "solid-chosen" ? 2.5 : 1.5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;

  if (edge.lineStyle === "dotted") {
    ctx.setLineDash([3, 5]);
  } else {
    ctx.setLineDash([]);
  }

  let fromX = from.x,
    fromY = from.y,
    toX = to.x,
    toY = to.y;

  // Apply shudder if active
  const activeShudder = shudders.find((s) => s.edge === edge);
  if (activeShudder) {
    const offset = getShudderOffset(activeShudder, timestamp);
    if (offset !== null) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      // Offset midpoint
      const midX = (fromX + toX) / 2 + nx * offset;
      const midY = (fromY + toY) / 2 + ny * offset;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.quadraticCurveTo(midX, midY, toX, toY);
      ctx.stroke();
      ctx.restore();
      return;
    }
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

function drawNode(node, timestamp) {
  const color = GREY_LEVELS[node.greyLevel] || GREY_LEVELS[5];
  let radius = 3;
  if (node.state === "chosen" || node.state === "root") radius = 4;
  if (node.isFrontier || node.state === "frontier") radius = 5;
  if (node.id === tree.activeNodeId) radius = 6;

  if (node.glowing) {
    drawGlow(node.x, node.y, radius, timestamp);
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(x, y, baseRadius, timestamp) {
  const phase = (Math.sin(timestamp * 0.003) + 1) / 2;
  const glowRadius = baseRadius + 6 + 4 * phase;
  const alpha = 0.1 + 0.12 * phase;

  const grad = ctx.createRadialGradient(x, y, baseRadius, x, y, glowRadius);
  grad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawFromData(nodesMap, edgesArr, timestamp) {
  const w = canvas.style.width
    ? parseInt(canvas.style.width)
    : window.innerWidth;
  const h = canvas.style.height
    ? parseInt(canvas.style.height)
    : window.innerHeight * 0.8;

  ctx.clearRect(0, 0, w, h);

  // Draw edges: grey first, then chosen
  for (const edge of edgesArr) {
    if (edge.state !== "solid-chosen") {
      drawEdge(edge, nodesMap, timestamp);
    }
  }
  for (const edge of edgesArr) {
    if (edge.state === "solid-chosen") {
      drawEdge(edge, nodesMap, timestamp);
    }
  }

  // Draw nodes: grey first, then chosen/frontier
  const greyNodes = [];
  const chosenNodes = [];
  const frontierNodes = [];

  for (const [, node] of nodesMap) {
    if (node.isFrontier || node.state === "frontier") {
      frontierNodes.push(node);
    } else if (node.state === "chosen" || node.state === "root") {
      chosenNodes.push(node);
    } else {
      greyNodes.push(node);
    }
  }

  for (const n of greyNodes) drawNode(n, timestamp);
  for (const n of chosenNodes) drawNode(n, timestamp);
  for (const n of frontierNodes) drawNode(n, timestamp);
}

// --- Animation Loop ---

let viewingStep = -1; // -1 means current

function render(timestamp) {
  // Clean up expired shudders
  for (let i = shudders.length - 1; i >= 0; i--) {
    if (timestamp - shudders[i].startTime > shudders[i].duration) {
      shudders.splice(i, 1);
    }
  }

  if (viewingStep >= 0 && viewingStep < tree.snapshots.length) {
    const snap = tree.snapshots[viewingStep];
    drawFromData(snap.nodes, snap.edges, timestamp);
  } else {
    drawFromData(tree.nodes, tree.edges, timestamp);
  }

  requestAnimationFrame(render);
}

// --- Poem Strip ---

const poemStrip = document.getElementById("poem-strip");
const timeTravelIndicator = document.getElementById("time-travel-indicator");

function addPoemRect(line, step) {
  const rect = document.createElement("div");
  rect.className = "poem-rect";
  rect.dataset.step = step;
  rect.innerHTML = `<span class="poem-text">${escapeHtml(line)}</span>`;

  rect.addEventListener("click", () => {
    scrollToStep(step);
  });

  poemStrip.appendChild(rect);

  // Auto-scroll to newest
  requestAnimationFrame(() => {
    rect.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  });

  updateActivePoemRect(step);
}

function updateActivePoemRect(activeStep) {
  const rects = poemStrip.querySelectorAll(".poem-rect");
  rects.forEach((r) => {
    r.classList.toggle("active", parseInt(r.dataset.step) === activeStep);
  });
}

function scrollToStep(step) {
  viewingStep = step;
  updateActivePoemRect(step);

  const isCurrentStep = step === tree.currentStep;
  interactionState = isCurrentStep ? "INTERACTIVE" : "TIME_TRAVEL";
  timeTravelIndicator.classList.toggle("visible", !isCurrentStep);

  // Change cursor
  canvas.style.cursor = isCurrentStep ? "crosshair" : "default";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Hit Testing ---

function findFrontierAt(x, y) {
  let closest = null;
  let closestDist = FRONTIER_HIT_RADIUS;
  for (const fid of tree.frontierIds) {
    const node = tree.nodes.get(fid);
    if (!node) continue;
    const d = dist(x, y, node.x, node.y);
    if (d < closestDist) {
      closestDist = d;
      closest = node;
    }
  }
  return closest;
}

function findGreyEdgeAt(x, y) {
  let closest = null;
  let closestDist = EDGE_HIT_RADIUS;
  for (const edge of tree.edges) {
    if (edge.state === "solid-chosen") continue;
    const from = tree.nodes.get(edge.fromId);
    const to = tree.nodes.get(edge.toId);
    if (!from || !to) continue;
    const d = pointToSegmentDist(x, y, from.x, from.y, to.x, to.y);
    if (d < closestDist) {
      closestDist = d;
      closest = edge;
    }
  }
  return closest;
}

// --- Step Execution ---

function executeStep1(clickX, clickY) {
  const canvasW = parseInt(canvas.style.width);
  const canvasH = parseInt(canvas.style.height);
  const root = tree.nodes.get(tree.rootId);

  // Enforce minimum distance
  if (dist(clickX, clickY, root.x, root.y) < MIN_FIRST_CLICK_DIST) {
    const angle = Math.atan2(clickY - root.y, clickX - root.x);
    clickX = root.x + Math.cos(angle) * MIN_FIRST_CLICK_DIST;
    clickY = root.y + Math.sin(angle) * MIN_FIRST_CLICK_DIST;
  }

  // Create chosen node b
  const b = createNode(clickX, clickY, root.id, 1, "chosen");
  b.greyLevel = 0;
  b.glowing = true;
  addNode(b);

  const edgeAB = createEdge(root.id, b.id, 1, "solid");
  edgeAB.state = "solid-chosen";
  addEdge(edgeAB);

  // Mirrored alternative c
  const mirrorPos = computeMirror(root, { x: clickX, y: clickY });
  const mirrorClamped = clampToCanvas(
    mirrorPos.x,
    mirrorPos.y,
    canvasW,
    canvasH,
  );
  const c = createNode(
    mirrorClamped.x,
    mirrorClamped.y,
    root.id,
    1,
    "unchosen",
  );
  c.greyLevel = 1;
  addNode(c);

  const edgeAC = createEdge(root.id, c.id, 1, "solid");
  edgeAC.state = "grey";
  edgeAC.greyLevel = 1;
  addEdge(edgeAC);

  // Frontier dots from b (random directions)
  for (let i = 0; i < 2; i++) {
    const pos = safeRandomBranch(
      b,
      BRANCH_LEN_MIN,
      BRANCH_LEN_MAX,
      canvasW,
      canvasH,
    );
    const f = createNode(pos.x, pos.y, b.id, 1, "frontier");
    f.isFrontier = true;
    f.glowing = true;
    addNode(f);
    tree.frontierIds.add(f.id);

    const edgeBF = createEdge(b.id, f.id, 1, "dotted");
    addEdge(edgeBF);
  }

  // Update state
  root.state = "chosen";
  root.glowing = false;
  tree.chosenPath.push(root.id, b.id);
  tree.activeNodeId = b.id;
  tree.currentStep = 1;

  // Snapshot + poem
  const line = nextPoemLine();
  takeSnapshot(line);
  addPoemRect(line, 1);
}

function executeStepN(chosenNode) {
  const step = tree.currentStep + 1;
  const canvasW = parseInt(canvas.style.width);
  const canvasH = parseInt(canvas.style.height);

  // 1. Deprecate greys
  deprecateGreys();

  // 2. Mark chosen
  chosenNode.state = "chosen";
  chosenNode.greyLevel = 0;
  chosenNode.isFrontier = false;
  chosenNode.glowing = true;

  // Find and solidify the edge to this node
  for (const edge of tree.edges) {
    if (edge.toId === chosenNode.id) {
      edge.state = "solid-chosen";
      edge.lineStyle = "solid";
      edge.greyLevel = 0;
      break;
    }
  }

  // 3. Grey out other frontiers
  for (const fid of tree.frontierIds) {
    if (fid === chosenNode.id) continue;
    const fNode = tree.nodes.get(fid);
    if (!fNode) continue;
    fNode.state = "unchosen";
    fNode.isFrontier = false;
    fNode.glowing = false;
    fNode.greyLevel = 1;
    for (const edge of tree.edges) {
      if (edge.toId === fid) {
        edge.state = "grey";
        edge.greyLevel = 1;
        break;
      }
    }
  }
  tree.frontierIds.clear();

  // 4. Remove glow from previous active
  if (tree.activeNodeId !== null) {
    const prev = tree.nodes.get(tree.activeNodeId);
    if (prev) prev.glowing = false;
  }

  // 5. Spawn grey children from all leaves
  spawnGreyChildren(step, canvasW, canvasH);

  // 6. New frontier from chosen node
  for (let i = 0; i < 2; i++) {
    const pos = safeRandomBranch(
      chosenNode,
      BRANCH_LEN_MIN,
      BRANCH_LEN_MAX,
      canvasW,
      canvasH,
    );
    const f = createNode(pos.x, pos.y, chosenNode.id, step, "frontier");
    f.isFrontier = true;
    f.glowing = true;
    addNode(f);
    tree.frontierIds.add(f.id);

    const edge = createEdge(chosenNode.id, f.id, step, "dotted");
    addEdge(edge);
  }

  // 7. Update tracking
  tree.chosenPath.push(chosenNode.id);
  tree.activeNodeId = chosenNode.id;
  tree.currentStep = step;

  const line = nextPoemLine();
  takeSnapshot(line);
  addPoemRect(line, step);
}

function executeStepAtPosition(x, y) {
  const canvasW = parseInt(canvas.style.width);
  const canvasH = parseInt(canvas.style.height);
  const step = tree.currentStep + 1;

  // Enforce minimum distance from active node
  const active = tree.nodes.get(tree.activeNodeId);
  if (active && dist(x, y, active.x, active.y) < MIN_FIRST_CLICK_DIST) {
    const angle = Math.atan2(y - active.y, x - active.x);
    x = active.x + Math.cos(angle) * MIN_FIRST_CLICK_DIST;
    y = active.y + Math.sin(angle) * MIN_FIRST_CLICK_DIST;
  }

  // Create node at click position, child of active node
  const newNode = createNode(x, y, tree.activeNodeId, step, "chosen");
  newNode.greyLevel = 0;
  newNode.glowing = true;
  addNode(newNode);

  const edge = createEdge(tree.activeNodeId, newNode.id, step, "solid");
  edge.state = "solid-chosen";
  addEdge(edge);

  // 1. Deprecate greys
  deprecateGreys();

  // 2. Grey out all frontiers
  for (const fid of tree.frontierIds) {
    const fNode = tree.nodes.get(fid);
    if (!fNode) continue;
    fNode.state = "unchosen";
    fNode.isFrontier = false;
    fNode.glowing = false;
    fNode.greyLevel = 1;
    for (const e of tree.edges) {
      if (e.toId === fid) {
        e.state = "grey";
        e.greyLevel = 1;
        break;
      }
    }
  }
  tree.frontierIds.clear();

  // 3. Remove glow from previous active
  if (tree.activeNodeId !== null) {
    const prev = tree.nodes.get(tree.activeNodeId);
    if (prev) prev.glowing = false;
  }

  // 4. Spawn grey children
  spawnGreyChildren(step, canvasW, canvasH);

  // 5. New frontier from new node
  for (let i = 0; i < 2; i++) {
    const pos = safeRandomBranch(
      newNode,
      BRANCH_LEN_MIN,
      BRANCH_LEN_MAX,
      canvasW,
      canvasH,
    );
    const f = createNode(pos.x, pos.y, newNode.id, step, "frontier");
    f.isFrontier = true;
    f.glowing = true;
    addNode(f);
    tree.frontierIds.add(f.id);

    const fedge = createEdge(newNode.id, f.id, step, "dotted");
    addEdge(fedge);
  }

  // 6. Update tracking
  tree.chosenPath.push(newNode.id);
  tree.activeNodeId = newNode.id;
  tree.currentStep = step;

  const line = nextPoemLine();
  takeSnapshot(line);
  addPoemRect(line, step);
}

// --- Interaction State Machine ---

let interactionState = "INIT"; // INIT | INTERACTIVE | TIME_TRAVEL
let lastClickTime = 0;

function handleCanvasClick(e) {
  if (interactionState === "TIME_TRAVEL") return;

  const now = Date.now();
  if (now - lastClickTime < CLICK_DEBOUNCE_MS) return;
  lastClickTime = now;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (interactionState === "INIT") {
    // Don't trigger on clicking the root dot itself
    const root = tree.nodes.get(tree.rootId);
    if (root && dist(x, y, root.x, root.y) < 10) return;

    executeStep1(x, y);
    interactionState = "INTERACTIVE";
    viewingStep = -1;
    return;
  }

  if (interactionState === "INTERACTIVE") {
    // Check frontier hit
    const hitFrontier = findFrontierAt(x, y);
    if (hitFrontier) {
      executeStepN(hitFrontier);
      viewingStep = -1;
      return;
    }

    // Check grey edge hit (shudder)
    const hitEdge = findGreyEdgeAt(x, y);
    if (hitEdge) {
      triggerShudder(hitEdge);
      return;
    }

    // Free-form click: create at position
    executeStepAtPosition(x, y);
    viewingStep = -1;
  }
}

canvas.addEventListener("click", handleCanvasClick);

// Also handle poem strip scroll via click on individual rects (handled in addPoemRect)
// Handle scroll-based detection
let scrollTimeout;
poemStrip.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    // Find which rect is closest to center
    const stripRect = poemStrip.getBoundingClientRect();
    const centerX = stripRect.left + stripRect.width / 2;
    let closestStep = tree.currentStep;
    let closestDist = Infinity;

    poemStrip.querySelectorAll(".poem-rect").forEach((r) => {
      const rRect = r.getBoundingClientRect();
      const rCenter = rRect.left + rRect.width / 2;
      const d = Math.abs(rCenter - centerX);
      if (d < closestDist) {
        closestDist = d;
        closestStep = parseInt(r.dataset.step);
      }
    });

    scrollToStep(closestStep);
  }, 150);
});

// --- Initialization ---

function init() {
  loadPoem();
  resizeCanvas();

  const canvasW = parseInt(canvas.style.width);
  const canvasH = parseInt(canvas.style.height);

  // Create root at bottom-center
  const root = createNode(canvasW / 2, canvasH - 60, null, 0, "root");
  root.glowing = true;
  addNode(root);
  tree.rootId = root.id;
  tree.activeNodeId = root.id;

  // Take initial snapshot
  takeSnapshot("");

  // Start render loop
  requestAnimationFrame(render);
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

init();
