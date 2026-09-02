import { JournalNav } from "@/components/journal/JournalNav";
import { TradeJournal } from "@/components/journal/TradeJournal";

export default function JournalPage() {
  return (
    <>
      <JournalNav active="TRADES" />
      <TradeJournal />
    </>
  );
}
