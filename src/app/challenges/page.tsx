import Link from "next/link";
import { ChallengeFundedPlanner } from "@/components/challenges/ChallengeFundedPlanner";
import styles from "./page.module.css";

export const metadata = {
  title: "Challenge / Funded | Futures From Zero",
  description: "Track prop evaluations, funded accounts and payout readiness with Futures From Zero.",
};

export default function ChallengesPage() {
  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <strong>PROP FIRM RULES</strong>
          <span>Review verified presets or use Custom / Manual for any firm or account plan.</span>
        </div>
        <Link href="/tools/prop-firm-rules">OPEN RULES LIBRARY</Link>
      </div>
      <ChallengeFundedPlanner />
    </>
  );
}
