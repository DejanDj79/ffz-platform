import { DailyTradingDeskFunded } from "@/components/trading-desk/DailyTradingDeskFunded";
import { WeeklyFocusReminder } from "@/components/trading-desk/WeeklyFocusReminder";

export default function TradingDeskPage() {
  return (
    <>
      <WeeklyFocusReminder />
      <DailyTradingDeskFunded />
    </>
  );
}
