import {
  json, getClientIp, stableUserKeyFromIp, parseCookies,
  getUser, setUser, getGlobalState, setGlobalState,
  getMarkets, setMarkets,
  getAdminSession, isTruthy, DELETE_FEE
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
  const force = isTruthy(body.force);

  if (!id) return json(400, { error: "Missing id." });

  const cookies = parseCookies(event.headers?.cookie || "");
  const adminSess = await getAdminSession(cookies["unc_admin"] || "");
  const isAdmin = !!adminSess;

  const markets = await getMarkets();
  const m = markets.find(x => x.id === id);
  if (!m) return json(404, { error: "Not found." });

  const isCreator = m.creatorKey === userKey;

  if (force) {
    if (!isAdmin) return json(403, { error: "Access denied." });
  } else {
    if (!isCreator) return json(403, { error: "Access denied." });
    if (m.status !== "open") return json(400, { error: "Only open markets can be deleted." });

    if (me.balance < DELETE_FEE) return json(400, { error: "Not enough UNC Bucks." });
    me.balance -= DELETE_FEE;
    await setUser(userKey, me);

    const global = await getGlobalState();
    global.treasury += DELETE_FEE;
    await setGlobalState(global);
  }

  // Refund all stakes if open
  if (m.status === "open" && m.userStakes) {
    for (const [uKey, stake] of Object.entries(m.userStakes)) {
      const u = await getUser(uKey);
      u.balance += (stake.yes || 0) + (stake.no || 0);
      await setUser(uKey, u);
    }
  }

  m.status = "deleted";
  await setMarkets(markets);
  return json(200, { ok: true });
}