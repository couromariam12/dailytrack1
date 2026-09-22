import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GiteaServerClient } from "@/lib/gitea/client";
import { currentUser } from "@/lib/gitea/routes";
import { isAdminUser } from "@/lib/auth/authorization";
import { devGiteaClient, getDevAuthStatus, getDevRole } from "@/lib/auth/dev-auth";
import { getSessionById } from "@/lib/auth/session";
import { sessionCookie } from "@/lib/auth/oauth";
import Sidebar from "@/components/sidebar";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = getSessionById((await cookies()).get(sessionCookie)?.value);
  const devStatus = getDevAuthStatus();
  if (!session && devStatus === "disabled") redirect("/settings?next=/collaborator");
  if (!session && devStatus === "forbidden") redirect("/settings?next=/collaborator");
  let user = null;
  let repositories: Array<{ full_name: string | null; name: string | null; html_url: string | null }> = [];
  try {
    const client = session ? new GiteaServerClient(undefined, session.accessToken) : devGiteaClient();
    const [loadedUser, loadedRepositories] = await Promise.all([currentUser(client), client.listRepositories(1, 100)]);
    user = loadedUser;
    repositories = loadedRepositories.map((item) => { const value = item as Record<string, unknown>; return { full_name: typeof value.full_name === "string" ? value.full_name : null, name: typeof value.name === "string" ? value.name : null, html_url: typeof value.html_url === "string" ? value.html_url : null }; });
  } catch { /* The sidebar displays its empty state when Gitea is unavailable. */ }
  return <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]"><Sidebar repositories={repositories} isAdmin={isAdminUser(user) || (devStatus === "enabled" && getDevRole() === "admin")} /><main className="min-w-0 p-4 sm:p-8 lg:p-10">{children}</main></div>;
}
