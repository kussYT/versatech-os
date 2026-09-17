import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/dal";
import { isPublicPath } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { PATHNAME_HEADER } from "@/lib/security/headers";
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
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  const user = isPublicPath(pathname)
    ? await getSessionUser()
    : await requireAuthenticatedUser();

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
