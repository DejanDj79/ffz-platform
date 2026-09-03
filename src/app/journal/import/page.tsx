import { DeepChartsImport } from "@/components/journal/DeepChartsImport";
import { ProFeatureGate } from "@/components/monetization/ProFeatureGate";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export default async function JournalImportPage() {
  const user = await getCurrentUser();

  if (!user || !hasEntitlement(user.plan, "CSV_IMPORT")) {
    return (
      <ProFeatureGate
        title="CSV Trade Import"
        description="Manual Journal entry stays available on FFZ Free. Pro lets you bring closed trades in from DeepCharts instead of entering them one by one."
        features={["DeepCharts CSV import", "Bulk trade creation", "Keep challenge links and trade metadata", "Faster Journal backfill"]}
      />
    );
  }

  return <DeepChartsImport />;
}
