import { NextResponse } from "next/server";
import { AuthError } from "./errors";
import { routeError } from "@/lib/gitea/routes";

export function authErrorResponse(error: unknown): NextResponse { if (error instanceof AuthError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status }); const result = routeError(error); return NextResponse.json(result.body, { status: result.status }); }
