import { ChallengeFundedPlanner } from "@/components/challenges/ChallengeFundedPlanner";
import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export const metadata = {
  title: "Challenge / Funded | Futures From Zero",
  description: "Track prop evaluations, funded accounts and payout readiness with Futures From Zero.",
};

export default async function ChallengesPage() {
  const user = await getCurrentUser();
  const unlimited = Boolean(
    user && hasEntitlement(user.plan, "MULTIPLE_ACTIVE_CHALLENGES"),
  );

  return (
    <>
      {!unlimited && (
        <div style={{ marginBottom: 16 }}>
          <ProFeatureGate
            title="Free plan: 1 active prop account"
            description="You can keep using FFZ with one active evaluation or funded account. Failed, passed and closed history stays visible; Pro removes the active-account limit and enables automatic Journal → Challenge sync."
            features={["Unlimited active accounts", "Automatic Journal balance sync", "Multi-account prop workflow"]}
            compact
          />
        </div>
      )}
      <ChallengeFundedPlanner />
    </>
  );
}
