# Testing Guide — what everything does & how to test it

A complete walkthrough of every feature, what it's for, and how to verify it. Use this as your QA checklist. Tick boxes as you go.

> Local: `http://localhost:3000` · Live: `https://ien-crm.vercel.app`
> Dev note: the **first** visit to any page is slow (Next compiles it on demand). Second visit is instant. Production is always fast.

---

## 1. Public lead form — `/apply`

**What it's for:** the only public page. Each social bio links here with a UTM tag so every submission is attributed to its source. This is the top of the funnel.

| Test | Expected |
|---|---|
| ⬜ Open `/apply` | Loads fast, looks professional (navy header, cream form) |
| ⬜ **Full name** empty → submit | Blocks; "Please enter your full name" |
| ⬜ **Email** type "john" (no @), click away | Inline red error |
| ⬜ **Email** "john@x.com" | No error |
| ⬜ **Phone** pick country (flag dropdown), type too few digits | "Enter a valid phone number" |
| ⬜ **Phone** correct length | No error; stores full international number |
| ⬜ **DOB** click field | Calendar opens; use Month/Year dropdowns to jump decades |
| ⬜ **DOB** pick a date | Shows e.g. "1 May 2000"; under-14 or future dates rejected on submit |
| ⬜ **Target country** click | Searchable list with flags; type to filter |
| ⬜ **Highest education** pick "Other" | Text box appears to type a custom level |
| ⬜ **Program** | Degree dropdown (MSc/BSc…) + field-of-study text |
| ⬜ **Prior rejection** tick the box | A "what happened?" text area appears |
| ⬜ **Consent** unticked → submit | Blocked; consent is required |
| ⬜ Turnstile checkbox | Appears and passes (needs `localhost` in Turnstile hostnames) |
| ⬜ Submit a valid form | Redirects to **/thank-you**; confirmation email sent |
| ⬜ UTM tracking: open `/apply?utm_source=instagram&utm_medium=bio`, submit | Lead shows **source = Instagram** in dashboard |

**Behind the scenes on submit:** rate-limit check → Turnstile verify → honeypot → validation → saved to database → welcome email sent & logged → audit entry → thank-you page.

---

## 2. Staff sign-in — `/login`

**What it's for:** gate to the admin area. Only staff with accounts get in.

| Test | Expected |
|---|---|
| ⬜ Wrong password | "Invalid credentials" (never reveals if the email exists) |
| ⬜ Correct admin login | Lands on dashboard |
| ⬜ Visit `/dashboard` while logged out | Redirected to `/login` |
| ⬜ Sign out (top-right) | Back to login; can't reach dashboard via back button |

Your admin: `abdrkdw21@gmail.com` (password you set in Supabase).

---

## 3. Dashboard overview — `/dashboard`

**What it's for:** the at-a-glance health of the pipeline.

| Element | What it shows | Test |
|---|---|---|
| Leads this month | Count created since the 1st | ⬜ Matches your data |
| New today (unworked) | New leads created today still in "new" | ⬜ |
| Response rate <1h | % of recent leads first contacted within an hour | ⬜ Shows a % or "—" |
| Active sources | How many channels have leads | ⬜ |
| Leads by source (bar) | Instagram/Facebook/etc counts | ⬜ Matches the 17 test leads |
| Pipeline status (bar) | Counts per stage | ⬜ |
| Lead volume (line) | Last 14 days | ⬜ |
| Recent leads | Last 6, click to open | ⬜ Clicking opens the lead |

---

## 4. Leads table — `/leads`

**What it's for:** find and triage every lead. Server-side search/filter/sort/paginate.

| Test | Expected |
|---|---|
| ⬜ Search "Bilal" | Filters to matching name/email/phone (there are two Bilals) |
| ⬜ Filter by Status = Contacted | Only contacted leads |
| ⬜ Filter by Source = Instagram | Only Instagram leads |
| ⬜ (Admin) Filter by Agent | Only that agent's leads |
| ⬜ Pagination Prev/Next | Pages through (20 per page) |
| ⬜ Click a row | Opens lead detail |

---

## 5. Lead detail — `/leads/[id]`

**What it's for:** the full record + every action an agent takes on a lead.

| Section | What it does | Test |
|---|---|---|
| Applicant details | All form fields + age (from DOB) + source | ⬜ Open "Fatima Noor" — shows her prior-rejection note |
| **Status** changer | Move through pipeline; logs history + audit | ⬜ Change to "Contacted" → appears in Status history |
| **Notes** | Append-only staff notes (can't edit/delete) | ⬜ Add a note → shows with your name + time |
| **Assign agent** (admin) | Give the lead to an agent | ⬜ Assign → agent sees it, others don't |
| **Send email** | Pick template → preview → send → logged | ⬜ Send "Acceptance" → arrives + shows in Message history |
| Message history | Every email with sent/failed status | ⬜ |
| Status history | Full timeline of status changes | ⬜ |

---

## 6. Agents — `/agents` (admin only)

**What it's for:** manage staff accounts.

| Test | Expected |
|---|---|
| ⬜ "Add staff member" | Create agent with name/email/temp password/role |
| ⬜ New agent can sign in | With the temp password |
| ⬜ Change a role (agent ↔ admin) | Updates immediately |
| ⬜ Deactivate someone | They can no longer sign in |
| ⬜ Try to deactivate yourself | Blocked (can't lock yourself out) |

---

## 7. Email templates — `/templates` (admin only)

**What it's for:** edit the messages staff send, without touching code.

| Test | Expected |
|---|---|
| ⬜ Edit a template subject/body → Save | "Saved"; used next time you send |
| ⬜ Variables like `{{full_name}}` | Filled in automatically when sent |
| ⬜ "welcome" template | Marked auto-send (fires on every new application) |

---

## 8. Roles & security (the important part)

| Test | Expected |
|---|---|
| ⬜ Sign in as an **Agent** | No "Agents" or "Templates" in the menu |
| ⬜ Agent opens a lead assigned to someone else (by URL) | 404 / not visible — enforced in the database |
| ⬜ Agent's dashboard | Only counts their own leads |

These are also covered by automated security tests (see PROJECT_GUIDE / AUTONOMY_LOG).

---

## Known / pending (not bugs)
- Turnstile on localhost needs `localhost` added to the widget hostnames.
- Consent links to a placeholder privacy page — real URL pending (S1 in TWEAKS.md).
- Test data: 17 `@example.com` leads — deletable anytime.
