import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GiteaServerClient } from "@/lib/gitea/client";
import { currentUser } from "@/lib/gitea/routes";
import { isAdminUser } from "@/lib/auth/authorization";
import { getDevAuthStatus, getDevRole } from "@/lib/auth/dev-auth";
import { getSessionById } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/oauth";
import AdminDashboard from "@/components/admin-dashboard";

export default async function AdminPage() {
  const session = getSessionById((await cookies()).get(sessionCookie)?.value);
  const devStatus = getDevAuthStatus();
  if (!session && devStatus !== "enabled") redirect("/api/auth/gitea/login");
  let authorized = false;
  try { authorized = devStatus === "enabled" ? getDevRole() === "admin" : isAdminUser(await currentUser(new GiteaServerClient(undefined, session?.accessToken))); } catch { authorized = false; }
  if (!authorized) redirect("/collaborator");
  return <AdminDashboard />;
}
