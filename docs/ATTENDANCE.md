# Attendance — runbook

Opt-in module (`attendance`, migration `0052_attendance.sql`). Agents clock in
and out from the CRM's top bar; admins read everyone's records on
`/attendance`. Admins don't clock in.

## Turning it on for a consultancy

1. Super Admin → the consultancy → **Package — modules** → tick **Attendance**.
2. Leave **Office network — Attendance** empty for a day or two. Every
   clock-in is recorded as **Remote** meanwhile; everything else works.
3. Come back to the same card: **Recent clock-in IPs** lists the IPs used,
   the one most agents share first. That's the office line → **Mark as office**.
   From then on, clock-ins from it are **Office**. Earlier records keep the
   place they were recorded with.

Accepted input: an IPv4 address (`203.0.113.7`), an IPv4 range (`/16`–`/32`),
or an IPv6 address (stored as its `/64`, because every device on an IPv6
office network has its own address). Only a super admin can change it.

If the office's internet provider changes its IP, office clock-ins start
showing as Remote. Add the new IP (it will appear under Recent clock-in IPs).
A static IP from the provider avoids this.

## How office vs remote and auto clock-out work

- The server reads the request IP (`x-real-ip` / `x-forwarded-for`, set by
  Vercel) at clock-in, clock-out and every ping. The page never sends it.
- Times come from the server/database clock, not the laptop.
- While clocked in, `public/attendance-worker.js` pings
  `/api/attendance/ping` every 2 minutes (a worker, because browsers throttle
  background-tab timers far less there).
- No ping for 5 minutes → the session closes **at the last ping**, marked
  *Auto* (`attendance_close_stale()`). Runs on every attendance read/write
  and on the twice-daily cron.
- A session never runs past local midnight (org time zone from Settings →
  Reports): a new day always starts with Clock in.

| Situation | Clocks out? |
|---|---|
| CRM minimised, another tab or app in use, screen locked (awake) | No |
| Laptop asleep or shut down, CRM tab/browser closed | Yes, at the last ping |
| Internet down for 5+ minutes | Yes, at the last ping |
| Phone: screen locked or app in background | Yes (phones pause web apps) |

## One-time browser setting on office laptops (recommended)

Browsers can freeze a tab nobody has looked at for a long time, which stops
the pings. Add the CRM's address to the "never sleep" list:

- **Microsoft Edge:** Settings → System and performance → *Never put these
  sites to sleep* → Add → the CRM address.
- **Google Chrome:** Settings → Performance → *Always keep these sites
  active* → Add → the CRM address.

## Reports

`/attendance` (admins): **Today** shows who is clocked in, with Office/Remote
and Auto flags. **History** can be filtered by agent and dates (default: this
month). Saturdays and Sundays are off days, shown only if someone worked. A
weekday with no clock-in is **Absent**, counted only for active agents from
the day they joined. **Export** gives Excel/CSV: one row per session plus
Absent rows.
