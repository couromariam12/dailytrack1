import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">DailyTrack</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Nouvelle application Next.js</h1>
        <p className="mt-4 max-w-xl leading-7 text-slate-600">
          Le socle est prêt. Les données Gitea seront ajoutées après validation des contrats serveur et de l’authentification.
        </p>
        <nav className="mt-8 flex flex-wrap gap-3" aria-label="Espaces DailyTrack">
          <Link className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white" href="/collaborator">Espace collaborateur</Link>
          <Link className="rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-semibold text-sky-800" href="/api/auth/gitea/login">Se connecter avec Gitea</Link>
          <Link className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" href="/admin">Espace admin</Link>
        </nav>
      </section>
    </main>
  );
}
