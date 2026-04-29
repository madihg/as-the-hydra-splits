import { requireAuth, service } from "../_lib.js";

// manually reveal the next line - finds the next-position participant who hasn't split
// and calls hydra_split for them. if no participant has claimed that slot yet, advance
// next_position and append the line directly so the show can continue.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;

  const sb = service();

  const { data: s, error: se } = await sb
    .from("hydra_sessions")
    .select("*")
    .eq("status", "live")
    .maybeSingle();
  if (se || !s) {
    res.status(404).json({ error: "no live session" });
    return;
  }

  const total = (s.shuffled_lines || []).length;
  const nextSpoken = (s.revealed || []).length;
  if (nextSpoken >= total) {
    res.status(400).json({ error: "all lines already revealed" });
    return;
  }

  const { data: pat, error: pe } = await sb
    .from("hydra_participants")
    .select("*")
    .eq("session_id", s.id)
    .eq("position", nextSpoken)
    .maybeSingle();

  if (pe) {
    res.status(500).json({ error: pe.message });
    return;
  }

  if (pat && !pat.has_split) {
    const { error: rpcErr } = await sb.rpc("hydra_split", {
      p_participant_id: pat.id,
    });
    if (rpcErr) {
      res.status(500).json({ error: rpcErr.message });
      return;
    }
    res.status(200).json({ ok: true, via: "participant" });
    return;
  }

  // no participant in that slot yet - append directly via service role
  const line = s.shuffled_lines[nextSpoken];
  const newRevealed = [
    ...(s.revealed || []),
    {
      position: nextSpoken,
      line,
      spoken_at: Date.now() / 1000,
    },
  ];
  const newStatus = nextSpoken + 1 >= total ? "complete" : s.status;
  const updates = {
    revealed: newRevealed,
    next_position: Math.max(s.next_position, nextSpoken + 1),
  };
  if (newStatus !== s.status) {
    updates.status = newStatus;
    updates.ended_at = new Date().toISOString();
  }
  const { error: upErr } = await sb
    .from("hydra_sessions")
    .update(updates)
    .eq("id", s.id);
  if (upErr) {
    res.status(500).json({ error: upErr.message });
    return;
  }
  res.status(200).json({ ok: true, via: "host" });
}
