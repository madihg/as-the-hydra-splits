import { sb, fetchLiveSession } from "./shared/supabase.js";
import { Tree } from "./tree.js";

const linesCol = document.getElementById("lines-col");
const linesEmpty = document.getElementById("lines-empty");
const qrPocket = document.getElementById("qr-pocket");
const qrRemaining = document.getElementById("qr-remaining");
const idleCard = document.getElementById("idle-card");
const closing = document.getElementById("closing");
const metaStatus = document.getElementById("meta-status");
const metaProgress = document.getElementById("meta-progress");
const metaStamp = document.getElementById("meta-stamp");

const canvas = document.getElementById("tree-canvas");
const tree = new Tree(canvas);
tree.init();

let session = null;
let lastRevealedLen = 0;
let qrInstance = null;
let realtimeChannel = null;

function fmtStamp(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderQR(sessionId) {
  if (qrInstance) {
    qrInstance.clear();
    qrInstance = null;
    document.getElementById("qr").innerHTML = "";
  }
  const url = `${window.location.origin}/participant.html?session=${sessionId}`;
  qrInstance = new QRCode(document.getElementById("qr"), {
    text: url,
    width: 168,
    height: 168,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function renderLine(entry) {
  if (linesEmpty && linesEmpty.parentNode) {
    linesEmpty.remove();
  }
  const el = document.createElement("article");
  el.className = "line-item";
  const voice = document.createElement("div");
  voice.className = "voice";
  voice.textContent = `voice ${entry.position + 1}`;
  const text = document.createElement("p");
  text.className = "text";
  text.textContent = entry.line.text;
  const direction = document.createElement("div");
  direction.className = "direction";
  direction.textContent = entry.line.direction;
  el.append(voice, text, direction);
  // newest on top
  linesCol.insertBefore(el, linesCol.firstChild);
}

function applyRevealed(revealed, total) {
  const len = revealed.length;
  for (let i = lastRevealedLen; i < len; i++) {
    const entry = revealed[i];
    renderLine(entry);
    tree.splitOnce(entry.line?.id ?? entry.position);
  }
  lastRevealedLen = len;
  metaProgress.textContent = `voices · ${len} / ${total}`;
  qrRemaining.textContent = String(total - len);
}

function applyState(s) {
  session = s;
  if (!s || s.status === "idle" || s.status === "archived") {
    metaStatus.textContent = "no session";
    metaStamp.textContent = "";
    qrPocket.classList.add("hidden");
    idleCard.style.display = "block";
    closing.classList.remove("visible");
    return;
  }

  idleCard.style.display = "none";
  metaStamp.textContent = fmtStamp(s.started_at || s.created_at);

  if (s.status === "live") {
    metaStatus.textContent = "live";
    qrPocket.classList.remove("hidden");
    closing.classList.remove("visible");
    if (!qrInstance) renderQR(s.id);
  } else if (s.status === "complete") {
    metaStatus.textContent = "complete";
    qrPocket.classList.add("hidden");
    if (s.closing_aphorism) closing.textContent = s.closing_aphorism;
    closing.classList.add("visible");
  }

  const total = (s.shuffled_lines || []).length;
  applyRevealed(s.revealed || [], total);
}

async function bootstrap() {
  const live = await fetchLiveSession();
  if (live) {
    // fresh tree for the live session - reset before applying revealed
    tree.reset();
    lastRevealedLen = 0;
    linesCol.innerHTML =
      '<div class="lines-empty" id="lines-empty">waiting for the first voice</div>';
    applyState(live);
  } else {
    applyState(null);
  }
  subscribe();
}

function subscribe() {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
  }
  realtimeChannel = sb
    .channel("hydra-host")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hydra_sessions" },
      async (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        const isCurrent = session && row.id === session.id;
        const isNewLive = row.status === "live" && !isCurrent;

        if (isNewLive) {
          tree.reset();
          lastRevealedLen = 0;
          linesCol.innerHTML =
            '<div class="lines-empty" id="lines-empty">waiting for the first voice</div>';
          applyState(row);
          return;
        }

        if (isCurrent) {
          applyState(row);
        }
      },
    )
    .subscribe();
}

bootstrap();

// guard against stale state if tab regains focus after a long pause
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    bootstrap();
  }
});
