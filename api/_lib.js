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
    voice: "voice of one half-waking",
    text: "are we crammed - here - in heaven?",
    direction:
      "read the below softly, like you've just woken from a dream and aren't yet sure where you are",
  },
  {
    id: 2,
    voice: "voice of the half-laugh that catches",
    text: "or are we larping home?",
    direction:
      "read the below with a half-laugh, then let it catch in your throat halfway through",
  },
  {
    id: 3,
    voice: "voice of the weary, amused",
    text: "are we cosplaying the sedentary type?",
    direction:
      "read the below as a question to no one - weary, almost amused with yourself",
  },
  {
    id: 4,
    voice: "voice of the conspirator",
    text: "can you hear our roots muttering?",
    direction:
      "read the below like a conspirator - lean toward the room, almost a whisper",
  },
  {
    id: 5,
    voice: "voice of three in one body",
    text: '"hey\nmeasure your distance from catastrophe\nand, also, you might have to forego desire"',
    direction:
      "read the below as if three people are sharing your body - the first hailing the room, the second flat and clinical, the third tender and almost breaking",
  },
  {
    id: 6,
    voice: "voice of first remembering",
    text: "i wonder:",
    direction:
      "read the below as if you're remembering it for the first time, then sit in a long silence",
  },
  {
    id: 7,
    voice: "voice of the unguarded gaze upward",
    text: "did we fall from the hand of possibility?",
    direction:
      "read the below with a big voice, eyes up, like asking the ceiling",
  },
  {
    id: 8,
    voice: "voice of pronouncement and doubt",
    text: "every branch stared down into otherness",
    direction:
      "read the below like a pronouncement, then let your face show that you don't quite believe what you just said",
  },
  {
    id: 9,
    voice: "voice of the dry-eyed, then grieving",
    text: "my future - i mean my culture - is composting",
    direction:
      "read the below dry and factual, then let a flicker of grief land on the word 'composting'",
  },
  {
    id: 10,
    voice: "voice of direct address",
    text: "asking: how will *you* be reborn?",
    direction:
      "read the below straight at one person in the room, eyes locked, almost confrontational",
  },
  {
    id: 11,
    voice: "voice of the kitchen table after the guests",
    text: "now that heartbreak is your shared art form",
    direction:
      "read the below quietly, the way you'd speak at the kitchen table once the guests have gone",
  },
  {
    id: 12,
    voice: "voice of slow tenderness, almost sung",
    text: "and longing has crow's feet and graying hair",
    direction:
      "read the below slowly, almost sung, with tenderness for the longing itself",
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
