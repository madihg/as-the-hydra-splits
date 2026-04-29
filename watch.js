import { sb, fetchSessionById, fetchLiveSession } from "./shared/supabase.js";
import { Tree } from "./tree.js";

const params = new URLSearchParams(window.location.search);
const sessionParam = params.get("session");

const header = document.getElementById("header");
const linesList = document.getElementById("lines-list");
const canvas = document.getElementById("watch-canvas");

const tree = new Tree(canvas);
tree.init();

let session = null;
let lastRevealedLen = 0;
let realtimeChannel = null;

function renderLine(entry) {
  const empty = linesList.querySelector(".empty");
  if (empty) empty.remove();
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
  linesList.insertBefore(el, linesList.firstChild);
}

function applyRevealed(revealed) {
  const len = revealed.length;
  for (let i = lastRevealedLen; i < len; i++) {
    const entry = revealed[i];
    renderLine(entry);
    tree.splitOnce(entry.line?.id ?? entry.position);
  }
  lastRevealedLen = len;
}

function applyHeader(s) {
  if (!s) {
    header.innerHTML = "no session right now.";
    return;
  }
  if (s.status === "complete" || s.status === "archived") {
    header.innerHTML =
      'the performance is over <span class="heart">&#9829;</span>';
  } else {
    header.innerHTML =
      'the cast is complete, watch along <span class="heart">&#9829;</span>';
  }
}

async function bootstrap() {
  let s = sessionParam
    ? await fetchSessionById(sessionParam)
    : await fetchLiveSession();
  if (!s) {
    header.textContent = "no session right now.";
    return;
  }
  session = s;
  tree.reset();
  lastRevealedLen = 0;
  applyHeader(s);
  applyRevealed(s.revealed || []);
  subscribe();
}

function subscribe() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb
    .channel(`hydra-watch-${session.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "hydra_sessions",
        filter: `id=eq.${session.id}`,
      },
      (payload) => {
        if (!payload.new) return;
        session = payload.new;
        applyHeader(session);
        applyRevealed(session.revealed || []);
      },
    )
    .subscribe();
}

bootstrap();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") bootstrap();
});
