import crypto from "crypto";
import type { NextRequest } from "next/server";

// ChazMaster admin gate — single shared PIN protects all database-mutating
// actions (upload, edit, delete, accept/reject requests, settings, seed).
const ADMIN_PIN = "1607";
export const ADMIN_COOKIE_NAME = "chazmaster_admin";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  // Falls back to a fixed dev secret if not configured — fine for a PIN-gated
  // hobby app; set ADMIN_COOKIE_SECRET in production for extra safety.
  return process.env.ADMIN_COOKIE_SECRET || "chazmaster-admin-secret-1607";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPin(pin: string): boolean {
  return typeof pin === "string" && pin.trim() === ADMIN_PIN;
}

export function createAdminToken(): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `admin:${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!timingSafeEqual(sign(payload), sig)) return false;
  const [tag, expiresStr] = payload.split(":");
  if (tag !== "admin") return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  return true;
}

// Use inside any API route that mutates the database.
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}
