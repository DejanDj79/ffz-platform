import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  challenges,
  ledgerEntries,
  scoreboardSettings,
  tradeAttachments,
  trades,
  tradingAccounts,
  users,
} from "./schema";
import { creatorEpisodes } from "./creator-episodes-schema";
import { customRulePresets } from "./custom-rule-presets-schema";
import { tradingGuardrailSettings } from "./trading-guardrails-schema";
import { weeklyFocuses } from "./weekly-focus-schema";
import { deleteStoredImage } from "../lib/storage/image-storage";

const DEMO_EMAIL_MARKERS = ["demo", "video", "recording", "screen", "youtube"];
const ALLOWED_DEMO_DOMAINS = new Set(["ffz.app", "ffz.local"]);

type CliOptions = {
  email: string | null;
  confirm: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  let email: string | null = null;
  let confirm: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--email") {
      email = argv[index + 1]?.trim().toLowerCase() ?? null;
      index += 1;
      continue;
    }

    if (arg === "--confirm") {
      confirm = argv[index + 1]?.trim().toLowerCase() ?? null;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Reset a dedicated FFZ demo/video USER account while preserving login and plan/billing state.",
          "",
          "Dry run:",
          "  npx tsx src/db/reset-demo-user.ts --email video@ffz.app",
          "",
          "Execute:",
          "  npx tsx src/db/reset-demo-user.ts --email video@ffz.app --confirm video@ffz.app",
        ].join("\n"),
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { email, confirm };
}

function assertDemoEmail(email: string) {
  const [localPart, domain, ...extraParts] = email.split("@");

  if (!localPart || !domain || extraParts.length > 0) {
    throw new Error("A valid demo account email is required.");
  }

  if (!ALLOWED_DEMO_DOMAINS.has(domain)) {
    throw new Error(
      `Refusing to reset ${email}. Demo reset is restricted to ffz.app/ffz.local accounts.`,
    );
  }

  if (!DEMO_EMAIL_MARKERS.some((marker) => localPart.includes(marker))) {
    throw new Error(
      `Refusing to reset ${email}. The account name must clearly identify it as a demo/video/recording/screen/youtube account.`,
    );
  }
}

async function main() {
  const { email, confirm } = parseArgs(process.argv.slice(2));

  if (!email) {
    throw new Error("Missing --email. Example: --email video@ffz.app");
  }

  assertDemoEmail(email);

  const matches = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = matches[0];

  if (!user) {
    throw new Error(`No FFZ user found for ${email}`);
  }

  if (user.role !== "USER") {
    throw new Error(
      `Refusing to reset ${email}: only USER accounts can be reset. Current role is ${user.role}.`,
    );
  }

  const attachments = await db
    .select({ storageKey: tradeAttachments.storageKey })
    .from(tradeAttachments)
    .where(eq(tradeAttachments.userId, user.id));

  console.log("FFZ demo account reset target:");
  console.log({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    storedJournalImages: attachments.length,
  });
  console.log("");
  console.log(
    "Will clear: challenges, trading accounts, trades, Journal attachments, ledger entries, scoreboard settings, custom rule presets, trading guardrails, weekly focuses and any creator-episode drafts owned by this USER account.",
  );
  console.log(
    "Will preserve: the user account, password, active sessions, plan/billing state, Founder state and password-reset state.",
  );

  if (confirm !== email) {
    console.log("");
    console.log("DRY RUN ONLY — no data was changed.");
    console.log(`To execute, repeat with: --confirm ${email}`);
    return;
  }

  await db.transaction(async (tx) => {
    // Delete child/user-owned records explicitly. The account itself and all
    // authentication/entitlement/billing records are deliberately preserved.
    await tx.delete(scoreboardSettings).where(eq(scoreboardSettings.userId, user.id));
    await tx.delete(ledgerEntries).where(eq(ledgerEntries.userId, user.id));
    await tx.delete(tradeAttachments).where(eq(tradeAttachments.userId, user.id));
    await tx.delete(creatorEpisodes).where(eq(creatorEpisodes.userId, user.id));
    await tx.delete(trades).where(eq(trades.userId, user.id));
    await tx.delete(challenges).where(eq(challenges.userId, user.id));
    await tx.delete(tradingAccounts).where(eq(tradingAccounts.userId, user.id));
    await tx.delete(customRulePresets).where(eq(customRulePresets.userId, user.id));
    await tx
      .delete(tradingGuardrailSettings)
      .where(eq(tradingGuardrailSettings.userId, user.id));
    await tx.delete(weeklyFocuses).where(eq(weeklyFocuses.userId, user.id));
  });

  for (const attachment of attachments) {
    await deleteStoredImage(attachment.storageKey);
  }

  console.log("");
  console.log(`Demo account ${email} has been reset to a clean app-data state.`);
  console.log("Authentication and plan/billing access were preserved.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
