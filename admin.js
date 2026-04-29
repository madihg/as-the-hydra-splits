import { sb, fetchLiveSession } from "./shared/supabase.js";

const TOKEN_KEY = "hydra:admin:token";

const els = {
  loginBlock: document.getElementById("login-block"),
  loginForm: document.getElementById("login-form"),
  password: document.getElementById("password"),
  loginErr: document.getElementById("login-err"),
  authStatus: document.getElementById("auth-status"),
  logoutBtn: document.getElementById("logout-btn"),
  dash: document.getElementById("dash"),

  startBtn: document.getElementById("start-btn"),
  endBtn: document.getElementById("end-btn"),
  revealBtn: document.getElementById("reveal-btn"),
  actionErr: document.getElementById("action-err"),
  actionOk: document.getElementById("action-ok"),

  statStatus: document.getElementById("stat-status"),
  statVoices: document.getElementById("stat-voices"),
  statStarted: document.getElementById("stat-started"),

  aphorismForm: document.getElementById("aphorism-form"),
  aphorism: document.getElementById("aphorism"),

  castBody: document.getElementById("cast-body"),
  historyBody: document.getElementById("history-body"),
};

let token = null;
let session = null;
let realtimeChannel = null;

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    token = null;
    showLogin();
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `error ${res.status}`);
  }
  return data;
}

function flash(el, text, ms = 3000) {
  el.textContent = text;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = "";
  }, ms);
}

function showLogin() {
  els.loginBlock.classList.remove("hidden");
  els.dash.classList.add("hidden");
  els.authStatus.textContent = "not authenticated";
  els.logoutBtn.style.display = "none";
}
function showDash() {
  els.loginBlock.classList.add("hidden");
  els.dash.classList.remove("hidden");
  els.authStatus.textContent = "authenticated";
  els.logoutBtn.style.display = "inline-block";
}

function fmtStamp(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSession(s) {
  session = s;
  if (!s) {
    els.statStatus.textContent = "idle";
    els.statVoices.textContent = "0 / 0";
    els.statStarted.textContent = "-";
    els.aphorism.value = "";
    els.castBody.innerHTML =
      '<tr><td colspan="5" style="color: var(--text-tertiary)">no live session</td></tr>';
    return;
  }
  const total = (s.shuffled_lines || []).length;
  const spoken = (s.revealed || []).length;
  els.statStatus.textContent = s.status;
  els.statVoices.textContent = `${spoken} / ${total}`;
  els.statStarted.textContent = fmtStamp(s.started_at || s.created_at);
  if (els.aphorism.value === "") els.aphorism.value = s.closing_aphorism || "";
}

async function loadCast() {
  if (!session) {
    els.castBody.innerHTML =
      '<tr><td colspan="5" style="color: var(--text-tertiary)">no live session</td></tr>';
    return;
  }
  const { data, error } = await sb
    .from("hydra_participants")
    .select("*")
    .eq("session_id", session.id)
    .order("joined_at", { ascending: true });
  if (error) {
    els.castBody.innerHTML = `<tr><td colspan="5" class="danger">${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    els.castBody.innerHTML =
      '<tr><td colspan="5" style="color: var(--text-tertiary)">no participants yet</td></tr>';
    return;
  }
  els.castBody.innerHTML = "";
  for (const p of data) {
    const tr = document.createElement("tr");

    const tdPos = document.createElement("td");
    tdPos.textContent =
      p.position == null ? "watch" : `voice ${p.position + 1}`;

    const tdId = document.createElement("td");
    tdId.style.color = "var(--text-tertiary)";
    tdId.textContent = p.id.slice(0, 8);

    const tdState = document.createElement("td");
    if (p.position == null) {
      const pill = document.createElement("span");
      pill.className = "pill upcoming";
      pill.textContent = "watch";
      tdState.appendChild(pill);
    } else if (p.has_split) {
      const pill = document.createElement("span");
      pill.className = "pill trained";
      pill.textContent = "spoken";
      tdState.appendChild(pill);
    } else {
      const pill = document.createElement("span");
      pill.className = "pill training";
      pill.textContent = "waiting";
      tdState.appendChild(pill);
    }

    const tdJoin = document.createElement("td");
    tdJoin.style.color = "var(--text-tertiary)";
    tdJoin.textContent = fmtStamp(p.joined_at);

    const tdActions = document.createElement("td");
    tdActions.className = "actions";
    if (session.status === "live" && p.position != null && !p.has_split) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "nav-link";
      skipBtn.textContent = "skip";
      skipBtn.addEventListener("click", async () => {
        skipBtn.disabled = true;
        try {
          await api("/api/admin/skip", { participant_id: p.id });
          flash(els.actionOk, "skipped.");
          await refresh();
        } catch (e) {
          flash(els.actionErr, e.message);
        } finally {
          skipBtn.disabled = false;
        }
      });
      tdActions.appendChild(skipBtn);
    }

    tr.append(tdPos, tdId, tdState, tdJoin, tdActions);
    els.castBody.appendChild(tr);
  }
}

async function loadHistory() {
  const { data, error } = await sb
    .from("hydra_sessions")
    .select("*")
    .neq("status", "live")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    els.historyBody.innerHTML = `<tr><td colspan="4" class="danger">${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    els.historyBody.innerHTML =
      '<tr><td colspan="4" style="color: var(--text-tertiary)">no history</td></tr>';
    return;
  }
  els.historyBody.innerHTML = "";
  for (const s of data) {
    const tr = document.createElement("tr");
    const tdStart = document.createElement("td");
    tdStart.textContent = fmtStamp(s.started_at || s.created_at);
    const tdStatus = document.createElement("td");
    tdStatus.textContent = s.status;
    const tdVoices = document.createElement("td");
    const total = (s.shuffled_lines || []).length;
    tdVoices.textContent = `${(s.revealed || []).length} / ${total}`;
    const tdAph = document.createElement("td");
    tdAph.style.color = "var(--text-tertiary)";
    tdAph.textContent = s.closing_aphorism || "";
    tr.append(tdStart, tdStatus, tdVoices, tdAph);
    els.historyBody.appendChild(tr);
  }
}

async function refresh() {
  const live = await fetchLiveSession();
  renderSession(live);
  await Promise.all([loadCast(), loadHistory()]);
}

function subscribe() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb
    .channel("hydra-admin")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hydra_sessions" },
      () => refresh(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hydra_participants" },
      () => loadCast(),
    )
    .subscribe();
}

// --- handlers ---

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginErr.textContent = "";
  const password = els.password.value;
  try {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data?.token) {
      els.loginErr.textContent = data?.error || "invalid password";
      return;
    }
    token = data.token;
    setToken(token);
    els.password.value = "";
    showDash();
    await refresh();
    subscribe();
  } catch (err) {
    els.loginErr.textContent = "could not reach server";
  }
});

els.logoutBtn.addEventListener("click", () => {
  setToken(null);
  token = null;
  showLogin();
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
});

els.startBtn.addEventListener("click", async () => {
  if (
    !confirm("start a new session? any current live session will be archived.")
  )
    return;
  els.startBtn.disabled = true;
  try {
    await api("/api/admin/start");
    flash(els.actionOk, "session started.");
    await refresh();
  } catch (e) {
    flash(els.actionErr, e.message);
  } finally {
    els.startBtn.disabled = false;
  }
});

els.endBtn.addEventListener("click", async () => {
  if (!session) return;
  if (!confirm("end the current session?")) return;
  try {
    await api("/api/admin/end");
    flash(els.actionOk, "session ended.");
    await refresh();
  } catch (e) {
    flash(els.actionErr, e.message);
  }
});

els.revealBtn.addEventListener("click", async () => {
  if (!session) return;
  try {
    await api("/api/admin/reveal");
    flash(els.actionOk, "next line revealed.");
    await refresh();
  } catch (e) {
    flash(els.actionErr, e.message);
  }
});

els.aphorismForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!session) return;
  try {
    await api("/api/admin/aphorism", { text: els.aphorism.value.trim() });
    flash(els.actionOk, "aphorism saved.");
    await refresh();
  } catch (err) {
    flash(els.actionErr, err.message);
  }
});

// --- boot ---

token = getToken();
if (token) {
  // optimistic auth - first api call will 401 if token is bad
  showDash();
  refresh()
    .then(() => subscribe())
    .catch(() => {});
} else {
  showLogin();
}
