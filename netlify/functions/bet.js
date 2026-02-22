import {
  json, getClientIp, stableUserKeyFromIp,
  getUser, setUser,
  getMarkets, setMarkets
} from "./_lib.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const ip = getClientIp(event);
  const userKey = stableUserKeyFromIp(ip);

  const me = await getUser(userKey);
  if (me.banned) return json(403, { error: "Access denied." });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const id = String(body.id || "").trim();
  const outcome = (String(body.outcome || "").toUpperCase() === "YES") ? "YES" : "NO";
  const amount = Number(body.amount);

  if (!id) return json(400, { error: "Missing id." });
  if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: "Invalid amount." });

  const markets = await getMarkets();
  const m = markets.find(x => x.id === id);
  if (!m) return json(404, { error: "Not found." });
  if (m.status !== "open") return json(400, { error: "Market not open." });

  if (me.balance < amount) return json(400, { error: "Not enough UNC Bucks." });

  me.balance -= amount;
  await setUser(userKey, me);

  m.userStakes ||= {};
  m.userStakes[userKey] ||= { yes: 0, no: 0 };
  if (outcome === "YES") {
    m.userStakes[userKey].yes += amount;
    m.pools.yes += amount;
  } else {
    m.userStakes[userKey].no += amount;
    m.pools.no += amount;
  }

  await setMarkets(markets);
  return json(200, { ok: true });
}