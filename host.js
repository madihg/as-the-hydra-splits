import { sb, fetchLiveSession } from "./shared/supabase.js";
import { Tree } from "./tree.js";

const linesCol = document.getElementById("lines-col");
const linesEmpty = document.getElementById("lines-empty");
const qrToggle = document.getElementById("qr-toggle");
const qrRemaining = document.getElementById("qr-remaining");
const qrOverlay = document.getElementById("qr-overlay");
const qrCloseBtn = document.getElementById("qr-close");
const qrUrlEl = document.getElementById("qr-url");
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
let qrBigInstance = null;
let qrUrl = null;
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

function setQrUrl(sessionId) {
  qrUrl = `${window.location.origin}/participant.html?session=${sessionId}`;
  qrUrlEl.textContent = qrUrl;
}

function openQrOverlay() {
  if (!qrUrl) return;
  // render a large qr sized for the room - participants need to see it from across a venue
  const bigSize = Math.min(window.innerWidth, window.innerHeight) * 0.78;
  document.getElementById("qr-big").innerHTML = "";
  qrBigInstance = new QRCode(document.getElementById("qr-big"), {
    text: qrUrl,
    width: Math.round(bigSize),
    height: Math.round(bigSize),
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
  qrOverlay.classList.add("visible");
}

function closeQrOverlay() {
  qrOverlay.classList.remove("visible");
}

qrToggle.addEventListener("click", openQrOverlay);
qrOverlay.addEventListener("click", (e) => {
  // close on click anywhere except the close button (which has its own handler)
  if (e.target === qrCloseBtn) return;
  closeQrOverlay();
});
qrCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  closeQrOverlay();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeQrOverlay();
});

function renderLine(entry) {
  if (linesEmpty && linesEmpty.parentNode) {
    linesEmpty.remove();
  }
  const el = document.createElement("article");
  el.className = "line-item";
  const voice = document.createElement("div");
  voice.className = "voice";
  const voiceLabel = entry.line.voice
    ? `voice ${entry.position + 1} - ${entry.line.voice}`
    : `voice ${entry.position + 1}`;
  voice.textContent = voiceLabel;
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
    qrToggle.classList.add("hidden");
    idleCard.style.display = "block";
    closing.classList.remove("visible");
    closeQrOverlay();
    return;
  }

  idleCard.style.display = "none";
  metaStamp.textContent = fmtStamp(s.started_at || s.created_at);

  if (s.status === "live") {
    metaStatus.textContent = "live";
    qrToggle.classList.remove("hidden");
    closing.classList.remove("visible");
    if (!qrUrl) setQrUrl(s.id);
  } else if (s.status === "complete") {
    metaStatus.textContent = "complete";
    qrToggle.classList.add("hidden");
    closeQrOverlay();
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
    qrUrl = null;
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
          qrUrl = null;
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
