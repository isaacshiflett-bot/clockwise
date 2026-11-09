# Clockwise

A mobile-first shipping operations demo built with Next.js App Router, TypeScript, Tailwind CSS, and Vitest. Workers clock in and out, take breaks, submit manual entries, and see their own weekly shipping-area assignments. Managers review timecards, plan the floor, cover callouts, and show leaders a staffing snapshot.

If a worker forgets to clock out, **Forgot to clock out? Correct the time** on the time clock lets them enter the actual end time and a required explanation. An unfinished break also needs its actual end time. The corrected shift becomes a manual pending entry for manager approval; the original clock-in stays intact. This works even when the open shift is older than 24 hours, while the corrected shift itself must still be no longer than 24 hours.

## Run locally

Install Node.js 20.9 or newer, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run lint`, `npm test`, and `npm run build` before deploying.

## Demo logins

| Name | Role | PIN |
| --- | --- | --- |
| Manager | Manager | 1234 |
| Alex Rivera | Worker | 1111 |
| Jordan Lee | Worker | 2222 |
| Sam Patel | Worker | 3333 |

The demo users are created on first load, along with sample shifts, output categories, and two shipping assignments per weekday for the current week. One worker is left available each day so an emergency coverage change can be demonstrated. The sample includes approved, pending, and rejected time entries; clock in as a worker to try a live shift. Existing time data is preserved when upgrading. PINs are SHA-256 hashed with the Web Crypto API before they are saved. **Client-side authentication is demo-only, not real security.** Anyone with browser access can inspect or change local data.

## Shipping schedule and leadership demo

Sign in as **Manager** and open **Schedule**. The weekly board shows workers assigned to Receiving, Picking, Packing, Loading, Dispatch, or Returns. Choose one or more days, a worker, an area, and shift times to add assignments. Each worker can have one active assignment per day. The **Load demo week** button fills the selected week with sample assignments without replacing existing work. Use **Cover a callout** to select a planned shift and a reason, with an optional available replacement. The original becomes a visible callout; if no one is available yet, it remains uncovered and can be filled later. A replacement takes the same area and time. This is a local demo change; it does not send notifications.

Open **Leadership** to see this week’s staffed shifts, callouts, covered shifts, approved and pending hours, staffing by area and day, and the most recent schedule changes. A new assignment or callout updates this view immediately in the same browser. Sign in as a worker to see **My schedule this week** beside the time clock and hours. Scheduled shifts and actual clocked time are shown separately so leaders can tell a plan from a worked shift.

For a short demo: load a week, add an assignment, open Leadership to show the new count, return to Schedule, cover a callout, then reopen Leadership to show the callout and replacement in the change feed. If you need to show another week, use the week arrows and **Load demo week** there.

## Timecards and optional output

The manager **Timecards** page includes **Departments** for assigning workers. New shifts record the worker's department at the time of the shift, so later reassignment does not rewrite historical results. Existing records without a department are migrated to the seeded demo department or **Unassigned**. Managers can add output categories and units on the same page. Workers may log counts when clocking out or editing an entry, and their own **My stats** card shows rates after at least three qualifying shifts.

## Vercel deployment

The [GitHub repository](https://github.com/isaacshiflett-bot/clockwise) is connected to the existing Vercel project. Pushing to `main` automatically builds and updates the [live demo](https://clockwise-demo-eight.vercel.app). Vercel detects Next.js automatically; no environment variables, custom build command, or database are needed.

## Local backups and pay periods

The manager Overview shows **Backup due** when local data has changed since the last full JSON export. It displays the last export time and lets you download a new backup. Signing in and out does not mark data as changed. Keep the downloaded file outside the browser; importing a backup prompts for confirmation and marks the restored data as needing a fresh export.

If stored data cannot be read or upgraded, Clockwise preserves the original browser record and shows a recovery screen. Free browser storage space and retry, or restore a downloaded JSON backup there. A failed upgrade never clears the original record automatically.

In Overview → **Pay period**, choose the first day of a period and a length of 1–4 weeks. Worker pay-period totals follow this setting. The default is a two-week period anchored to Monday, January 1, 2024. Weekly totals still begin Monday.

Managers can open **Closeout** to review completed pay periods. The page lists unresolved shifts, approved daily hours, and Monday-based weekly hours. Once every shift in a period is approved, a manager can sign off and lock it, then download a payroll CSV. Reopen a period to make corrections and sign off again. The weekly figure includes approved shifts elsewhere in the same workweek when a configured pay period begins midweek.

The period selector includes older periods with entries and every saved closeout, even when pay-period settings have changed.

**Shift change history** on that page records creation, edits, approval, rejection, and deletion with the actor and before/after values. Existing changes from before this feature cannot be reconstructed. The full history and closeout records are included in JSON backups. These controls live in browser storage and are intended for local review, not tamper-proof payroll records.

## Data and limitations

All data stays in the current browser and device under the `timeclock:v1` localStorage key. It is not shared across devices or users, even when the same Vercel URL is opened. Emergency changes and the leadership view therefore update in this browser only; a real company would need shared storage and notifications to push changes to other people. Use **Timecards → Backup** to export/import a full JSON copy, including schedule assignments. Timecard timestamps are stored as ISO 8601 UTC and shown in the browser's local time zone. Schedule dates and shift times are local wall-clock values for planning. Shifts crossing midnight count toward their start day.

All data access goes through the async `StorageAdapter` interface in `lib/storage/types.ts`. To add a hosted database later, implement that interface and change the active adapter export in `lib/storage/index.ts`; UI code does not read localStorage directly. A real deployment with multiple people also needs server-side authentication and authorization.
