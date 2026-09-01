# FFZ Challenge Planner — Sprint 2 calculation spec

## Purpose

The first planner is intentionally generic. It provides a useful challenge dashboard before we build firm-specific rules.

## Current model

### Current P&L

`current balance - starting balance`

### Profit target remaining

`max(0, profit target - current P&L)`

### Progress to target

`current P&L / profit target`, clamped from 0% to 100%.

### Remaining drawdown

Sprint 2 uses a **static drawdown** planning model:

`max drawdown + current P&L`, clamped between `0` and `max drawdown`.

This means profits do not increase the displayed drawdown buffer above the configured maximum.

This is NOT intended to model trailing drawdown rules.

### Remaining daily loss

The generic Sprint 2 model assumes a fixed daily loss allowance. Negative Today's P&L consumes that allowance; positive P&L does not increase it.

### Real money cost

`challenge fee + reset fee × resets used`

### Challenge health

Uses the tighter of the remaining drawdown percentage and remaining daily-loss percentage:

- SAFE: > 50% remaining
- CAUTION: > 25% and <= 50% remaining
- DANGER: <= 25% remaining
- FAILED challenges are always DANGER

These are planning indicators, not a statement that a challenge or trade is objectively safe.

## Later rule engine

Firm presets should explicitly support rule types such as:

- static drawdown
- intraday trailing drawdown
- end-of-day trailing drawdown
- trailing drawdown that stops at a threshold
- daily loss rules
- consistency rules
- minimum trading days
- payout eligibility rules

We should not infer these rules only from the prop-firm name.
