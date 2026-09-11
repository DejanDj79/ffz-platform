# Demo / recording account

Use a dedicated normal `USER` account for screenshots and video recording so production recordings never expose the creator account or real trading data.

Recommended address: `video@ffz.app` or `demo@ffz.app`.

Register the account through the normal `/register` flow. If recordings need PRO-only features, grant the account PRO access separately; the reset utility deliberately preserves the account's plan/billing state.

## Production reset

Always run a dry run first from `/opt/ffz`:

```bash
bash scripts/reset-demo-user-production.sh video@ffz.app
```

The dry run identifies the target but changes nothing.

After checking the displayed email and role, execute the reset with:

```bash
bash scripts/reset-demo-user-production.sh video@ffz.app --confirm
```

The production helper builds a short-lived `demo-reset` ops container, connects it only to the production database/backend network, and mounts the Journal upload volume so stored demo Journal images can be removed too.

## What is cleared

The reset removes app/workflow data owned by the demo user: challenges, trading accounts, trades, Journal attachments, ledger entries, scoreboard settings, custom rule presets, trading guardrails, weekly focuses, and any creator-episode drafts accidentally owned by that USER account.

## What is preserved

The user row, password, active sessions, plan/billing state, Founder state, and password-reset state are preserved. This means the same recording account stays logged in and keeps its FREE/PRO entitlement after a reset.

## Safety rules

The reset utility intentionally refuses to run unless all of the following are true:

- the email domain is `ffz.app` or `ffz.local`;
- the email local part contains an obvious recording marker such as `demo`, `video`, `recording`, `screen`, or `youtube`;
- the target exists and has role `USER` (it refuses `CREATOR` accounts);
- destructive execution includes an exact email confirmation. Without confirmation it is always dry-run only.

For local development, the equivalent command is:

```bash
npm run db:reset-demo-user -- --email demo@ffz.local
```

and execution requires:

```bash
npm run db:reset-demo-user -- --email demo@ffz.local --confirm demo@ffz.local
```
