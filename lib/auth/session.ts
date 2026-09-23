import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { AUTH_SECRET_MIN_LENGTH, getServerEnv } from "@/lib/server-env";
import { AuthError } from "./errors";
import { sessionCookie, type OAuthToken } from "./oauth";

/**
 * The session lives in an AES-256-GCM encrypted, HTTP-only cookie keyed by AUTH_SECRET: it survives
 * restarts, works across instances and needs no server storage. The token never reaches the browser
 * in clear text.
 */
export type Session = { accessToken: string; expiresAt: number };

/** Upper bound of a session, even when Gitea issues a longer-lived token. */
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function sessionKey(): Buffer {
  const secret = getServerEnv().authSecret;
  if (secret.length < AUTH_SECRET_MIN_LENGTH) throw new AuthError("AUTH_CONFIGURATION", 503);
  return createHash("sha256").update(`dailytrack-session:${secret}`).digest();
}

export function createSession(token: OAuthToken, now = Date.now()): Session {
  const limit = now + SESSION_MAX_AGE_MS;
  return { accessToken: token.accessToken, expiresAt: token.expiresAt === null ? limit : Math.min(token.expiresAt, limit) };
}

export function sealSession(session: Session): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64url");
}

/** Decrypts and validates a session cookie. Throws an AuthError describing why it is unusable. */
export function openSession(value: string | undefined, now = Date.now()): Session {
  if (!value) throw new AuthError("SESSION_REQUIRED");
  const key = sessionKey();
  let session: unknown;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    session = JSON.parse(Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString("utf8"));
  } catch {
    throw new AuthError("SESSION_INVALID");
  }
  if (!isSession(session)) throw new AuthError("SESSION_INVALID");
  if (session.expiresAt <= now) throw new AuthError("SESSION_EXPIRED");
  return session;
}

/** Same as openSession, but returns null instead of throwing (for server components). */
export function readSession(value: string | undefined): Session | null {
  try {
    return openSession(value);
  } catch {
    return null;
  }
}

export function requireSession(request: NextRequest): Session {
  return openSession(request.cookies.get(sessionCookie)?.value);
}

export function applySessionCookie(response: NextResponse, session: Session, now = Date.now()): void {
  response.cookies.set(sessionCookie, sealSession(session), { ...cookieOptions(), maxAge: Math.max(0, Math.floor((session.expiresAt - now) / 1000)) });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookie, "", { ...cookieOptions(), maxAge: 0 });
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
}

function isSession(value: unknown): value is Session {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.accessToken === "string" && candidate.accessToken !== "" && typeof candidate.expiresAt === "number";
}
