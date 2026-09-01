# Optional Risk Calculator rule-summary edit

Find the selected-challenge note near the bottom of the INPUTS panel.

Replace:

```tsx
Using {selectedChallenge.name || selectedChallenge.propFirm}: {selectedChallenge.drawdownMode?.replaceAll("_", " ") ?? "STATIC"} drawdown · max {selectedChallenge.maxMinis ?? "—"} mini / {selectedChallenge.maxMicros ?? "—"} micros.
```

with:

```tsx
Using {selectedChallenge.name || selectedChallenge.propFirm}: max {selectedChallenge.maxMinis ?? "—"} mini / {selectedChallenge.maxMicros ?? "—"} micros · {selectedChallenge.drawdownMode?.replaceAll("_", " ") ?? "STATIC"} drawdown · daily loss {selectedChallenge.dailyLossLimit > 0 ? money.format(selectedChallenge.dailyLossLimit) : "NO LIMIT"}.
```

This does not change your Maximum Contracts card.
