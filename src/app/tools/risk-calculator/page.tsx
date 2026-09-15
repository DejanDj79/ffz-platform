import { PublicRiskCalculator } from "@/components/calculator/PublicRiskCalculator";
import { RiskCalculator } from "@/components/calculator/RiskCalculator";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./RiskCalculatorPage.module.css";

export default async function RiskCalculatorPage() {
  const user = await getCurrentUser();

  // Guest mode stays standalone; authenticated mode receives AppShell polish.
  if (!user) {
    return (
      <div className={styles.publicCalculator}>
        <PublicRiskCalculator />
        <aside className={styles.publicDisclaimer} aria-label="Risk calculator disclaimer">
          <strong>Calculation tool only.</strong>
          <span>
            Results are mathematical outputs based solely on values you enter. They are not trading signals,
            recommendations or financial advice, and FFZ does not execute or route trades.
          </span>
        </aside>
      </div>
    );
  }

  return (
    <div className={styles.authenticatedCalculator}>
      <RiskCalculator />
    </div>
  );
}
