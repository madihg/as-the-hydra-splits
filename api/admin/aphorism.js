import { requireAuth, service, readJson } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;

  const { text } = await readJson(req);
  const value = (text || "").slice(0, 120);

  const sb = service();
  const { data: s, error: se } = await sb
    .from("hydra_sessions")
    .select("id")
    .eq("status", "live")
    .maybeSingle();
  if (se || !s) {
    res.status(404).json({ error: "no live session" });
    return;
  }

  const { error } = await sb
    .from("hydra_sessions")
    .update({ closing_aphorism: value || "here the hydra splits" })
    .eq("id", s.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
