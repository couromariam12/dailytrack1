import { NextRequest, NextResponse } from "next/server";
import { requireAdminGiteaClient } from "@/lib/auth/admin";
import { AuthError } from "@/lib/auth/errors";
import { routeError } from "@/lib/gitea/routes";
import { collectAdminExport } from "@/lib/admin/export-data";
import { renderAdminPdf } from "@/lib/admin/export-renderer";
import { exportFilters } from "@/lib/admin/export-schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = exportFilters.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_PARAMETERS", message: "Repository and export filters are required." } }, { status: 400 });
  try {
    const bundle = await collectAdminExport(await requireAdminGiteaClient(request), parsed.data);
    return new NextResponse(new Uint8Array(renderAdminPdf(bundle, parsed.data)), { status: 200, headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="dailytrack-admin.pdf"`, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    const failure = routeError(error); return NextResponse.json(failure.body, { status: failure.status });
  }
}
