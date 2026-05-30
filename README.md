# DockPass

DockPass is a lightweight location-based check-in dashboard built as a single Next.js App Router application. Admins create check-in rounds, assign users by email, and users sign in with Google to view assigned rounds and check in from their browser with current geolocation.

## Thai Summary

DockPass คือระบบเช็กอินรอบงาน/ทริปแบบเบา แอดมินสร้างรอบและมอบหมายผู้ใช้ด้วยอีเมล ผู้ใช้เข้าสู่ระบบด้วย Google แล้วระบบจะจับคู่จากอีเมลใน session เพื่อแสดงเฉพาะรอบที่ได้รับมอบหมาย ผู้ใช้ไม่ต้องกรอกอีเมลหรือรหัสรอบเองอีกต่อไป

ระบบบันทึกอีเมล เวลาเช็กอินจากเซิร์ฟเวอร์ และตำแหน่งปัจจุบันเฉพาะตอนกดเช็กอินเท่านั้น ไม่มีการติดตามตำแหน่งแบบต่อเนื่องหรือเบื้องหลัง

## Features

- Thai-first landing page, admin dashboard, create form, and user portal.
- Supabase Auth email/password login for admins.
- Supabase Google OAuth login for normal users.
- Admin allowlist through `ADMIN_EMAILS`.
- Admin creates rounds with title, description, optional remark, time rules, and assigned emails.
- User portal at `/check-in` with 3 tabs: ปฏิทิน, เช็กอิน, ประวัติ.
- Admin dashboard has active round, ถังขยะ, and ส่งออกข้อมูล tabs.
- Phase 1 Google Calendar integration through template links only.
- Optional Resend email notifications after admin creates a round.
- User check-in is based on authenticated user email matching `ship_assignees.email`.
- No manual email/code entry in the user flow.
- Duplicate check-in prevention per round and email.
- Server-side status calculation using server timestamp.
- Basic attempt rate limiting using hashed IP/email metadata.
- RLS enabled with no direct anonymous table access.
- Responsive mobile, tablet, and desktop UI.
- Email sending is optional and only runs when `ENABLE_EMAIL_NOTIFICATIONS=true`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are configured.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Supabase Auth
- Supabase Postgres
- Vitest
- Vercel-ready deployment

## Architecture

DockPass is one Next.js app, not a monorepo.

- `/` Thai portfolio landing page
- `/admin/login` admin email/password login
- `/admin/dashboard` protected admin dashboard
- `/admin/ships/new` protected round creation form
- `/check-in` authenticated user check-in portal
- `/auth/callback` Supabase OAuth callback
- `/api/ships` admin list/create API
- `/api/ships/[id]` admin detail API
- `/api/admin/trash` admin trash list API
- `/api/admin/trash/clean` admin-only permanent cleanup API
- `/api/admin/export/checkins` admin-only check-in export preview API
- `/api/user/ships` authenticated user assigned-round API
- `/api/user/check-in` authenticated user check-in API
- `/api/check-in` and `/api/check-in/verify` return `410 Gone` because the old public code flow is deprecated

Browser code only uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server API routes use `SUPABASE_SERVICE_ROLE_KEY`.

## Google Calendar Links

DockPass uses Google Calendar template links only. It does not use the Google Calendar API, request extra Google OAuth scopes, or store Google Calendar tokens.

- Event title: `DockPass: {title}`
- Event dates use Google Calendar UTC format: `YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ`
- Event details include round title, description, optional remark, check-in URL, and a reminder to sign in with the assigned email
- User portal buttons open a confirmation modal before opening Google Calendar
- After opening Google Calendar, DockPass shows an acknowledgement modal and a fallback “เปิด Google Calendar อีกครั้ง” button
- Users must still click Save in Google Calendar; DockPass cannot know whether the event was actually saved

## Email Notifications

When `ENABLE_EMAIL_NOTIFICATIONS=true`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are configured, DockPass sends one notification email to each assigned email after an admin creates a round.

- Email includes “เปิดหน้าเช็กอิน”
- Email includes “เพิ่มลง Google Calendar”
- Email sending failures do not fail the round creation flow
- If email notifications are disabled, `RESEND_API_KEY` is missing, or `RESEND_FROM_EMAIL` is missing, DockPass skips sending and still returns a copyable notification preview
- Resend requests use a per-email timeout so round creation does not wait indefinitely on email delivery
- Admins see a UI-safe summary with sent/failed counts plus expandable sent/failed email lists
- Raw Resend provider errors are logged on the server only and are not returned to the browser

## Database Schema

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. It creates:

- `ships`
- `ship_assignees`
- `checkin_logs`
- `checkin_attempts`

`ships` includes `title`, `description`, `remark`, time windows, and an internal `code_hash` for compatibility. The current user flow does not expose or require the code.

Schema constraints include:

- `title` length 1..50
- `description` length 1..500
- `remark` null or length <= 250
- `end_at > start_at`
- duration <= 24 hours
- time rules non-negative and <= 1440 minutes
- normalized emails
- valid check-in statuses
- valid latitude, longitude, and accuracy ranges

RLS is enabled and direct table access is denied by default. App reads/writes go through server API routes with the service role key.

## Check-in Status Rules

Internal enum values:

- `ON_TIME`
- `LATE`
- `NOT_CHECKED_IN`
- `OUT_OF_SHIP`
- `TOO_EARLY`

Thai labels:

- `ON_TIME` = ตรงเวลา
- `LATE` = สาย
- `NOT_CHECKED_IN` = ยังไม่เช็กอิน
- `OUT_OF_SHIP` = นอกรอบ
- `TOO_EARLY` = เร็วเกินไป

Rules use the server timestamp:

- `start_at - early_checkin_minutes <= serverTime <= start_at + on_time_until_minutes` = `ON_TIME`
- `start_at + on_time_until_minutes < serverTime <= end_at - close_before_end_minutes` = `LATE`
- `end_at - close_before_end_minutes < serverTime <= end_at + 1 hour` = `OUT_OF_SHIP`
- `serverTime < start_at - early_checkin_minutes` = `TOO_EARLY` internally, but `/api/user/check-in` rejects it and does not save a log.
- `NOT_CHECKED_IN` is derived when no log exists and is not inserted into `checkin_logs`.

`OUT_OF_SHIP` means the user checked in after the expected check-in window, but before the round moved to History. DockPass saves this event as audit evidence instead of rejecting it.

## User Portal Behavior

- ปฏิทิน: shows today's assigned rounds for the logged-in user.
- เช็กอิน: shows assigned rounds that are not checked in and not in history. Future rounds are visible but disabled with “ยังไม่ถึงเวลาเช็กอิน”. Rounds in the OUT_OF_SHIP window remain selectable and show “เช็กอินได้ แต่จะถูกบันทึกเป็นนอกรอบ”.
- ประวัติ: shows assigned rounds after `end_at + 1 hour`.

History is query-filtered:

- visible when `end_at + 1 hour < now <= end_at + 73 hours`
- trash-eligible when `now > end_at + 73 hours`
- trash-eligible rounds are not returned to users

User check-in is accepted only when:

- `start_at - early_checkin_minutes <= serverTime <= end_at + 1 hour`

After `end_at + 1 hour`, `/api/user/check-in` rejects with “รอบเช็กอินนี้หมดเวลาการเช็กอินแล้ว”.

## Admin Trash Behavior

Admin dashboard includes these admin work areas:

- รายการรอบเช็กอิน: active/non-trash rounds only.
- ถังขยะ: rounds where `now > end_at + 73 hours`.
- ส่งออกข้อมูล: preview and export check-in data as CSV.

Trash behavior:

- No automatic deletion runs in the MVP.
- Trash-eligible rounds are hidden from user calendar, check-in, and history.
- Admin can click “ล้างข้อมูลทั้งหมด”.
- A confirmation modal explains that deletion is permanent.
- `/api/admin/trash/clean` hard deletes trash-eligible `ships` only.
- `ship_assignees` and `checkin_logs` are deleted through `ON DELETE CASCADE`.

## Admin Export Behavior

The ส่งออกข้อมูล tab lets admins export check-in records as CSV.

- Default date range is the latest 7 days.
- Quick filters are available for 7, 14, and 30 latest days.
- Date inputs use the same editable `DD/MM/YYYY` UI as the dashboard filters.
- Admin must click “ใช้ตัวกรอง” before the preview changes.
- The maximum export range is 30 days.
- Preview records are selected by default after data loads.
- Admin can select/deselect individual rows or toggle “เลือกทั้งหมด”.
- Download is disabled when no records are selected.
- Clicking “ดาวน์โหลด CSV” opens a confirmation modal first.
- After confirmation, DockPass downloads only the selected preview records.
- The CSV includes UTF-8 BOM so Thai text opens correctly in Excel.
- Downloaded filenames follow `dockpass-checkin-export-YYYY-MM-DD-to-YYYY-MM-DD.csv`.

Exported columns:

- `round_id`
- `title`
- `description`
- `start_at`
- `end_at`
- `assignee_email`
- `status`
- `status_label_th`
- `checked_in_at`
- `latitude`
- `longitude`
- `map_link`

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- User check-in writes only through `/api/user/check-in`.
- Public code-based check-in routes are deprecated and return `410`.
- Admin trash cleanup requires `requireAdmin()` and uses service role only on the server.
- Authenticated user email from Supabase session is the source of user identity.
- API routes re-check assignment before returning ships or writing logs.
- Duplicate check-ins are blocked by API checks and `unique(ship_id, email)`.
- Status calculation uses server timestamp only.
- Rate-limit attempts store hashed IP/email identifiers, not raw IP/email.
- `RATE_LIMIT_HASH_SECRET` is recommended. If omitted, the app falls back to `SHIP_CODE_SECRET`.
- `.env`, `.env.local`, and other env files are ignored by git.

## Privacy Notes

DockPass records email, server check-in time, and current browser geolocation only when the user taps the check-in button. It does not continuously track location and does not run background location collection.

`checkin_attempts` stores hashed metadata for abuse prevention and should be cleaned up periodically.

## Limitations

Browser geolocation may be inaccurate or spoofed. DockPass is intended for lightweight operational tracking, not strict anti-fraud verification.

Email sending is optional. Without `ENABLE_EMAIL_NOTIFICATIONS=true`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`, admins can still copy the notification preview after creating a round.

Dates and times are displayed in the `Asia/Bangkok` timezone. `datetime-local` input is interpreted by the admin browser timezone.

Run `supabase/schema.sql` on a fresh Supabase project when possible. If you already have data, review constraints before applying.

`npm install` may report moderate audit findings from the dependency tree. Do not run `npm audit fix --force` automatically without reviewing breaking dependency changes first.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
SHIP_CODE_SECRET=
RATE_LIMIT_HASH_SECRET=
ADMIN_EMAILS=
ENABLE_EMAIL_NOTIFICATIONS=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

`ADMIN_EMAILS` is comma-separated:

```bash
ADMIN_EMAILS=admin@example.com,ops@example.com
```

Use long random values for `SHIP_CODE_SECRET` and `RATE_LIMIT_HASH_SECRET`.

Set `APP_URL` to the public app URL used in email and calendar links:

```bash
APP_URL=https://dockpass-ochre.vercel.app
```

For local development:

```bash
APP_URL=http://localhost:3000
```

`ENABLE_EMAIL_NOTIFICATIONS`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are optional. Email sending is skipped unless `ENABLE_EMAIL_NOTIFICATIONS=true`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are all set.

Recommended rollout:

```bash
ENABLE_EMAIL_NOTIFICATIONS=false
```

Turn it on only when you are ready to send real email:

```bash
ENABLE_EMAIL_NOTIFICATIONS=true
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run [`supabase/schema.sql`](./supabase/schema.sql).
4. Go to Authentication > Providers.
5. Enable Email provider for admins.
6. Enable Google provider for normal users.
7. In Google Cloud Console, create OAuth client credentials and add Supabase callback URL from the Google provider panel.
8. Paste Google Client ID and Client Secret into Supabase.
9. Create admin users with email/password.
10. Add admin emails to `ADMIN_EMAILS`.
11. Copy project URL, anon key, and service role key into `.env.local`.
12. Set Auth site URL and redirect URLs:
    - `http://localhost:3000`
    - `http://localhost:3001`
    - `https://your-project.vercel.app`
    - `http://localhost:3000/auth/callback`
    - `http://localhost:3001/auth/callback`
    - `https://your-project.vercel.app/auth/callback`

Optional cleanup for rate-limit attempts:

```sql
delete from public.checkin_attempts
where created_at < now() - interval '30 days';
```

Round cleanup is handled manually from the Admin ถังขยะ tab. There is no automatic scheduled deletion in the MVP.

## Local Development

```bash
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/admin/login`
- `http://localhost:3000/check-in`

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

## Manual QA Checklist

- Admin can log in with an allowed email.
- Non-allowlisted users are denied admin access.
- Admin can create a round after confirmation modal.
- Created round response shows notification email status and copyable notification preview.
- Created round response shows sent/failed notification email lists without raw provider errors.
- Admin can filter dashboard by assigned email.
- Admin active list excludes trash-eligible rounds.
- Admin Trash tab shows rounds after `end_at + 73 hours`.
- Admin clean button shows confirmation and returns deleted count.
- Admin export tab defaults to latest 7 days and requires “ใช้ตัวกรอง” before changing the preview.
- Admin export validates a maximum 30-day date range.
- Admin export downloads only selected preview records after confirmation modal.
- User can sign in with Google from `/check-in`.
- User sees only assigned rounds.
- User can open Google Calendar confirmation modal from active/upcoming assigned rounds.
- Google Calendar does not open until user confirms.
- Google Calendar acknowledgement modal does not claim the event was saved.
- Manual calendar timezone check: create a Thai-time round, open Google Calendar, and confirm the event time matches the displayed DockPass time.
- User with no assigned rounds sees a Thai empty state.
- Calendar tab shows today's assigned rounds.
- Check-in tab disables rounds before `start_at - early_checkin_minutes`.
- User check-in shows confirmation modal before geolocation.
- Successful check-in stores one log with server timestamp.
- Duplicate check-in returns a Thai duplicate message.
- History tab shows rounds after `end_at + 1 hour` and hides them after the 72 hour window.
- Trash-eligible rounds are not returned to the user portal.
- Mobile views at 360px and 390px have no horizontal scrolling.

## Vercel Deployment

1. Import the GitHub repository into Vercel.
2. Set the same environment variables in Vercel Project Settings.
3. Deploy with the default Next.js build command:

```bash
npm run build
```

4. Add the production URL and `/auth/callback` URL to Supabase Auth redirect settings.
5. Configure Google OAuth authorized redirect URLs in Google Cloud/Supabase.
6. If using email notifications, set `ENABLE_EMAIL_NOTIFICATIONS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_URL`.

## Roadmap

- Edit/archive/delete flow for rounds.
- Scheduled cleanup for old rate-limit attempts.
- CSV import for assignees.
- Optional geofence checks.
- Regenerate internal round code if future code-based workflows return.
- Admin audit log.
- E2E tests against a real Supabase test project.
