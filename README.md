# Mind Theory Works

This project is being aligned with the coaching-continuity product in the provided PRD v3 and Designer/Developer rules.

The app must support an invited client experience and a separate coach workspace. Client access is limited to that client's coaching data. The `coach_notes` table is coach-only and must never be queried by client-facing code.

## Database and access setup

The existing Supabase project already contains the coaching tables. Do not run the old `setup-auth.sql`; it assumed unrelated tables and dropped every policy on two tables.

The read-only [`supabase/inspect-schema.sql`](./supabase/inspect-schema.sql) inspects public-schema columns, constraints, RLS policies, and grants without reading customer rows or changing the database.

[`20261031133000_coaching_access_rls.sql`](./supabase/migrations/20261031133000_coaching_access_rls.sql) was manually applied to the configured Supabase project after review; the user confirmed that RLS is enabled on all target tables and the coach-only `coach_notes` policies are present. It preserves existing tables and columns, adds the client-to-Auth link, removes broad table privileges (including `TRUNCATE`), and defines coach/client policies and narrowly scoped RPCs. Confirm migration state separately in any other Supabase environment.

For another environment, first run the read-only [`supabase/preflight-coaching-migration.sql`](./supabase/preflight-coaching-migration.sql) and inspect any existing policies and unique indexes. The migration replaces only its own named policies and aborts if another policy remains on a managed table; do not remove an existing policy without reviewing its intent. It creates unique indexes for phone numbers, invite hashes, one record per session and writer, one check-in per session, and one sequence number per engagement. If existing rows violate an index constraint, the transaction will fail and roll back; resolve duplicates without deleting data first. This repository does not connect to or verify remote database state.

Create the coach Auth user in the Supabase Dashboard, then replace `REPLACE_WITH_COACH_EMAIL` in [`supabase/bootstrap-coach.sql`](./supabase/bootstrap-coach.sql) and run it in the SQL Editor. Do not enable public email sign-up for the coach account.

Coach login, password recovery, and logout are separate coach-only flows. Password recovery starts at `/login/forgot-password`, redirects through `/auth/callback`, and finishes on `/reset-password`. In Supabase Dashboard, allow `http://localhost:3001/**` under Authentication → URL Configuration → Redirect URLs. Keep the Site URL set to the intended default for the project; do not replace a production Site URL just for local development. For a deployed app, allow its real HTTPS origin separately. The redirect origin is taken from the recovery page's current origin. Client phone login and its SMS troubleshooting page are separate under `/client/login`.

Clients use phone OTP through Supabase Auth. Supabase still requires an SMS provider configured in the project; that external setting must be completed and tested separately. The coach generates a single-use invite URL and copies it to send manually. Invite links expire after seven days. The client enters the phone number on the invite page, verifies the SMS code, and then the invite is claimed.

The app now has separate coach and client login paths, client home/records/library pages, and coach today/client/inbox pages. Client records and check-ins use the existing `session_records` and `checkins` columns; action progress is calculated from `actions.status` and is not stored as a percentage. Client-facing code does not query `coach_notes`.

Supabase session-duration settings must be configured for the PRD's 90-day session target. Database migrations, SMS provider setup, and session settings are never applied automatically by this repository. Until an SMS provider is configured, invite and OTP screens are implemented but real SMS delivery cannot be verified.
