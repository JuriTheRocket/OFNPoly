import {
  json, parseCookies, getAdminSession,
  getMarkets, getUser, setUser
} from "./_lib.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const cookies = parseCookies(event.headers?.cookie || "");
  const adminSess = await getAdminSession(cookies["unc_admin"] || "");
  if (!adminSess) return json(403, { error: "Access denied." });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const id = String(body.id || "").trim();
  if (!id) return json(400, { error: "Missing id." });

  const markets = await getMarkets();
  const m = markets.find(x => x.id === id);
  if (!m) return json(404, { error: "Not found." });

  const u = await getUser(m.creatorKey);
  u.banned = true;
  await setUser(m.creatorKey, u);

  return json(200, { ok: true });
}