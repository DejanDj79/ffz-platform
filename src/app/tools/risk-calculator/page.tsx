import { PublicRiskCalculator } from "@/components/calculator/PublicRiskCalculator";
import { RiskCalculator } from "@/components/calculator/RiskCalculator";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./RiskCalculatorPage.module.css";

export default async function RiskCalculatorPage() {
  const user = await getCurrentUser();

  // Keep the guest calculator standalone. Authenticated users get the same
  // calculations inside the shared FFZ shell and its page-level polish.
  if (!user) return <PublicRiskCalculator />;

  return (
    <div className={styles.authenticatedCalculator}>
      <RiskCalculator />
    </div>
  );
}
