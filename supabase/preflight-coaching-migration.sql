-- Read-only preflight for 20261031133000_coaching_access_rls.sql.
-- Returns aggregate duplicate counts only; it does not expose row contents or
-- modify the database. Resolve any duplicates without deleting data before
-- applying the migration.

-- Review this result first. If any row is returned, stop and compare the
-- actual schema with the migration before running the duplicate checks below.
with expected_columns(table_name, column_name) as (
  values
    ('profiles', 'id'), ('profiles', 'name'),
    ('engagements', 'id'), ('engagements', 'client_id'), ('engagements', 'title'),
    ('engagements', 'objective_text'), ('engagements', 'total_sessions'), ('engagements', 'status'),
    ('sessions', 'id'), ('sessions', 'engagement_id'), ('sessions', 'seq'),
    ('sessions', 'scheduled_at'), ('sessions', 'scheduled_end_at'), ('sessions', 'status'),
    ('sessions', 'record_opened_at'), ('sessions', 'open_reason'), ('sessions', 'ended_at'),
    ('session_records', 'id'), ('session_records', 'session_id'), ('session_records', 'written_by'),
    ('session_records', 'topic_text'), ('session_records', 'insight_text'),
    ('session_records', 'submitted_at'), ('session_records', 'edited_at'),
    ('actions', 'id'), ('actions', 'session_id'), ('actions', 'text'), ('actions', 'status'),
    ('actions', 'note'), ('actions', 'blocked_reason'), ('actions', 'closed_at'),
    ('checkins', 'id'), ('checkins', 'session_id'), ('checkins', 'learned_text'),
    ('checkins', 'topic_text'), ('checkins', 'submitted_at'),
    ('feedbacks', 'id'), ('feedbacks', 'target_type'), ('feedbacks', 'target_id'),
    ('feedbacks', 'text'), ('feedbacks', 'emoji'), ('feedbacks', 'client_seen_at'),
    ('cheers', 'id'), ('cheers', 'engagement_id'), ('cheers', 'text'),
    ('cheers', 'sent_at'), ('cheers', 'client_seen_at'),
    ('coach_notes', 'id'), ('coach_notes', 'session_id'), ('coach_notes', 'topic'),
    ('coach_notes', 'content'), ('coach_notes', 'outcome'), ('coach_notes', 'reflection'),
    ('coach_notes', 'next_focus'), ('coach_notes', 'quality_scores'),
    ('invites', 'client_id'), ('invites', 'token_hash'), ('invites', 'expires_at'), ('invites', 'used_at'),
    ('client_notes', 'client_id'),
    ('key_results', 'engagement_id'),
    ('kr_levels', 'session_id'),
    ('reports', 'engagement_id'), ('reports', 'published_at'),
    ('notification_log', 'user_id')
)
select expected_columns.table_name, expected_columns.column_name as missing_column
from expected_columns
left join information_schema.columns as actual
  on actual.table_schema = 'public'
  and actual.table_name = expected_columns.table_name
  and actual.column_name = expected_columns.column_name
where actual.column_name is null
order by expected_columns.table_name, expected_columns.column_name;

select check_name, duplicate_groups, duplicate_rows
from (
  select
    'invites(token_hash)' as check_name,
    count(*) as duplicate_groups,
    coalesce(sum(group_size), 0)::bigint as duplicate_rows
  from (
    select count(*) as group_size
    from public.invites
    group by token_hash
    having count(*) > 1
  ) as duplicate_invite_hashes

  union all

  select
    'session_records(session_id, written_by)',
    count(*),
    coalesce(sum(group_size), 0)::bigint
  from (
    select count(*) as group_size
    from public.session_records
    group by session_id, written_by
    having count(*) > 1
  ) as duplicate_session_records

  union all

  select
    'checkins(session_id)',
    count(*),
    coalesce(sum(group_size), 0)::bigint
  from (
    select count(*) as group_size
    from public.checkins
    group by session_id
    having count(*) > 1
  ) as duplicate_checkins

  union all

  select
    'sessions(engagement_id, seq)',
    count(*),
    coalesce(sum(group_size), 0)::bigint
  from (
    select count(*) as group_size
    from public.sessions
    group by engagement_id, seq
    having count(*) > 1
  ) as duplicate_session_sequences
) as duplicate_checks
order by check_name;

-- These names are intentionally not dropped by the migration. Review them
-- before applying; the migration stops if any unrecognized policy remains.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'coach_access', 'profiles', 'engagements', 'sessions', 'session_records', 'actions',
    'checkins', 'feedbacks', 'cheers', 'coach_notes', 'invites',
    'client_notes', 'key_results', 'kr_levels', 'reports',
    'notification_log', 'session_logs'
  ])
order by tablename, policyname;

-- Inspect existing unique indexes. In particular, a unique index on
-- session_records(session_id) alone prevents separate client and coach rows.
select indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename = any (array[
    'profiles', 'invites', 'session_records', 'checkins', 'sessions'
  ])
  and indexdef ilike 'create unique index%'
order by tablename, indexname;
