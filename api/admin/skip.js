import { requireAuth, service, readJson } from "../_lib.js";

// "skip" a participant who hasn't shown up yet:
// - if they haven't split, reassign their position to the next not-yet-claimed slot at end
// - effectively shifts all subsequent positions down by one
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;

  const { participant_id } = await readJson(req);
  if (!participant_id) {
    res.status(400).json({ error: "participant_id required" });
    return;
  }

  const sb = service();

  // load participant + session
  const { data: p, error: pe } = await sb
    .from("hydra_participants")
    .select("*")
    .eq("id", participant_id)
    .maybeSingle();
  if (pe || !p) {
    res.status(404).json({ error: "participant not found" });
    return;
  }
  if (p.has_split) {
    res.status(400).json({ error: "participant already split" });
    return;
  }
  if (p.position == null) {
    res.status(400).json({ error: "watch-along participant; nothing to skip" });
    return;
  }

  const { data: s, error: se } = await sb
    .from("hydra_sessions")
    .select("*")
    .eq("id", p.session_id)
    .maybeSingle();
  if (se || !s) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  // shift all later participants down by one
  const { data: laterParticipants, error: lpe } = await sb
    .from("hydra_participants")
    .select("*")
    .eq("session_id", s.id)
    .gt("position", p.position)
    .order("position", { ascending: true });
  if (lpe) {
    res.status(500).json({ error: lpe.message });
    return;
  }

  // mark skipped participant as watch-along
  const { error: skipErr } = await sb
    .from("hydra_participants")
    .update({ position: null })
    .eq("id", p.id);
  if (skipErr) {
    res.status(500).json({ error: skipErr.message });
    return;
  }

  for (const lp of laterParticipants || []) {
    const { error: upErr } = await sb
      .from("hydra_participants")
      .update({ position: lp.position - 1 })
      .eq("id", lp.id);
    if (upErr) {
      res.status(500).json({ error: upErr.message });
      return;
    }
  }

  // decrement next_position so a new scanner can fill the freed slot
  const { error: nextErr } = await sb
    .from("hydra_sessions")
    .update({ next_position: Math.max(0, s.next_position - 1) })
    .eq("id", s.id);
  if (nextErr) {
    res.status(500).json({ error: nextErr.message });
    return;
  }

  res.status(200).json({ ok: true });
}
