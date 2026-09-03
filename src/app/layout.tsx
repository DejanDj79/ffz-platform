import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { RouteShell } from "@/components/shell/RouteShell";
import "./globals.css";
import "./ui-tweaks.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Futures From Zero",
  description: "Futures From Zero trading tools, challenge tracking and journal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={poppins.variable}>
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
