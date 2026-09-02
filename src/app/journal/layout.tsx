import "./JournalTypography.css";

export default function JournalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="journalTypography">{children}</div>;
}
