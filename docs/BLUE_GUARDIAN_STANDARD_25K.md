# Blue Guardian Futures — Standard 25K

Preset verification date: 2026-09-01.

## Rules used by FFZ

- Profit target: $1,500 (6%)
- Position limit: 1 Mini / 10 Micros
- Daily loss limit: none on the 25K Standard account
- Drawdown mode: End-of-Day trailing
- Evaluation/funded trail: when the trailing floor reaches the starting balance, it stops trailing there
- After a funded payout: Blue Guardian publishes a permanent floor of starting balance + $100
- Evaluation consistency rule: none
- Funded payout consistency: 40%
- News trading: allowed

## Important 25K max-drawdown note

Blue Guardian's official help material has shown conflicting 25K max-drawdown values in recent versions/crawls. The existing FFZ preset remains at $1,500 for continuity, but this field is editable. Verify the exact drawdown displayed on the purchased account/checkout before trading.

The EOD lock logic is now separated correctly from the post-payout +$100 rule: evaluation uses a `drawdownLockFloorOffset` of `0`; the preset stores `postPayoutDrawdownLockFloorOffset = 100` as future payout/ledger metadata.
