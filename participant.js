import {
  sb,
  fetchLiveSession,
  fetchSessionById,
  fetchParticipant,
  claimPosition,
  splitLine,
} from "./shared/supabase.js";

const params = new URLSearchParams(window.location.search);
const sessionParam = params.get("session");

const role = document.getElementById("role");
const sStates = {
  waiting: document.getElementById("state-waiting"),
  turn: document.getElementById("state-turn"),
  spoken: document.getElementById("state-spoken"),
  notice: document.getElementById("state-notice"),
};
const turnVoice = document.getElementById("turn-voice");
const turnLine = document.getElementById("turn-line");
const turnDirection = document.getElementById("turn-direction");
const spokenVoice = document.getElementById("spoken-voice");
const spokenLine = document.getElementById("spoken-line");
const splitBtn = document.getElementById("split-btn");
const noticeText = document.getElementById("notice-text");
const softHint = document.getElementById("soft-hint");

let session = null;
let participant = null;
let total = 0;
let realtimeChannel = null;
let softHintTimer = null;

function showState(name) {
  for (const k of Object.keys(sStates)) {
    sStates[k].classList.toggle("active", k === name);
  }
  splitBtn.style.display = name === "turn" ? "inline-block" : "none";
  if (name === "waiting") {
    softHintTimer = setTimeout(() => softHint.classList.add("visible"), 90000);
  } else {
    if (softHintTimer) clearTimeout(softHintTimer);
    softHint.classList.remove("visible");
  }
}

function setRole(text) {
  role.textContent = text;
}

function notice(text) {
  noticeText.textContent = text;
  setRole("");
  showState("notice");
}

function storageKey(sessionId) {
  return `hydra:participant:${sessionId}`;
}

function loadParticipantId(sessionId) {
  try {
    return localStorage.getItem(storageKey(sessionId));
  } catch {
    return null;
  }
}
function saveParticipantId(sessionId, id) {
  try {
    localStorage.setItem(storageKey(sessionId), id);
  } catch {}
}

function lineForPosition(s, position) {
  if (position == null) return null;
  return s.shuffled_lines[position] || null;
}

function recompute() {
  if (!session || !participant) return;

  // session ended
  if (session.status === "complete") {
    if (participant.position == null || !participant.has_split) {
      // unspoken or watch-along: redirect to watch
      window.location.href = `watch.html?session=${session.id}`;
      return;
    }
    // already split, show spoken state
    const line = lineForPosition(session, participant.position);
    if (line) {
      spokenVoice.textContent = line.voice || "";
      spokenLine.textContent = line.text;
      setRole(`voice ${participant.position + 1} of ${total}`);
      showState("spoken");
    }
    return;
  }

  // watch-along (cast was full at claim time)
  if (participant.position == null) {
    window.location.href = `watch.html?session=${session.id}`;
    return;
  }

  // already split
  if (participant.has_split) {
    const line = lineForPosition(session, participant.position);
    spokenVoice.textContent = line?.voice || "";
    spokenLine.textContent = line?.text || "";
    setRole(`voice ${participant.position + 1} of ${total}`);
    showState("spoken");
    return;
  }

  const revealedLen = (session.revealed || []).length;
  setRole(`voice ${participant.position + 1} of ${total}`);

  if (revealedLen === participant.position) {
    // your turn
    const line = lineForPosition(session, participant.position);
    if (!line) return;
    turnVoice.textContent = line.voice || "";
    turnLine.textContent = line.text;
    turnDirection.textContent = line.direction;
    if (sStates.turn.classList.contains("active") === false) {
      // first time entering turn state - haptic nudge
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch {}
    }
    showState("turn");
  } else {
    showState("waiting");
  }
}

splitBtn.addEventListener("click", async () => {
  if (!participant) return;
  splitBtn.disabled = true;
  try {
    await splitLine(participant.id);
    // optimistic local update
    participant = { ...participant, has_split: true };
    recompute();
  } catch (e) {
    splitBtn.disabled = false;
    notice("could not split. try again, or ask the host.");
    console.error(e);
  }
});

async function bootstrap() {
  let s = null;
  if (sessionParam) {
    s = await fetchSessionById(sessionParam);
    if (!s) {
      notice("session not found.");
      return;
    }
    if (s.status === "archived" || s.status === "idle") {
      notice("this session is not active.");
      return;
    }
  } else {
    s = await fetchLiveSession();
    if (!s) {
      notice("no live session right now.");
      return;
    }
  }

  session = s;
  total = (s.shuffled_lines || []).length;

  // existing participant?
  const existingId = loadParticipantId(s.id);
  if (existingId) {
    const p = await fetchParticipant(existingId);
    if (p && p.session_id === s.id) {
      participant = p;
    }
  }

  // claim a slot if needed
  if (!participant) {
    if (s.status !== "live") {
      // can't join a complete session - send to watch
      window.location.href = `watch.html?session=${s.id}`;
      return;
    }
    try {
      const claim = await claimPosition(s.id);
      if (!claim) throw new Error("no claim row");
      saveParticipantId(s.id, claim.participant_id);
      const fresh = await fetchParticipant(claim.participant_id);
      participant = fresh;
      // watch-along: redirect
      if (participant.position == null) {
        window.location.href = `watch.html?session=${s.id}`;
        return;
      }
    } catch (e) {
      console.error(e);
      notice("could not join. ask the host to start a new session.");
      return;
    }
  }

  recompute();
  subscribe();
}

function subscribe() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);

  realtimeChannel = sb
    .channel(`hydra-p-${session.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "hydra_sessions",
        filter: `id=eq.${session.id}`,
      },
      (payload) => {
        if (payload.new) {
          session = payload.new;
          recompute();
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "hydra_participants",
        filter: `id=eq.${participant.id}`,
      },
      (payload) => {
        if (payload.new) {
          participant = payload.new;
          recompute();
        }
      },
    )
    .subscribe();
}

bootstrap();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && session && participant) {
    const [s, p] = await Promise.all([
      fetchSessionById(session.id),
      fetchParticipant(participant.id),
    ]);
    if (s) session = s;
    if (p) participant = p;
    recompute();
  }
});
