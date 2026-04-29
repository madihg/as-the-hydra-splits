import { requireAuth, service, LINES, shuffle } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;

  const sb = service();

  // archive any existing live sessions so the unique-live-session index stays sound
  const { error: archErr } = await sb
    .from("hydra_sessions")
    .update({ status: "archived", ended_at: new Date().toISOString() })
    .eq("status", "live");
  if (archErr) {
    res.status(500).json({ error: archErr.message });
    return;
  }

  const shuffled = shuffle(LINES);
  const { data, error } = await sb
    .from("hydra_sessions")
    .insert({
      status: "live",
      shuffled_lines: shuffled,
      next_position: 0,
      revealed: [],
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(200).json({ session: data });
}
