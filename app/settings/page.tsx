import TokenLoginForm from "@/components/token-login-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">DailyTrack</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Paramètres / Connexion</h1><p className="mt-3 text-slate-600">Connecte ton compte Gitea avec un token personnel conservé uniquement côté serveur.</p><TokenLoginForm /></div></main>;
}
