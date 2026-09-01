import { ModulePlaceholder } from "@/components/shell/ModulePlaceholder";

export default function LedgerPage() {
  return (
    <ModulePlaceholder
      title="Real Money Ledger"
      description="This route is reserved for challenge fees, resets, platform costs and actual payouts without mixing them with account P&L."
      nextStep="Build after the Trade Journal foundation is connected to persistent storage."
    />
  );
}
