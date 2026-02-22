import {
  json, getClientIp, parseCookies, makeAdminToken,
  setAdminSession, stableUserKeyFromIp
} from "./_lib.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const answer = String(body.answer || "").trim();

  // Always return 200; silently sets admin cookie only if matches secret.
  const secret = process.env.UNC_ADMIN_SECRET || "";
  if (!secret) {
    // Admin secret not set: no-op, but still 200.
    return json(200, { ok: true });
  }

  if (answer === secret) {
    const ip = getClientIp(event);
    const userKey = stableUserKeyFromIp(ip);
    const token = makeAdminToken();

    await setAdminSession(token, { createdAt: Date.now(), userKey });

    // HttpOnly cookie so front-end JS can't read it.
    const cookie = [
      `unc_admin=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Max-Age=43200" // 12 hours
    ].join("; ");

    return json(200, { ok: true }, { "Set-Cookie": cookie });
  }

  return json(200, { ok: true });
}