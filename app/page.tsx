import Link from "next/link";
import type { AuthErrorCode } from "@/lib/auth/errors";

const authErrorMessages: Record<AuthErrorCode, string> = {
  AUTH_CONFIGURATION: "L’authentification Gitea n’est pas configurée (GITEA_URL, GITEA_OAUTH_CLIENT_ID, GITEA_OAUTH_REDIRECT_URI et AUTH_SECRET d’au moins 32 caractères).",
  OAUTH_PROVIDER_ERROR: "Gitea a refusé ou n’a pas terminé la connexion. Réessayez.",
  OAUTH_STATE_MISMATCH: "La demande de connexion a expiré ou n’est pas valide. Réessayez.",
  OAUTH_INVALID_CALLBACK: "Le retour de Gitea est invalide. Réessayez.",
  SESSION_REQUIRED: "Veuillez vous connecter.",
  SESSION_EXPIRED: "Votre session a expiré. Reconnectez-vous.",
  SESSION_INVALID: "Votre session n’est plus valide. Reconnectez-vous.",
  DEV_AUTH_FORBIDDEN: "DAILYTRACK_DEV_AUTH=true est interdit en production : désactivez-le pour utiliser l’application.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const { auth_error: code } = await searchParams;
  const error = code && code in authErrorMessages ? authErrorMessages[code as AuthErrorCode] : null;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">DailyTrack</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Votre daily à partir de Gitea</h1>
        <p className="mt-4 max-w-xl leading-7 text-slate-600">
          Tickets, pull requests, commits et reviews du dernier jour ouvré, lus directement dans Gitea avec votre compte.
        </p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        <nav className="mt-8 flex flex-wrap gap-3" aria-label="Espaces DailyTrack">
          <Link className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white" href="/collaborator">Mon daily</Link>
          <Link className="rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-semibold text-sky-800" href="/api/auth/gitea/login" prefetch={false}>Se connecter avec Gitea</Link>
          <Link className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" href="/admin">Espace admin</Link>
        </nav>
      </section>
    </main>
  );
}
