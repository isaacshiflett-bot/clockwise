# Clockwise

A mobile-first work-time tracker built with Next.js App Router, TypeScript, Tailwind CSS, Recharts, and Vitest. Workers clock in and out, take breaks, submit manual entries, and see their own history. Managers review entries, manage workers and output categories, set coverage targets, and explore scheduling insights.

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

The demo users are created on first load, along with sample shifts, output categories, and coverage targets so each view has data to explore. The sample includes approved, pending, and rejected entries; clock in as a worker to try a live shift. An existing browser with entries is left unchanged; an untouched earlier demo setup is populated once. PINs are SHA-256 hashed with the Web Crypto API before they are saved. **Client-side authentication is demo-only, not real security.** Anyone with browser access can inspect or change local data.

## Insights

Managers can open **Insights** to see coverage by weekday and hour, coverage against targets, weekly hours, shift averages, overtime watch, and optional output rates. The default view uses approved shifts from the last four weeks. The **Include pending entries** checkbox adds pending shifts. Each chart has a table view and CSV export.

Set a target headcount for one weekday and hour in **Coverage targets**. Saving a target of zero clears it. Add task categories and units in **Overview → Output categories**. Workers can record optional counts on clock out or when editing an entry; rates appear after at least three shifts have output for that category. Morning is 06:00–12:00, Afternoon 12:00–18:00, Evening 18:00–24:00, and other starts are Overnight. The **Load sample data · demo only** button creates four weeks of approved shifts with output counts for active workers; it replaces prior generated sample shifts. If no active task categories exist, it adds two demo categories so the productivity charts have data.

## Vercel deployment

Push this repository to GitHub, then import the GitHub repository in Vercel. The Next.js framework is detected automatically. No environment variables, custom build command, database, or Vercel settings are needed.

## Data and limitations

All data stays in the current browser and device under the `timeclock:v1` localStorage key. It is not shared across devices or users, even when the same Vercel URL is opened. Use **Overview → Backup** to export/import a full JSON copy. Shifts are stored as ISO 8601 UTC timestamps and shown in the browser's local time zone. Shifts crossing midnight count toward their start day. Weeks begin Monday, and pay periods are consecutive two-week periods anchored to Monday, January 1, 2024.

All data access goes through the async `StorageAdapter` interface in `lib/storage/types.ts`. To add a hosted database later, implement that interface and change the active adapter export in `lib/storage/index.ts`; UI code does not read localStorage directly. A real deployment with multiple people also needs server-side authentication and authorization.
