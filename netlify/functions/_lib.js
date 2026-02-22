import crypto from "crypto";
import { getStore } from "@netlify/blobs";

export const STORE_NAME = "unc-markets";

export const START_BALANCE = 1000;
export const CREATE_FEE = 10;
export const DELETE_FEE = 10;

// Helpers
export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function getClientIp(event) {
  // Production on Netlify generally provides x-nf-client-connection-ip. :contentReference[oaicite:2]{index=2}
  const h = event.headers || {};
  const xff = (h["x-forwarded-for"] || h["X-Forwarded-For"] || "").split(",")[0].trim();
  const nfip = (h["x-nf-client-connection-ip"] || h["X-Nf-Client-Connection-Ip"] || "").trim();
  return nfip || xff || "0.0.0.0";
}

export function stableUserKeyFromIp(ip) {
  const salt = process.env.UNC_IP_SALT || "change-me";
  return crypto.createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 24);
}

export function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach(part => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

export function makeAdminToken() {
  // Token is random and stored server-side; cookie holds token only.
  return crypto.randomBytes(24).toString("hex");
}

export function isTruthy(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function now() {
  return Date.now();
}

export function store() {
  // Netlify Blobs store for persistent KV. :contentReference[oaicite:3]{index=3}
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getJson(key, fallback) {
  const s = store();
  const v = await s.get(key);
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export async function setJson(key, obj) {
  const s = store();
  await s.set(key, JSON.stringify(obj));
}

export async function delKey(key) {
  const s = store();
  await s.delete(key);
}

// Data model
export async function getGlobalState() {
  const st = await getJson("state/global", null);
  if (st) return st;
  const init = { treasury: 0 };
  await setJson("state/global", init);
  return init;
}

export async function setGlobalState(st) {
  await setJson("state/global", st);
}

export async function getUser(userKey) {
  const u = await getJson(`user/${userKey}`, null);
  if (u) return u;
  const init = { balance: START_BALANCE, banned: false };
  await setJson(`user/${userKey}`, init);
  return init;
}

export async function setUser(userKey, user) {
  await setJson(`user/${userKey}`, user);
}

export async function getMarkets() {
  return await getJson("markets/list", []);
}

export async function setMarkets(list) {
  await setJson("markets/list", list);
}

export function sanitizeText(s, maxLen) {
  const x = String(s || "").trim();
  if (!x) return "";
  return x.slice(0, maxLen);
}

export function formatHuman(ts) {
  return new Date(ts).toLocaleString();
}

// Admin session storage
export async function getAdminSession(token) {
  if (!token) return null;
  const sess = await getJson(`admin/session/${token}`, null);
  if (!sess) return null;
  // expire after 12 hours
  if (now() - sess.createdAt > 12 * 60 * 60 * 1000) return null;
  return sess;
}

export async function setAdminSession(token, sess) {
  await setJson(`admin/session/${token}`, sess);
}