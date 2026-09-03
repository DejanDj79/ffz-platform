import { PublicRiskCalculator } from "@/components/calculator/PublicRiskCalculator";
import { RiskCalculator } from "@/components/calculator/RiskCalculator";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RiskCalculatorPage() {
  const user = await getCurrentUser();
  return user ? <RiskCalculator /> : <PublicRiskCalculator />;
}
