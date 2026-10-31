do $$
declare
  coach_email text := lower(trim('ymlee1126@gmail.com'));
  coach_user_id uuid;
begin
  if coach_email = 'replace_with_coach_email' or coach_email = '' then
    raise exception 'Replace REPLACE_WITH_COACH_EMAIL with the coach account email first.';
  end if;

  select id
    into coach_user_id
    from auth.users
    where lower(email) = coach_email
    limit 1;

  if coach_user_id is null then
    raise exception 'No Supabase Auth user exists for the configured coach email.';
  end if;

  insert into public.coach_access (user_id)
    values (coach_user_id)
    on conflict (user_id) do nothing;
end
$$;
