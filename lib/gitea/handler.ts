import { NextRequest, NextResponse } from "next/server";
import { routeError } from "./routes";
import type { ZodType } from "zod";
import type { GiteaServerClient } from "./client";
import { authenticatedGiteaClient } from "@/lib/auth/client";
import { AuthError } from "@/lib/auth/errors";

export function errorToResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  const failure = routeError(error);
  return NextResponse.json(failure.body, { status: failure.status });
}

export async function handleAuthenticatedQuery<T>(request: NextRequest, schema: ZodType<T>, operation: (input: T, client: GiteaServerClient) => Promise<unknown>): Promise<NextResponse> {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_PARAMETERS", message: "Invalid query parameters." } }, { status: 400 });
  return handleAuthenticatedOperation(request, (client) => operation(parsed.data, client));
}

export async function handleAuthenticatedOperation(request: NextRequest, operation: (client: GiteaServerClient) => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await operation(authenticatedGiteaClient(request)));
  } catch (error) {
    return errorToResponse(error);
  }
}
