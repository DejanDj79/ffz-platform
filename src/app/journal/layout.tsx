import type { ReactNode } from "react";
import "./JournalTypography.css";

export default function JournalLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="journalTypography">{children}</div>;
}
