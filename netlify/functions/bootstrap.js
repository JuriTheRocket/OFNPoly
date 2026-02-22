import {
  json, getClientIp, stableUserKeyFromIp, parseCookies,
  getUser, getGlobalState, getMarkets, getAdminSession, now, formatHuman
} from "./_lib.js";

export async function handler(event) {
  const ip = getClientIp(event);
  const userKey = stableUserKeyFromIp(ip);

  const cookies = parseCookies(event.headers?.cookie || "");
  const adminToken = cookies["unc_admin"] || "";
  const adminSess = await getAdminSession(adminToken);
  const isAdmin = !!adminSess;

  const me = await getUser(userKey);
  if (me.banned) {
    return json(403, { error: "Access denied." });
  }

  const global = await getGlobalState();
  const markets = await getMarkets();

  const outMarkets = markets
    .filter(m => m.status !== "deleted")
    .map(m => ({
      id: m.id,
      title: m.title,
      desc: m.desc,
      category: m.category,
      status: m.status,
      outcome: m.outcome || null,
      createdAt: m.createdAt,
      deadlineAt: m.deadlineAt,
      createdAtHuman: formatHuman(m.createdAt),
      deadlineAtHuman: formatHuman(m.deadlineAt),
      pools: { yes: m.pools?.yes || 0, no: m.pools?.no || 0 },
      me: {
        yes: (m.userStakes?.[userKey]?.yes) || 0,
        no: (m.userStakes?.[userKey]?.no) || 0
      },
      isCreator: m.creatorKey === userKey
    }));

  return json(200, {
    me: { key: userKey, balance: me.balance },
    markets: outMarkets,
    treasury: global.treasury,
    isAdmin
  });
}