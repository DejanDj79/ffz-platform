import { FreePropFirmRulesLibrary } from "@/components/prop-firms/FreePropFirmRulesLibrary";
import { PropFirmRulesLibrary } from "@/components/prop-firms/PropFirmRulesLibrary";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";

export default async function PropFirmRulesPage() {
  const user = await getCurrentUser();
  const customRulesEnabled = Boolean(
    user && hasEntitlement(user.plan, "CUSTOM_PROP_RULES"),
  );

  return customRulesEnabled ? <PropFirmRulesLibrary /> : <FreePropFirmRulesLibrary />;
}
