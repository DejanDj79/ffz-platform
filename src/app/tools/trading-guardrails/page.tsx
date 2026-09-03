import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { TradingGuardrailsSettings } from "@/components/trading-guardrails/TradingGuardrailsSettings";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export default async function TradingGuardrailsPage() {
  const user = await getCurrentUser();

  if (!user || !hasEntitlement(user.plan, "TRADING_GUARDRAILS")) {
    return (
      <ProFeatureGate
        title="Personal Trading Guardrails"
        description="Turn your trading plan into enforceable limits inside FFZ. Pro connects your risk, daily loss state and news windows directly to the pre-trade verdict."
        features={["Max risk per trade", "Daily loss and trade limits", "Contract cap", "Minimum R:R", "Time cutoff", "Economic-news lockout"]}
      />
    );
  }

  return <TradingGuardrailsSettings />;
}
