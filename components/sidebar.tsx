"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { repositoryHref } from "./api-client";

export type SidebarRepository = { full_name: string; archived: boolean };

export default function Sidebar({ repositories, isAdmin }: { repositories: SidebarRepository[]; isAdmin: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [repositoriesOpen, setRepositoriesOpen] = useState(true);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) => `block rounded-xl px-3 py-2.5 text-sm font-medium ${active(href) ? "bg-sky-50 text-sky-800" : "text-slate-600 hover:bg-slate-50"}`;

  return (
    <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
      <div className="flex items-center justify-between">
        <Link className="text-xl font-bold tracking-tight text-slate-950" href="/collaborator">
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-sm text-white">D</span>
          DailyTrack
        </Link>
        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 lg:hidden" type="button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen}>Menu</button>
      </div>
      <nav className={`${mobileOpen ? "mt-7" : "hidden lg:mt-7 lg:block"} space-y-1`} aria-label="Navigation principale">
        <Link className={linkClass("/collaborator")} href="/collaborator">Dashboard</Link>
        <div className="pt-5">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Repositories ({repositories.length})</span>
            <button type="button" onClick={() => setRepositoriesOpen((value) => !value)} className="text-lg leading-none text-slate-400" aria-expanded={repositoriesOpen} aria-label={repositoriesOpen ? "Réduire la liste des repositories" : "Afficher la liste des repositories"}>
              {repositoriesOpen ? "−" : "+"}
            </button>
          </div>
          {repositoriesOpen && (
            <div className="mt-2 max-h-[50vh] space-y-1 overflow-y-auto">
              {repositories.length ? repositories.map((repository) => {
                const href = repositoryHref(repository.full_name);
                return (
                  <Link key={repository.full_name} className={`block truncate rounded-xl px-3 py-2 text-sm ${active(href) ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-500 hover:bg-slate-50"}`} href={href} title={repository.full_name}>
                    {repository.full_name}{repository.archived && <span className="ml-1 text-xs text-slate-400">(archivé)</span>}
                  </Link>
                );
              }) : <p className="px-3 py-2 text-sm text-slate-400">Aucun repository accessible.</p>}
            </div>
          )}
        </div>
        <div className="mt-7 space-y-1 border-t border-slate-100 pt-5">
          {isAdmin && <Link className={linkClass("/admin")} href="/admin">Admin</Link>}
          <form method="post" action="/api/auth/gitea/logout">
            <button type="submit" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50">Déconnexion</button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
