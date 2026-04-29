// thin wrapper over supabase-js. each surface (host/participant/admin/watch)
// imports `sb` for queries + rpc + realtime channels.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// helpers shared across surfaces

export async function fetchLiveSession() {
  const { data, error } = await sb
    .from("hydra_sessions")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSessionById(id) {
  const { data, error } = await sb
    .from("hydra_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchParticipant(id) {
  const { data, error } = await sb
    .from("hydra_participants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function claimPosition(sessionId) {
  const { data, error } = await sb.rpc("hydra_claim_position", {
    p_session_id: sessionId,
  });
  if (error) throw error;
  // rpc returns table; supabase-js returns array
  const row = Array.isArray(data) ? data[0] : data;
  return row;
}

export async function splitLine(participantId) {
  const { error } = await sb.rpc("hydra_split", {
    p_participant_id: participantId,
  });
  if (error) throw error;
}
