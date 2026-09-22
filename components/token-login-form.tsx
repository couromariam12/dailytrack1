"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { login: string | null; full_name: string | null; html_url: string | null };

export default function TokenLoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/token/status", { cache: "no-store" }).then(async (response) => { if (response.ok) setUser((await response.json()).user as User); });
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/token/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = await response.json() as { user?: User; error?: { message?: string } };
      if (!response.ok) { setError(body.error?.message ?? "Connexion Gitea impossible."); return; }
      setToken(""); setUser(body.user ?? null); setMessage("Connexion Gitea réussie."); router.push(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch { setError("Impossible de joindre DailyTrack."); }
    finally { setLoading(false); }
  }

  return <div className="mt-8 space-y-6"><section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">Compte connecté</p>{user ? <p className="mt-2 text-sm text-slate-600">{user.login ?? user.full_name ?? "Utilisateur Gitea"}</p> : <p className="mt-2 text-sm text-slate-500">Aucun compte token connecté.</p>}</section><form onSubmit={login} className="space-y-4"><label className="block text-sm font-semibold text-slate-700" htmlFor="gitea-token">Token personnel Gitea<input id="gitea-token" name="token" type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" placeholder="Saisi uniquement côté serveur" /></label><button type="submit" disabled={loading || !token} className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Vérification…" : user ? "Tester et remplacer le token" : "Tester la connexion"}</button></form>{message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}<div className="flex flex-wrap gap-3 text-sm"><a className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700" href="/api/auth/gitea/login">Utiliser OAuth Gitea</a><a className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700" href="/api/auth/gitea/logout">Déconnecter</a></div><p className="text-xs leading-5 text-slate-500">Le token n’est jamais affiché, enregistré dans le navigateur ou placé dans l’URL. La session temporaire est conservée en mémoire et sera perdue après un redémarrage du serveur. Durée maximale : 8 heures.</p></div>;
}

function safeNext(value: string | null): string { return value && value.startsWith("/") && !value.startsWith("//") ? value : "/collaborator"; }
