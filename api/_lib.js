// shared helpers for vercel serverless functions
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export function service() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("supabase env not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

// minimal hs256 jwt - we don't bring a dependency for this
export function signToken(payload) {
  if (!ADMIN_JWT_SECRET) throw new Error("ADMIN_JWT_SECRET not set");
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = b64url(
    crypto.createHmac("sha256", ADMIN_JWT_SECRET).update(data).digest(),
  );
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!ADMIN_JWT_SECRET) throw new Error("ADMIN_JWT_SECRET not set");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = b64url(
    crypto.createHmac("sha256", ADMIN_JWT_SECRET).update(`${h}.${p}`).digest(),
  );
  // constant-time compare
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString());
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function checkPassword(password) {
  if (!ADMIN_PASSWORD_HASH) throw new Error("ADMIN_PASSWORD_HASH not set");
  const got = sha256(password || "");
  if (
    got.length !== ADMIN_PASSWORD_HASH.length ||
    !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(ADMIN_PASSWORD_HASH))
  ) {
    return false;
  }
  return true;
}

export function requireAuth(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return payload;
}

export async function readJson(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

// poem source for server side - mirrors shared/poem.js
export const LINES = [
  {
    id: 1,
    text: "are we crammed - here - in heaven?",
    direction:
      "softly, as if waking from a dream and not yet sure where you are",
  },
  {
    id: 2,
    text: "or are we larping home?",
    direction: "a half-laugh, then it catches in your throat",
  },
  {
    id: 3,
    text: "are we cosplaying the sedentary type?",
    direction: "a question to no one, weary, almost amused",
  },
  {
    id: 4,
    text: "can you hear our roots muttering?",
    direction: "conspiratorial, lean toward the room, almost a whisper",
  },
  {
    id: 5,
    text: '"hey\nmeasure your distance from catastrophe\nand, also, you might have to forego desire"',
    direction:
      "three voices in one body - the first a hailing cry, the second flat and clinical, the third tender, broken",
  },
  {
    id: 6,
    text: "i wonder:",
    direction: "said as if remembering for the first time, then a long pause",
  },
  {
    id: 7,
    text: "did we fall from the hand of possibility?",
    direction: "wide, unguarded, eyes up, like asking the ceiling",
  },
  {
    id: 8,
    text: "every branch stared down into otherness",
    direction: "as a pronouncement, then doubt of your own pronouncement",
  },
  {
    id: 9,
    text: "my future - i mean my culture - is composting",
    direction:
      "dry, factual, then a small shift on 'composting' - a flicker of grief",
  },
  {
    id: 10,
    text: "asking: how will *you* be reborn?",
    direction:
      "direct address, eye contact with one person in the room, almost confrontational",
  },
  {
    id: 11,
    text: "now that heartbreak is your shared art form",
    direction:
      "quietly, the way one speaks at the kitchen table after the guests have left",
  },
  {
    id: 12,
    text: "and longing has crow's feet and graying hair",
    direction: "slow, almost sung, with tenderness for the longing itself",
  },
];

export function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
