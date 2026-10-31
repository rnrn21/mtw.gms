-- Read-only schema inspection. This query does not read application rows or
-- modify tables, data, grants, or policies.

select jsonb_pretty(jsonb_build_object(
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name,
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) order by table_name, ordinal_position), '[]'::jsonb)
    from information_schema.columns
    where table_schema = 'public'
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tc.table_name,
      'name', tc.constraint_name,
      'type', tc.constraint_type,
      'column', kcu.column_name,
      'references_table', ccu.table_name,
      'references_column', ccu.column_name
    ) order by tc.table_name, tc.constraint_name, kcu.ordinal_position), '[]'::jsonb)
    from information_schema.table_constraints as tc
    left join information_schema.key_column_usage as kcu
      on kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
      and kcu.table_name = tc.table_name
    left join information_schema.constraint_column_usage as ccu
      on ccu.constraint_schema = tc.constraint_schema
      and ccu.constraint_name = tc.constraint_name
    where tc.constraint_schema = 'public'
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', t.tablename,
      'rls_enabled', t.rowsecurity,
      'policy', p.policyname,
      'roles', p.roles,
      'command', p.cmd,
      'using', p.qual,
      'check', p.with_check
    ) order by t.tablename, p.policyname), '[]'::jsonb)
    from pg_catalog.pg_tables as t
    left join pg_catalog.pg_policies as p
      on p.schemaname = t.schemaname
      and p.tablename = t.tablename
    where t.schemaname = 'public'
  ),
  'grants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type
    ) order by table_name, grantee, privilege_type), '[]'::jsonb)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and upper(grantee) in ('ANON', 'AUTHENTICATED', 'PUBLIC')
  )
));

select
  c.conrelid::regclass as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint as c
where c.connamespace = 'public'::regnamespace
  and c.contype = 'c'
order by c.conrelid::regclass::text, c.conname;
