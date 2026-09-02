# FFZ Journal Screenshots v1

Adds image attachments to Trade Journal.

## What it does

Each trade can have up to:

```text
10 screenshots
```

Supported:

```text
JPG
PNG
WEBP
```

Maximum:

```text
8 MB per image
40 MB per upload batch
```

The New/Edit Trade form now has:

```text
SCREENSHOTS
Drop screenshots here
or
ADD IMAGES
```

You can select multiple screenshots before saving a new trade.

Queued screenshots show thumbnails immediately.

Existing screenshots show when editing a trade.

Clicking a thumbnail opens the image in a fullscreen lightbox.

---

## Trade Details

Trade History now has:

```text
View
Edit
Delete
```

`View` opens a Trade Details overlay.

It shows:
- key trade facts
- Setup
- Tags
- Notes
- screenshot thumbnails

Click any screenshot thumbnail.

The image opens fullscreen.

Controls:

```text
ESC       close
←         previous image
→         next image
click X   close
click outside the image   close
```

The lightbox also shows:

```text
filename
2 / 5
```

---

# Storage design

PostgreSQL does NOT store the image bytes.

New table:

```text
trade_attachments
```

stores:

```text
id
user_id
trade_id
storage_key
original_filename
mime_type
file_size_bytes
sort_order
created_at
```

Actual files go to:

```text
ffz-platform/data/uploads/
```

by default.

You can override that later with:

```text
FFZ_UPLOAD_DIR=/some/persistent/path
```

This means the Journal UI/API does not need to change when we later move image
storage to a production storage provider.

---

# Security

Screenshots are NOT written into:

```text
public/
```

and there is no raw public file URL.

Every image request goes through:

```text
/api/journal/trades/<tradeId>/attachments/<attachmentId>/file
```

The server checks:
- logged-in user
- trade ownership
- attachment ownership

A user cannot request another user's Journal screenshot by guessing an ID.

Upload validation also checks:
- allowed MIME type
- actual JPG/PNG/WEBP file signature
- file size
- maximum attachment count

---

# Important `.gitignore`

Add this line to the project's existing `.gitignore`:

```gitignore
/data/uploads/
```

Do not commit uploaded screenshots to Git.

---

# Database

The patch adds:

```text
trade_attachments
```

Run:

```bash
npm run db:push
```

Do NOT reset PostgreSQL.

---

# Install

Copy the patch into:

```text
~/WaytrXGroundOps/external/ffz-platform
```

Then:

```bash
npm run db:push
npm run test
npm run dev
```

Open:

```text
/journal
```

---

# Test 1 — new trade with screenshots

Create a new trade.

Before clicking SAVE TRADE:
1. click `ADD IMAGES`
2. select 2 or 3 screenshots
3. verify thumbnails appear
4. click a thumbnail
5. verify fullscreen lightbox works
6. close it
7. SAVE TRADE

Expected:
- trade is saved
- screenshots are uploaded
- form resets

---

# Test 2 — View trade

In Trade History click:

```text
View
```

Expected:
- Trade Details overlay opens
- screenshots appear as thumbnails
- click a thumbnail
- fullscreen screenshot opens
- Left/Right arrows switch images
- ESC closes lightbox

---

# Test 3 — Edit trade

Click:

```text
Edit
```

Expected:
- existing screenshots load in the form
- you can add more
- you can delete one
- clicking any thumbnail opens it fullscreen

---

# Test 4 — delete trade

Delete a trade with screenshots.

Expected:
- trade disappears
- attachment DB rows cascade-delete
- physical screenshot files are also removed

---

# Local file check

After uploading screenshots you should see:

```text
data/
└── uploads/
    └── <user-id>/
        └── <trade-id>/
            ├── <uuid>.png
            └── <uuid>.jpg
```

---

# Files changed

Existing:

```text
src/db/schema.ts
src/lib/journal/types.ts
src/lib/journal/api-client.ts
src/app/api/journal/trades/[id]/route.ts
src/components/journal/TradeJournal.tsx
src/components/journal/TradeJournal.module.css
```

New:

```text
src/lib/journal/attachments-validation.ts
src/lib/journal/attachments-repository.ts
src/lib/storage/image-storage.ts

src/app/api/journal/trades/[id]/attachments/route.ts
src/app/api/journal/trades/[id]/attachments/[attachmentId]/route.ts
src/app/api/journal/trades/[id]/attachments/[attachmentId]/file/route.ts

src/tests/journal-attachments.test.ts
```

---

# Production note

For the current development version, local filesystem storage is deliberate.

When we deploy to Hetzner we must make:

```text
data/uploads
```

a persistent Docker volume.

Later we can swap the storage implementation for S3-compatible object storage
without changing the Journal UI.

---

# Git checkpoint

When everything passes:

```bash
git add .
git commit -m "Add Journal screenshot attachments"
git push
```
