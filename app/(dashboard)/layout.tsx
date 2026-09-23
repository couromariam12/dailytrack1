import { allRepositories } from "@/lib/gitea/routes";
import { isAdmin, requireServerAuth } from "@/lib/auth/server";
import Sidebar, { type SidebarRepository } from "@/components/sidebar";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireServerAuth();
  let repositories: SidebarRepository[] = [];
  try {
    repositories = (await allRepositories(auth.client))
      .filter((repository): repository is typeof repository & { full_name: string } => Boolean(repository.full_name))
      .map((repository) => ({ full_name: repository.full_name, archived: repository.archived === true }));
  } catch {
    // The sidebar displays its empty state when Gitea is unavailable.
  }
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <Sidebar repositories={repositories} isAdmin={await isAdmin(auth)} />
      <main className="min-w-0 p-4 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
