import { JournalAnalytics } from "@/components/journal/JournalAnalytics";
import { JournalNav } from "@/components/journal/JournalNav";

export default function JournalAnalyticsPage() {
  return (
    <>
      <JournalNav active="ANALYTICS" />
      <JournalAnalytics />
    </>
  );
}
