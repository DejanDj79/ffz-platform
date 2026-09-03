import { FreeJournalAnalytics } from "@/components/journal/FreeJournalAnalytics";
import { JournalAnalytics } from "@/components/journal/JournalAnalytics";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export default async function JournalAnalyticsPage() {
  const user = await getCurrentUser();
  const advanced = Boolean(
    user &&
    hasEntitlement(user.plan, "SETUP_ANALYTICS") &&
    hasEntitlement(user.plan, "TIME_OF_DAY_ANALYTICS"),
  );

  return advanced ? <JournalAnalytics /> : <FreeJournalAnalytics />;
}
