import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DailyTrack",
  description: "Lecture de l’activité observable dans Gitea.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
