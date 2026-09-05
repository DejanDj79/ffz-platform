import { PublicRiskCalculator } from "@/components/calculator/PublicRiskCalculator";
import { RiskCalculator } from "@/components/calculator/RiskCalculator";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./RiskCalculatorPage.module.css";

export default async function RiskCalculatorPage() {
  const user = await getCurrentUser();

  // Guest mode stays standalone; authenticated mode receives AppShell polish.
  if (!user) return <PublicRiskCalculator />;

  return (
    <div className={styles.authenticatedCalculator}>
      <RiskCalculator />
    </div>
  );
}
