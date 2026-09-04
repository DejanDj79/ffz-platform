import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { RouteShell } from "@/components/shell/RouteShell";
import "./globals.css";
import "./ui-tweaks.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Futures From Zero",
  description: "Futures From Zero trading tools, challenge tracking and journal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${montserrat.className}`}>
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
