import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { PropJourneyAnalytics } from "@/components/prop-journey/PropJourneyAnalytics";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export default async function PropJourneyPage() {
  const user = await getCurrentUser();

  if (!user || !hasEntitlement(user.plan, "PROP_JOURNEY_ANALYTICS")) {
    return (
      <ProFeatureGate
        title="Know whether your prop journey is actually profitable"
        description="FFZ Pro turns your Real Money Ledger and tracked prop accounts into one financial journey: real costs, payouts, break-even progress, firm economics and account-level net results."
        features={[
          "Real Prop Journey P&L",
          "Break-even recovery progress",
          "Cost and payout analytics",
          "Prop firm performance",
          "Account economics",
          "Evaluation → funded → payout funnel",
        ]}
      />
    );
  }

  return <PropJourneyAnalytics />;
}
