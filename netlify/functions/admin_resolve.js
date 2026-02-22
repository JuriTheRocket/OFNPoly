import {
  json, parseCookies, getAdminSession,
  getGlobalState, setGlobalState,
  getMarkets, setMarkets,
  getUser, setUser,
  clamp, now
} from "./_lib.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const cookies = parseCookies(event.headers?.cookie || "");
  const adminSess = await getAdminSession(cookies["unc_admin"] || "");
  if (!adminSess) return json(403, { error: "Access denied." });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const id = String(body.id || "").trim();
  const outcome = (String(body.outcome || "").toUpperCase() === "YES") ? "YES" : "NO";
  if (!id) return json(400, { error: "Missing id." });

  const markets = await getMarkets();
  const m = markets.find(x => x.id === id);
  if (!m) return json(404, { error: "Not found." });
  if (m.status !== "open") return json(400, { error: "Market not open." });

  const yesTotal = m.pools?.yes || 0;
  const noTotal = m.pools?.no || 0;
  const winnersTotal = outcome === "YES" ? yesTotal : noTotal;
  const losersTotal = outcome === "YES" ? noTotal : yesTotal;

  // Optional early resolution bonus from treasury (small + bounded)
  const global = await getGlobalState();
  const totalTime = Math.max(1, (m.deadlineAt - m.createdAt));
  const timeLeft = m.deadlineAt - now();
  const earlyFactor = clamp(timeLeft / totalTime, 0, 1);
  const maxBonus = losersTotal * 0.15 * earlyFactor;
  const bonus = Math.min(global.treasury, maxBonus);

  if (winnersTotal > 0 && m.userStakes) {
    for (const [uKey, stake] of Object.entries(m.userStakes)) {
      const winStake = outcome === "YES" ? (stake.yes || 0) : (stake.no || 0);
      if (winStake <= 0) continue;

      const share = winStake / winnersTotal;
      const payout = winStake + (share * losersTotal) + (share * bonus);

      const u = await getUser(uKey);
      u.balance += payout;
      await setUser(uKey, u);
    }
    global.treasury -= bonus;
  } else {
    // no winners: losing pool stays in treasury
    global.treasury += losersTotal;
  }

  m.status = "resolved";
  m.outcome = outcome;

  await setGlobalState(global);
  await setMarkets(markets);
  return json(200, { ok: true });
}