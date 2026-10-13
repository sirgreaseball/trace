-- Two more ways onto a team.
--
-- A team code (like LF-7KQ2XM) is short enough to read out in a lab: anyone who
-- types it joins with the code's role. Each team has at most one code per role,
-- and the lead can replace it at any time.
--
-- An email invite waits for whoever signs in with that address, so a lead can
-- add their mentor before the mentor has an account.

create table public.team_codes (
  code text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  role public.member_role not null check (role <> 'owner'),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, role)
);
alter table public.team_codes enable row level security;
create policy "owners read" on public.team_codes for select to authenticated using (public.is_owner(workspace_id));

create table public.email_invites (
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null default 'member' check (role <> 'owner'),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);
create index email_invites_email_idx on public.email_invites (email);
alter table public.email_invites enable row level security;
create policy "owners manage" on public.email_invites for all to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

-- The team's code for a role, made on first ask. p_fresh replaces it.
create function public.team_code(p_workspace uuid, p_role public.member_role, p_fresh boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare c text; k text;
begin
  if not public.is_owner(p_workspace) then raise exception 'only the team lead can share codes'; end if;
  if p_role = 'owner' then raise exception 'codes are for members and mentors'; end if;
  if p_fresh then delete from public.team_codes where workspace_id = p_workspace and role = p_role; end if;
  select code into c from public.team_codes where workspace_id = p_workspace and role = p_role;
  if c is not null then return c; end if;
  select key into k from public.workspaces where id = p_workspace;
  loop
    -- Six characters from an alphabet without look-alikes (no 0/O, 1/I).
    select k || '-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
      into c from (select extensions.gen_random_bytes(6) as b) x, generate_series(0, 5) as i;
    begin
      insert into public.team_codes (code, workspace_id, role) values (c, p_workspace, p_role);
      return c;
    exception when unique_violation then
      -- Another team already has this code; draw again.
    end;
  end loop;
end $$;

create function public.code_info(p_code text)
returns table (workspace_name text, course text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select w.name, w.course, c.role
  from public.team_codes c join public.workspaces w on w.id = c.workspace_id
  where c.code = upper(trim(p_code))
$$;

create function public.join_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.team_codes;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into c from public.team_codes where code = upper(trim(p_code));
  if not found then raise exception 'no team has that code'; end if;
  insert into public.members (workspace_id, user_id, role)
  values (c.workspace_id, auth.uid(), c.role)
  on conflict (workspace_id, user_id) do nothing;
  return c.workspace_id;
end $$;

-- Adds someone who already has an account straight away; otherwise saves an
-- invite that claim_invites() turns into a membership when they sign in.
create function public.add_by_email(p_workspace uuid, p_email text, p_role public.member_role default 'member')
returns text language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email)); uid uuid;
begin
  if not public.is_owner(p_workspace) then raise exception 'only the team lead can add people'; end if;
  if p_role = 'owner' then raise exception 'add them first, then make them a team lead'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'that does not look like an email address'; end if;
  select id into uid from auth.users where lower(email) = e and email_confirmed_at is not null;
  if uid is not null then
    insert into public.members (workspace_id, user_id, role) values (p_workspace, uid, p_role)
    on conflict (workspace_id, user_id) do update set role = excluded.role
      where public.members.role <> 'owner';
    return 'added';
  end if;
  insert into public.email_invites (workspace_id, email, role) values (p_workspace, e, p_role)
  on conflict (workspace_id, email) do update set role = excluded.role, created_at = now();
  return 'invited';
end $$;

create function public.claim_invites() returns int
language plpgsql security definer set search_path = '' as $$
declare e text; n int;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into e from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if e is null then return 0; end if;
  with mine as (delete from public.email_invites where email = e returning workspace_id, role)
  insert into public.members (workspace_id, user_id, role)
  select workspace_id, auth.uid(), role from mine
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on public.team_codes, public.email_invites from anon;
revoke execute on function public.team_code(uuid, public.member_role, boolean), public.code_info(text), public.join_with_code(text),
  public.add_by_email(uuid, text, public.member_role), public.claim_invites() from anon, public;
grant execute on function public.team_code(uuid, public.member_role, boolean), public.code_info(text), public.join_with_code(text),
  public.add_by_email(uuid, text, public.member_role), public.claim_invites() to authenticated;
