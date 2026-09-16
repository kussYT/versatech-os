import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VersaTech OS",
    template: "%s · VersaTech OS",
  },
  description:
    "Système d'exploitation interne pour piloter l'activité VersaTech.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
