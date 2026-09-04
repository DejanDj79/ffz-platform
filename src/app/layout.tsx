import type { Metadata } from "next";
import { League_Spartan } from "next/font/google";
import { RouteShell } from "@/components/shell/RouteShell";
import "./globals.css";
import "./ui-tweaks.css";

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-league-spartan",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Futures From Zero",
  description: "Futures From Zero trading tools, challenge tracking and journal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${leagueSpartan.variable} ${leagueSpartan.className}`}>
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
