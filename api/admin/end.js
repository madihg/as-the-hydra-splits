import { requireAuth, service } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;

  const sb = service();
  const { data, error } = await sb
    .from("hydra_sessions")
    .update({ status: "complete", ended_at: new Date().toISOString() })
    .eq("status", "live")
    .select()
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ session: data });
}
