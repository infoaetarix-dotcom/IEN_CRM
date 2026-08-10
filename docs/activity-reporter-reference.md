# Client Activity Reporter — design reference (superseded)

> **Not a build guide anymore.** This documents a standalone Google
> Sheets/Apps Script prototype (`admin.html` + `dashboard.html` + `Code.gs`,
> deleted from this repo) that was never deployed. It's kept only as a
> reference for the data model, form fields, and report UX — the actual
> feature will be built as an admin-only IEN_CRM module (same pattern as
> Finance: Postgres table, Supabase auth/role guard, per-org module toggle
> in Super Admin), not as this separate Apps Script app. Ignore the
> deployment/setup instructions below; see `docs/HANDOFF.md` for the real
> module once it ships.

---

A weekly progress reporting system for digital marketing clients. Zero running cost.

**What the client gets:** a private link showing every activity you did, week by week, with a full historical trail, charts, and a one-click Excel/PDF download.

**What you get:** a form. You log a post in ~20 seconds. The report updates itself.

---

## Architecture

```
  You  ──►  admin.html  ──POST──►  Apps Script  ──►  Google Sheet   (the database)
                                        │
  Client ──►  dashboard.html  ──GET─────┘           →  Excel / PDF export
```

- **Database:** a Google Sheet. Free, you can open and edit it directly, easy to back up.
- **Backend:** Google Apps Script. Free, no server, no hosting bill, no keys to rotate.
- **Frontend:** two static HTML files. Host anywhere free — GitHub Pages, Cloudflare Pages, Netlify — on your own domain.

---

## Step 1 — Create the sheet + backend (5 min)

1. Go to <https://sheets.google.com> and create a new blank spreadsheet. Name it something like `Client Activity — Acme`.
2. In that sheet: **Extensions → Apps Script**.
3. Delete whatever code is there. Paste in the entire contents of **`Code.gs`**.
4. At the top of the file, change:
   ```js
   var WRITE_TOKEN = 'CHANGE-ME-to-a-long-random-string-123456';
   ```
   to a long random string. This is the key your team types into the admin panel. Keep it somewhere safe.
5. Save (💾), then in the function dropdown pick **`setup`** and click **Run**. Approve the permission prompt (it's your own script accessing your own sheet). This creates the `Activity` tab with proper headers.
6. **Deploy → New deployment → ⚙ → Web app**
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**  ← required, otherwise the browser cannot read it
   - Click **Deploy**, approve, and **copy the Web app URL**. It ends in `/exec`.

> "Anyone" means anyone *with the URL*. Reads are open to that unguessable URL; writes still require your token. Don't put confidential data in the notes field, and if the URL ever leaks, redeploy to get a new one.

---

## Step 2 — Wire up the two HTML files (2 min)

**`admin.html`** — top of the file:
```js
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfy…/exec',
  CLIENTS: ['Acme Corporation', 'Second Client'],
  TEAM:    ['Ayesha','Bilal','Hamza','Zara']
};
```

**`dashboard.html`** — top of the file:
```js
const CONFIG = {
  API_URL:     'https://script.google.com/macros/s/AKfy…/exec',
  CLIENT_KEY:  'Acme Corporation',   // must match the client name in admin, or leave '' for all
  CLIENT_NAME: 'Acme Corporation',
  AGENCY_NAME: 'Aetarix',
  LOGO_URL:    'https://yourdomain.com/logo.png',
  ACCENT:      '#4f46e5'
};
```

Open `dashboard.html` in a browser right now — with `API_URL` empty it runs in **demo mode** with sample data so you can see exactly what the client will see.

---

## Step 3 — Put it on your domain (10 min)

**Cloudflare Pages** (easiest, free, instant HTTPS):

1. Put `admin.html` and `dashboard.html` in a folder, push to a private GitHub repo.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo → Deploy (no build command, output dir `/`).
3. **Custom domains → Set up a domain** → `reports.yourdomain.com`.

Result:
- Client link: `https://reports.yourdomain.com/dashboard.html`
- Your team: `https://reports.yourdomain.com/admin.html`

Nicer URLs: rename `dashboard.html` → `index.html` so the client link is just `https://reports.yourdomain.com`.

**Multiple clients:** duplicate `dashboard.html` per client into subfolders (`/acme/index.html`, `/beta/index.html`), each with its own `CLIENT_KEY`, `CLIENT_NAME`, `LOGO_URL`, and accent colour. All of them read from the same sheet and the same admin panel.

### Locking down the admin page

The access key protects *writes*. To also stop strangers from loading the admin page at all, add Cloudflare Access (free up to 50 users): Zero Trust → Access → Applications → add `reports.yourdomain.com/admin.html`, policy = allow your team's emails. Takes 3 minutes and gives you real email-based login.

---

## Daily use

**Logging (you):** open the admin page, fill in date / platform / type / title / one line of description, hit **Save & add another**. The date, platform and owner stay filled in, so logging a batch of five posts takes about a minute.

**Metrics:** leave them blank when you post. Once a week open the entry, hit **Edit**, and paste in reach / likes / clicks from the platform insights. The dashboard recalculates instantly.

**Weekly report to the client:** just send the link — it's already current. If they want a file, hit **Excel** (two sheets: weekly summary + full log with filters) or **PDF** (print-styled, agency-branded).

---

## What the client sees

- **This week** — KPI cards with week-over-week deltas, then a day-by-day timeline: Thursday → reel about X, Friday → IG post, Saturday → X thread. Exactly the trail they asked for.
- **Full trail** — every week since you started, with output-per-week and engagement-trend charts, plus a searchable table of every single item.
- No jargon, no logins, no app to install. One URL.

---

## Notes on why this shape

- The client asked for Excel, but what they actually want is *confidence that work is happening*. A link that's always current answers that better than a file that's already stale when it lands. The Excel button is still there for their records — you're giving them both, not choosing.
- Numbering weeks (`Week 1, Week 2…`) rather than dates makes the trail feel like accumulating progress. That's deliberate.
- Statuses (`Planned` / `In Review` / `Published`) let you show upcoming work too, which turns a report into a plan and heads off "what are you doing next week?"
- Never log anything in **Internal notes** that you wouldn't want the client to read. It isn't rendered on the dashboard, but it does sit in the sheet and in the API response.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard shows demo banner | `API_URL` is empty or the fetch failed. Open the `/exec` URL directly — it should return JSON. |
| "That key was not accepted" | `WRITE_TOKEN` in `Code.gs` doesn't match what you typed. Re-deploy after editing. |
| Edits to `Code.gs` do nothing | Apps Script serves the last *deployment*. Use **Deploy → Manage deployments → ✏️ → Version: New version**. |
| CORS error in console | Access must be **Anyone**, not "Anyone with a Google account". |
| Dates shift by a day | Set the script timezone: Apps Script → ⚙ Project Settings → Time zone. |
