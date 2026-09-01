# FFZ Risk Calculator — Calculation Specification v0.1

## Supported futures

| Code | Contract | Tick size | Tick value | Point value |
|---|---|---:|---:|---:|
| MNQ | Micro E-mini Nasdaq-100 | 0.25 | $0.50 | $2 |
| MES | Micro E-mini S&P 500 | 0.25 | $1.25 | $5 |
| NQ | E-mini Nasdaq-100 | 0.25 | $5.00 | $20 |
| ES | E-mini S&P 500 | 0.25 | $12.50 | $50 |

CME references:
- https://www.cmegroup.com/markets/equities/nasdaq/micro-e-mini-nasdaq-100.contractSpecs.html
- https://www.cmegroup.com/markets/equities/sp/micro-e-mini-sandp-500.contractSpecs.html
- https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html
- https://www.cmegroup.com/education/files/understanding-stock-index-futures.pdf

## Position sizing

Given:
- `entry`
- `stop`
- `maxRisk`
- instrument spec
- optional commission and fees per contract
- optional slippage buffer in ticks

The engine calculates:

1. `stopDistancePoints = abs(entry - stop)`
2. `stopDistanceTicks = stopDistancePoints / tickSize`
3. `marketRiskPerContract = stopDistanceTicks * tickValue`
4. `commissionAndFeesPerContract` is the entered dollar cost per round-trip contract
5. `slippageBufferPerContract = slippageBufferTicks * tickValue`
6. `totalCostBufferPerContract = commissionAndFeesPerContract + slippageBufferPerContract`
7. `riskPerContract = marketRiskPerContract + totalCostBufferPerContract`
8. `maxContracts = floor(effectiveRiskBudget / riskPerContract)`
9. `actualRisk = maxContracts * riskPerContract`

The engine never rounds contract count up.

## Prop mode

For the first implementation:

`effectiveRiskBudget = min(maxRisk, remainingDrawdown, remainingDailyLoss)`

Only values actually supplied by the user participate in the minimum.

This is deliberately conservative: the calculator should not size a trade beyond an entered firm/account limit.

## Reward-to-risk

If a target is supplied on the correct side of entry:

`R multiple = rewardDistancePoints / stopDistancePoints`

The target does not affect position sizing.

## Risk-level indicator

The initial indicator is based on `actualRisk / remainingDrawdown`:

- LOW: <= 5%
- MODERATE: > 5% and <= 10%
- HIGH: > 10%

These are UI planning defaults, not universal trading-safety thresholds. They should become user-configurable later.

## Important implementation rule

The intended workflow is:

**setup/market structure -> stop location -> risk per contract -> position size**

not:

**desired contract count -> move the stop to make the risk fit**.
