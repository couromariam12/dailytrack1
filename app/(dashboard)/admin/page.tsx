import { redirect } from "next/navigation";
import { isAdmin, requireServerAuth } from "@/lib/auth/server";
import AdminDashboard from "@/components/admin-dashboard";

export default async function AdminPage() {
  if (!(await isAdmin(await requireServerAuth()))) redirect("/collaborator");
  return <AdminDashboard />;
}
