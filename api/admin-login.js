import { checkPassword, signToken, readJson } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const { password } = await readJson(req);
  if (!checkPassword(password)) {
    res.status(401).json({ error: "invalid password" });
    return;
  }
  const token = signToken({ role: "admin" });
  res.status(200).json({ token });
}
