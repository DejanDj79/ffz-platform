# FFZ Scoreboard v1 + Image Application Background

This patch adds:

1. Authenticated Scoreboard settings page
2. Public OBS Browser Source overlay
3. Compact and Full layouts
4. Automatic polling from PostgreSQL-backed FFZ data
5. Regeneratable public overlay URL
6. Image-based FFZ application background support
7. Scoreboard item in the shared App Shell navigation

---

# IMPORTANT: application background image

The patch DOES NOT contain a background image.

Put your image here:

```text
ffz-platform/public/ffz-app-background.jpg
```

Exact filename:

```text
ffz-app-background.jpg
```

The App Shell CSS loads it as:

```css
url("/ffz-app-background.jpg")
```

Recommended image:

```text
1920x1080 or larger
16:9
dark / low-contrast
JPG is fine
```

If the file does not exist yet, the application continues to work with its
dark CSS fallback.

The background applies to the main authenticated application shell.

It does NOT apply to the OBS overlay because the OBS overlay must remain
transparent.

---

# Scoreboard architecture

Authenticated configuration:

```text
/scoreboard
```

Public OBS page:

```text
/overlays/scoreboard/<OVERLAY_KEY>
```

Public read-only data:

```text
/api/public/scoreboard/<OVERLAY_KEY>
```

The public overlay does not require a FFZ login session.

Editing still requires normal FFZ authentication.

The public URL exposes only scoreboard data selected by this feature. It does
not provide access to Challenge editing, Journal editing, Ledger editing or
the user's FFZ session.

The URL can be regenerated at any time. Regenerating it immediately invalidates
the old OBS link.

---

# What Scoreboard v1 can display

Challenge:
- Challenge name / prop firm
- Phase / status
- Current balance
- Challenge P&L
- Profit target progress

Journal, scoped to selected challenge:
- Trade count
- Win Rate
- Average R

Real Money Ledger, journey-wide:
- Real Money Net
- Real Payouts

Season goal:
- configurable text, default `FIRST REAL PAYOUT`

Two layouts:
- COMPACT
- FULL

Every metric can be enabled/disabled.

---

# Database

New table:

```text
scoreboard_settings
```

One settings row per authenticated FFZ user.

Run:

```bash
npm run db:push
```

Do NOT reset the database.

---

# Existing files intentionally replaced

```text
src/db/schema.ts
src/components/shell/AppShell.tsx
src/components/shell/AppShell.module.css
```

Why AppShell changes:
- add Scoreboard navigation
- bypass normal authenticated shell for `/overlays/*`
- add image application background

All other Scoreboard files are new.

---

# Install

First commit the working Dashboard if you have not already:

```bash
git status
git add .
git commit -m "Add FFZ Dashboard v1"
git push
```

Then copy this patch into the project root.

Run:

```bash
npm run db:push
npm run test
npm run dev
```

---

# Test Scoreboard settings

Open:

```text
/scoreboard
```

The first visit creates the user's default Scoreboard settings automatically.

Select:
- Challenge
- COMPACT or FULL
- visible metrics
- refresh interval

Click:

```text
SAVE SCOREBOARD
```

The page shows a live preview.

---

# OBS setup

On `/scoreboard`, copy the generated Browser Source URL.

In OBS:

```text
Sources
→ +
→ Browser
```

Use:

```text
Width:  1920
Height: 1080
```

Paste the generated URL.

The page background is transparent.

COMPACT layout appears in the upper-left portion of the browser canvas.

FULL layout appears as a wide lower-third.

You can position/crop/scale the Browser Source normally inside OBS.

---

# Live updates

Scoreboard v1 uses polling rather than WebSockets.

Default:

```text
every 5 seconds
```

Available:
- 2 sec
- 5 sec
- 10 sec
- 30 sec

This is sufficient for recording/streaming while keeping the implementation
simple and reliable.

Later we can replace polling with live push updates if there is a real need.

---

# Important data rule

Trading stats:

```text
selected Challenge → linked Journal trades
```

Real Money values:

```text
whole FFZ journey → Real Money Ledger
```

This means the scoreboard can truthfully show both:

```text
Challenge P&L
```

and:

```text
Real Money Net
```

without mixing simulated/funded account value with actual money received.

---

# Git checkpoint

When everything passes:

```bash
git add .
git commit -m "Add FFZ OBS Scoreboard v1"
git push
```

---

# Background reminder

When you have chosen the final background, simply copy it to:

```text
public/ffz-app-background.jpg
```

Then refresh the app.

No code change is required.
