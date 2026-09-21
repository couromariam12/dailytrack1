import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { AuthError } from "./errors";
import { sessionCookie } from "./oauth";

type Session = { accessToken: string; expiresAt: number | null };
const sessions = new Map<string, Session>();
const maxAge = 60 * 60 * 8;

export function createSession(token: { accessToken: string; expiresAt: number | null }): string { const id = randomBytes(32).toString("base64url"); sessions.set(id, token); return id; }
export function deleteSession(id: string | undefined): void { if (id) sessions.delete(id); }
export function clearSessionsForTests(): void { sessions.clear(); }
export function getSession(request: NextRequest): Session | null { return getSessionById(request.cookies.get(sessionCookie)?.value); }
export function getSessionById(id: string | undefined): Session | null { if (!id) return null; const value = sessions.get(id); if (!value) return null; if (value.expiresAt !== null && value.expiresAt <= Date.now()) { sessions.delete(id); return null; } return value; }
export function requireSession(request: NextRequest): Session { const value = getSession(request); if (!value) throw new AuthError("SESSION_REQUIRED"); return value; }
export function applySessionCookie(response: NextResponse, id: string): void { response.cookies.set(sessionCookie, id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge }); }
export function clearSessionCookie(response: NextResponse): void { response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 }); }
