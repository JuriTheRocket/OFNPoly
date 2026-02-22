import crypto from "crypto";
import {
  json, getClientIp, stableUserKeyFromIp,
  getUser, setUser, getGlobalState, setGlobalState,
  getMarkets, setMarkets,
  CREATE_FEE, sanitizeText, now
} from "./_lib.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const ip = getClientIp(event);
  const userKey = stableUserKeyFromIp(ip);

  const me = await getUser(userKey);
  if (me.banned) return json(403, { error: "Access denied." });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const title = sanitizeText(body.title, 120);
  const desc = sanitizeText(body.desc, 900);
  const category = sanitizeText(body.category, 40) || "Other";
  const days = Number(body.days);

  if (!title) return json(400, { error: "Title required." });
  if (!desc) return json(400, { error: "Clarification required." });
  if (!Number.isFinite(days) || days < 1 || days > 365) return json(400, { error: "Time span must be 1–365 days." });

  const markets = await getMarkets();
  const openMine = markets.filter(m => m.status === "open" && m.creatorKey === userKey).length;
  if (openMine >= 3) return json(400, { error: "Limit reached: max 3 open predictions per IP." });

  if (me.balance < CREATE_FEE) return json(400, { error: "Not enough UNC Bucks." });

  me.balance -= CREATE_FEE;
  await setUser(userKey, me);

  const global = await getGlobalState();
  global.treasury += CREATE_FEE;
  await setGlobalState(global);

  const id = "m_" + crypto.randomBytes(10).toString("hex");
  const createdAt = now();
  const deadlineAt = createdAt + Math.floor(days * 24 * 60 * 60 * 1000);

  markets.unshift({
    id, title, desc, category,
    creatorKey: userKey,
    createdAt, deadlineAt,
    status: "open",
    outcome: null,
    pools: { yes: 0, no: 0 },
    userStakes: {} // { userKey: {yes,no} }
  });

  await setMarkets(markets);
  return json(200, { ok: true });
}