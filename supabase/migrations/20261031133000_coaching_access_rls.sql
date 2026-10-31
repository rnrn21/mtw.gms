begin;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists profiles_phone_key
  on public.profiles (phone)
  where phone is not null;

create unique index if not exists invites_token_hash_key
  on public.invites (token_hash);

create unique index if not exists session_records_session_id_written_by_key
  on public.session_records (session_id, written_by);

create unique index if not exists checkins_session_id_key
  on public.checkins (session_id);

create unique index if not exists sessions_engagement_id_seq_key
  on public.sessions (engagement_id, seq);

create table if not exists public.coach_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.coach_access enable row level security;

revoke all privileges on table
  public.profiles,
  public.engagements,
  public.sessions,
  public.session_records,
  public.actions,
  public.checkins,
  public.feedbacks,
  public.cheers,
  public.coach_notes,
  public.invites,
  public.client_notes,
  public.key_results,
  public.kr_levels,
  public.reports,
  public.notification_log,
  public.session_logs,
  public.coach_access
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.engagements,
  public.sessions,
  public.session_records,
  public.actions,
  public.checkins,
  public.feedbacks,
  public.cheers,
  public.coach_notes,
  public.invites,
  public.client_notes,
  public.key_results,
  public.kr_levels,
  public.reports,
  public.notification_log,
  public.session_logs
to authenticated;

grant select on table public.coach_access to authenticated;

alter table public.profiles enable row level security;
alter table public.engagements enable row level security;
alter table public.sessions enable row level security;
alter table public.session_records enable row level security;
alter table public.actions enable row level security;
alter table public.checkins enable row level security;
alter table public.feedbacks enable row level security;
alter table public.cheers enable row level security;
alter table public.coach_notes enable row level security;
alter table public.invites enable row level security;
alter table public.client_notes enable row level security;
alter table public.key_results enable row level security;
alter table public.kr_levels enable row level security;
alter table public.reports enable row level security;
alter table public.notification_log enable row level security;
alter table public.session_logs enable row level security;

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_access as ca
    where ca.user_id = auth.uid()
  );
$$;

create or replace function public.owns_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = p_client_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.owns_engagement(p_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagements as e
    join public.profiles as p on p.id = e.client_id
    where e.id = p_engagement_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions as s
    join public.engagements as e on e.id = s.engagement_id
    join public.profiles as p on p.id = e.client_id
    where s.id = p_session_id
      and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.can_access_feedback_target(
  p_target_type text,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_target_type
    when 'record' then exists (
      select 1
      from public.session_records as sr
      join public.sessions as s on s.id = sr.session_id
      join public.engagements as e on e.id = s.engagement_id
      join public.profiles as p on p.id = e.client_id
      where sr.id = p_target_id
        and p.auth_user_id = auth.uid()
    )
    when 'checkin' then exists (
      select 1
      from public.checkins as c
      join public.sessions as s on s.id = c.session_id
      join public.engagements as e on e.id = s.engagement_id
      join public.profiles as p on p.id = e.client_id
      where c.id = p_target_id
        and p.auth_user_id = auth.uid()
    )
    when 'action_note' then exists (
      select 1
      from public.actions as a
      join public.sessions as s on s.id = a.session_id
      join public.engagements as e on e.id = s.engagement_id
      join public.profiles as p on p.id = e.client_id
      where a.id = p_target_id
        and p.auth_user_id = auth.uid()
    )
    else false
  end;
$$;

revoke all on function public.is_coach() from public, anon;
revoke all on function public.owns_client(uuid) from public, anon;
revoke all on function public.owns_engagement(uuid) from public, anon;
revoke all on function public.owns_session(uuid) from public, anon;
revoke all on function public.can_access_feedback_target(text, uuid) from public, anon;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.owns_client(uuid) to authenticated;
grant execute on function public.owns_engagement(uuid) to authenticated;
grant execute on function public.owns_session(uuid) to authenticated;
grant execute on function public.can_access_feedback_target(text, uuid) to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'coach_access', 'profiles', 'engagements', 'sessions', 'session_records',
        'actions', 'checkins', 'feedbacks', 'cheers', 'coach_notes', 'invites',
        'client_notes', 'key_results', 'kr_levels', 'reports',
        'notification_log', 'session_logs'
      ])
      and policyname = any (array[
        'coach_access_read_self',
        'profiles_read_authorized', 'profiles_insert_coach', 'profiles_update_coach', 'profiles_delete_coach',
        'engagements_read_authorized', 'engagements_insert_coach', 'engagements_update_coach', 'engagements_delete_coach',
        'sessions_read_authorized', 'sessions_insert_coach', 'sessions_update_coach', 'sessions_delete_coach',
        'session_records_read_authorized', 'session_records_insert_coach', 'session_records_insert_client_when_open',
        'session_records_update_coach', 'session_records_update_client_when_open', 'session_records_delete_coach',
        'actions_read_authorized', 'actions_insert_coach', 'actions_update_coach', 'actions_delete_coach',
        'checkins_read_authorized', 'checkins_insert_coach', 'checkins_insert_client_in_window',
        'checkins_update_coach', 'checkins_update_client_in_window', 'checkins_delete_coach',
        'feedbacks_read_authorized', 'feedbacks_insert_coach', 'feedbacks_update_coach', 'feedbacks_delete_coach',
        'cheers_read_authorized', 'cheers_insert_coach', 'cheers_update_coach', 'cheers_delete_coach',
        'coach_notes_coach_only', 'coach_notes_coach_guard', 'invites_coach_only',
        'client_notes_read_authorized', 'client_notes_write_coach',
        'key_results_read_authorized', 'key_results_write_coach',
        'kr_levels_read_authorized', 'kr_levels_write_coach',
        'reports_read_authorized', 'reports_write_coach',
        'notification_log_read_self_or_coach', 'notification_log_write_coach',
        'session_logs_coach_only'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'coach_access', 'profiles', 'engagements', 'sessions', 'session_records',
        'actions', 'checkins', 'feedbacks', 'cheers', 'coach_notes', 'invites',
        'client_notes', 'key_results', 'kr_levels', 'reports',
        'notification_log', 'session_logs'
      ])
  ) then
    raise exception
      'Unexpected existing RLS policies remain on coaching tables; inspect them before applying this migration.';
  end if;
end;
$$;

create policy coach_access_read_self
  on public.coach_access for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_read_authorized
  on public.profiles for select to authenticated
  using (public.is_coach() or auth_user_id = (select auth.uid()));
create policy profiles_insert_coach
  on public.profiles for insert to authenticated
  with check (public.is_coach());
create policy profiles_update_coach
  on public.profiles for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy profiles_delete_coach
  on public.profiles for delete to authenticated
  using (public.is_coach());

create policy engagements_read_authorized
  on public.engagements for select to authenticated
  using (public.is_coach() or public.owns_client(client_id));
create policy engagements_insert_coach
  on public.engagements for insert to authenticated
  with check (public.is_coach());
create policy engagements_update_coach
  on public.engagements for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy engagements_delete_coach
  on public.engagements for delete to authenticated
  using (public.is_coach());

create policy sessions_read_authorized
  on public.sessions for select to authenticated
  using (public.is_coach() or public.owns_engagement(engagement_id));
create policy sessions_insert_coach
  on public.sessions for insert to authenticated
  with check (public.is_coach());
create policy sessions_update_coach
  on public.sessions for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy sessions_delete_coach
  on public.sessions for delete to authenticated
  using (public.is_coach());

create policy session_records_read_authorized
  on public.session_records for select to authenticated
  using (public.is_coach() or public.owns_session(session_id));
create policy session_records_insert_coach
  on public.session_records for insert to authenticated
  with check (public.is_coach());
create policy session_records_insert_client_when_open
  on public.session_records for insert to authenticated
  with check (
    written_by = 'client'
    and public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.status = 'recording'
        and (s.record_opened_at is not null or s.scheduled_end_at <= now())
    )
  );
create policy session_records_update_coach
  on public.session_records for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy session_records_update_client_when_open
  on public.session_records for update to authenticated
  using (
    written_by = 'client'
    and public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.status = 'recording'
        and (s.record_opened_at is not null or s.scheduled_end_at <= now())
    )
  )
  with check (
    written_by = 'client'
    and public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.status = 'recording'
        and (s.record_opened_at is not null or s.scheduled_end_at <= now())
    )
  );
create policy session_records_delete_coach
  on public.session_records for delete to authenticated
  using (public.is_coach());

create policy actions_read_authorized
  on public.actions for select to authenticated
  using (public.is_coach() or public.owns_session(session_id));
create policy actions_insert_coach
  on public.actions for insert to authenticated
  with check (public.is_coach());
create policy actions_update_coach
  on public.actions for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy actions_delete_coach
  on public.actions for delete to authenticated
  using (public.is_coach());

create policy checkins_read_authorized
  on public.checkins for select to authenticated
  using (public.is_coach() or public.owns_session(session_id));
create policy checkins_insert_coach
  on public.checkins for insert to authenticated
  with check (public.is_coach());
create policy checkins_insert_client_in_window
  on public.checkins for insert to authenticated
  with check (
    public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.scheduled_at <= now() + interval '24 hours'
    )
  );
create policy checkins_update_coach
  on public.checkins for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy checkins_update_client_in_window
  on public.checkins for update to authenticated
  using (
    public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.scheduled_at <= now() + interval '24 hours'
    )
  )
  with check (
    public.owns_session(session_id)
    and exists (
      select 1
      from public.sessions as s
      where s.id = session_id
        and s.scheduled_at <= now() + interval '24 hours'
    )
  );
create policy checkins_delete_coach
  on public.checkins for delete to authenticated
  using (public.is_coach());

create policy feedbacks_read_authorized
  on public.feedbacks for select to authenticated
  using (
    public.is_coach()
    or public.can_access_feedback_target(target_type, target_id)
  );
create policy feedbacks_insert_coach
  on public.feedbacks for insert to authenticated
  with check (public.is_coach());
create policy feedbacks_update_coach
  on public.feedbacks for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy feedbacks_delete_coach
  on public.feedbacks for delete to authenticated
  using (public.is_coach());

create policy cheers_read_authorized
  on public.cheers for select to authenticated
  using (public.is_coach() or public.owns_engagement(engagement_id));
create policy cheers_insert_coach
  on public.cheers for insert to authenticated
  with check (public.is_coach());
create policy cheers_update_coach
  on public.cheers for update to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy cheers_delete_coach
  on public.cheers for delete to authenticated
  using (public.is_coach());

create policy coach_notes_coach_only
  on public.coach_notes for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());
create policy coach_notes_coach_guard
  on public.coach_notes as restrictive for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy invites_coach_only
  on public.invites for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy client_notes_read_authorized
  on public.client_notes for select to authenticated
  using (public.is_coach() or public.owns_client(client_id));
create policy client_notes_write_coach
  on public.client_notes for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy key_results_read_authorized
  on public.key_results for select to authenticated
  using (public.is_coach() or public.owns_engagement(engagement_id));
create policy key_results_write_coach
  on public.key_results for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy kr_levels_read_authorized
  on public.kr_levels for select to authenticated
  using (public.is_coach() or public.owns_session(session_id));
create policy kr_levels_write_coach
  on public.kr_levels for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy reports_read_authorized
  on public.reports for select to authenticated
  using (
    public.is_coach()
    or (
      published_at is not null
      and public.owns_engagement(engagement_id)
    )
  );
create policy reports_write_coach
  on public.reports for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy notification_log_read_self_or_coach
  on public.notification_log for select to authenticated
  using (public.is_coach() or user_id = (select auth.uid()));
create policy notification_log_write_coach
  on public.notification_log for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create policy session_logs_coach_only
  on public.session_logs for all to authenticated
  using (public.is_coach())
  with check (public.is_coach());

create or replace function public.get_invite_preview(p_token_hash text)
returns table (client_name text, phone_hint text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.name,
    case
      when p.phone is null then null
      else '•••• ' || right(p.phone, 4)
    end
  from public.invites as i
  join public.profiles as p on p.id = i.client_id
  where i.token_hash = p_token_hash
    and i.used_at is null
    and i.expires_at > now()
    and p.auth_user_id is null;
$$;

create or replace function public.create_client_invite(
  p_name text,
  p_phone text,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_client_id uuid;
  existing_auth_user_id uuid;
begin
  if not public.is_coach() then
    raise exception 'Coach access required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Client name is required';
  end if;

  if p_phone is null or p_phone !~ '^\+8210[0-9]{8}$' then
    raise exception 'Phone number must be a normalized Korean mobile number';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invite token hash is invalid';
  end if;

  select id, auth_user_id
    into new_client_id, existing_auth_user_id
    from public.profiles
    where phone = p_phone
    for update;

  if new_client_id is not null and existing_auth_user_id is not null then
    raise exception 'This phone number is already connected to a client account';
  end if;

  if new_client_id is null then
    insert into public.profiles (name, phone)
      values (trim(p_name), p_phone)
      returning id into new_client_id;
  else
    update public.profiles
      set name = trim(p_name)
      where id = new_client_id;

    update public.invites
      set expires_at = now()
      where client_id = new_client_id
        and used_at is null
        and expires_at > now();
  end if;

  insert into public.invites (client_id, token_hash, expires_at)
    values (new_client_id, p_token_hash, now() + interval '7 days');

  return new_client_id;
end;
$$;

create or replace function public.create_engagement_with_first_session(
  p_client_id uuid,
  p_title text,
  p_objective_text text,
  p_total_sessions integer,
  p_first_session_at timestamptz,
  p_first_session_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_engagement_id uuid;
begin
  if not public.is_coach() then
    raise exception 'Coach access required';
  end if;

  if not exists (select 1 from public.profiles where id = p_client_id) then
    raise exception 'Client not found';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Engagement title is required';
  end if;

  if p_total_sessions < 1 or p_total_sessions > 100 then
    raise exception 'Total sessions must be between 1 and 100';
  end if;

  if p_first_session_at is null
    or p_first_session_end_at is null
    or p_first_session_end_at <= p_first_session_at then
    raise exception 'A valid first session time range is required';
  end if;

  insert into public.engagements (client_id, title, objective_text, total_sessions, status)
    values (p_client_id, trim(p_title), nullif(trim(p_objective_text), ''), p_total_sessions, 'active')
    returning id into new_engagement_id;

  insert into public.sessions (engagement_id, seq, scheduled_at, scheduled_end_at, status)
    values (new_engagement_id, 1, p_first_session_at, p_first_session_end_at, 'scheduled');

  return new_engagement_id;
end;
$$;

create or replace function public.schedule_coaching_session(
  p_engagement_id uuid,
  p_seq integer,
  p_scheduled_at timestamptz,
  p_scheduled_end_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session_id uuid;
  total_session_count integer;
begin
  if not public.is_coach() then
    raise exception 'Coach access required';
  end if;

  select total_sessions
    into total_session_count
    from public.engagements
    where id = p_engagement_id;

  if total_session_count is null then
    raise exception 'Engagement not found';
  end if;

  if p_seq < 1 or p_seq > total_session_count then
    raise exception 'Session sequence is outside the engagement range';
  end if;

  if p_scheduled_at is null
    or p_scheduled_end_at is null
    or p_scheduled_end_at <= p_scheduled_at then
    raise exception 'A valid session time range is required';
  end if;

  insert into public.sessions (engagement_id, seq, scheduled_at, scheduled_end_at, status)
    values (p_engagement_id, p_seq, p_scheduled_at, p_scheduled_end_at, 'scheduled')
    returning id into new_session_id;

  return new_session_id;
end;
$$;

create or replace function public.submit_session_feedback(
  p_session_id uuid,
  p_text text,
  p_emoji text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record_id uuid;
  new_feedback_id uuid;
begin
  if not public.is_coach() then
    raise exception 'Coach access required';
  end if;

  if nullif(trim(p_text), '') is null then
    raise exception 'Feedback text is required';
  end if;

  select id
    into target_record_id
    from public.session_records
    where session_id = p_session_id
      and written_by = 'client';

  if target_record_id is null then
    raise exception 'Client session record not found';
  end if;

  insert into public.feedbacks (target_type, target_id, text, emoji)
    values ('record', target_record_id, trim(p_text), nullif(trim(p_emoji), ''))
    returning id into new_feedback_id;

  update public.sessions
    set status = 'feedback_done'
    where id = p_session_id
      and status in ('recorded', 'feedback_done');

  if not found then
    raise exception 'Session is not ready for feedback';
  end if;

  return new_feedback_id;
end;
$$;

create or replace function public.claim_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_client_id uuid;
  invited_phone text;
  current_phone text;
  current_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  current_phone := auth.jwt() ->> 'phone';

  select p.id, p.phone, p.auth_user_id
    into invited_client_id, invited_phone, current_owner
    from public.invites as i
    join public.profiles as p on p.id = i.client_id
    where i.token_hash = p_token_hash
      and i.used_at is null
      and i.expires_at > now()
    for update of i, p;

  if invited_client_id is null then
    raise exception 'Invite is invalid, expired, or already used';
  end if;

  if invited_phone is null or current_phone is distinct from invited_phone then
    raise exception 'Authenticated phone does not match the invite';
  end if;

  if current_owner is not null and current_owner <> auth.uid() then
    raise exception 'Invite belongs to another authenticated user';
  end if;

  update public.profiles
    set auth_user_id = auth.uid()
    where id = invited_client_id
      and (auth_user_id is null or auth_user_id = auth.uid());

  update public.invites
    set used_at = now()
    where token_hash = p_token_hash
      and used_at is null;

  return invited_client_id;
end;
$$;

create or replace function public.update_action_status(
  p_action_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('none', 'partial', 'done') then
    raise exception 'Invalid action status';
  end if;

  update public.actions as a
    set status = p_status
    where a.id = p_action_id
    and public.owns_session(a.session_id)
    and not exists (
      select 1
      from public.sessions as current_session
      join public.sessions as next_session
        on next_session.engagement_id = current_session.engagement_id
        and next_session.seq > current_session.seq
        and next_session.record_opened_at is not null
      where current_session.id = a.session_id
    );

  if not found then
    raise exception 'Action not found or access denied';
  end if;
end;
$$;

create or replace function public.open_session_record(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.sessions%rowtype;
  opened_by_coach boolean;
begin
  opened_by_coach := public.is_coach();

  select *
    into target_session
    from public.sessions
    where id = p_session_id
    for update;

  if target_session.id is null then
    raise exception 'Session not found';
  end if;

  if not opened_by_coach and not public.owns_session(p_session_id) then
    raise exception 'Access denied';
  end if;

  if not opened_by_coach
    and (target_session.scheduled_end_at is null or target_session.scheduled_end_at > now()) then
    raise exception 'The recording opens at the scheduled end time';
  end if;

  if target_session.record_opened_at is null then
    update public.sessions
      set status = 'recording',
          record_opened_at = now(),
          open_reason = case when opened_by_coach then 'coach' else 'auto' end
      where id = p_session_id
        and status in ('scheduled', 'reserved', 'recording');

    if not found then
      raise exception 'Session cannot be opened in its current state';
    end if;

    update public.actions as a
      set closed_at = now()
      where a.closed_at is null
        and exists (
          select 1
          from public.sessions as previous_session
          where previous_session.id = a.session_id
            and previous_session.engagement_id = target_session.engagement_id
            and previous_session.seq = target_session.seq - 1
        );
  end if;
end;
$$;

create or replace function public.submit_session_record(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions as s
    set status = 'recorded',
        ended_at = coalesce(s.ended_at, now())
    where s.id = p_session_id
      and public.owns_session(s.id)
      and s.status = 'recording'
      and (s.record_opened_at is not null or s.scheduled_end_at <= now())
      and exists (
        select 1
        from public.session_records as sr
        where sr.session_id = s.id
          and sr.written_by = 'client'
      );

  if not found then
    raise exception 'Session record is not ready to submit';
  end if;
end;
$$;

create or replace function public.mark_feedback_seen(p_feedback_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.feedbacks as f
    set client_seen_at = coalesce(f.client_seen_at, now())
    where f.id = p_feedback_id
      and public.can_access_feedback_target(f.target_type, f.target_id);

  if not found then
    raise exception 'Feedback not found or access denied';
  end if;
end;
$$;

create or replace function public.mark_cheer_seen(p_cheer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cheers as c
    set client_seen_at = coalesce(c.client_seen_at, now())
    where c.id = p_cheer_id
      and public.owns_engagement(c.engagement_id);

  if not found then
    raise exception 'Cheer not found or access denied';
  end if;
end;
$$;

revoke all on function public.get_invite_preview(text) from public;
revoke all on function public.create_client_invite(text, text, text) from public, anon;
revoke all on function public.create_engagement_with_first_session(uuid, text, text, integer, timestamptz, timestamptz) from public, anon;
revoke all on function public.schedule_coaching_session(uuid, integer, timestamptz, timestamptz) from public, anon;
revoke all on function public.submit_session_feedback(uuid, text, text) from public, anon;
revoke all on function public.claim_invite(text) from public, anon;
revoke all on function public.update_action_status(uuid, text) from public, anon;
revoke all on function public.open_session_record(uuid) from public, anon;
revoke all on function public.submit_session_record(uuid) from public, anon;
revoke all on function public.mark_feedback_seen(uuid) from public, anon;
revoke all on function public.mark_cheer_seen(uuid) from public, anon;

grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.create_client_invite(text, text, text) to authenticated;
grant execute on function public.create_engagement_with_first_session(uuid, text, text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.schedule_coaching_session(uuid, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.submit_session_feedback(uuid, text, text) to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.update_action_status(uuid, text) to authenticated;
grant execute on function public.open_session_record(uuid) to authenticated;
grant execute on function public.submit_session_record(uuid) to authenticated;
grant execute on function public.mark_feedback_seen(uuid) to authenticated;
grant execute on function public.mark_cheer_seen(uuid) to authenticated;

commit;
