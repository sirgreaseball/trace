-- Trace schema: one web of links between requirements, work and people.
-- Every table is workspace-scoped and protected by row-level security.

create extension if not exists pgcrypto with schema extensions;

create type public.member_role as enum ('owner', 'member', 'mentor');

-- People ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  github text check (github is null or github ~ '^[A-Za-z0-9-]{1,39}$'),
  hue int not null default floor(random() * 360)::int check (hue between 0 and 359),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, github)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
                  nullif(new.raw_user_meta_data ->> 'full_name', ''),
                  split_part(new.email, '@', 1), 'Someone'), 80),
    nullif(new.raw_user_meta_data ->> 'user_name', '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Workspaces -------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  key text not null check (key ~ '^[A-Z]{2,5}$'),
  course text not null default '' check (char_length(course) <= 80),
  repo text check (repo is null or repo ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
  seq int not null default 0,
  dseq int not null default 0,
  demo boolean not null default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table public.members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.invites (
  token text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
  workspace_id uuid not null references public.workspaces on delete cascade,
  role public.member_role not null default 'member' check (role <> 'owner'),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index invites_workspace_idx on public.invites (workspace_id);

create table public.sync_state (
  workspace_id uuid primary key references public.workspaces on delete cascade,
  etag text,
  synced_at timestamptz,
  last_error text
);

-- Membership helpers (security definer so policies don't recurse) ------------

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where workspace_id = ws and user_id = auth.uid())
$$;

create function public.can_write(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members
                 where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'member'))
$$;

create function public.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members
                 where workspace_id = ws and user_id = auth.uid() and role = 'owner')
$$;

create function public.shares_workspace(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members a join public.members b using (workspace_id)
                 where a.user_id = auth.uid() and b.user_id = other)
$$;

-- Requirements and work ------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  number int not null,
  title text not null check (char_length(title) between 1 and 200),
  narrative text not null default '' check (char_length(narrative) <= 2000),
  acceptance text not null default '' check (char_length(acceptance) <= 4000),
  priority text not null default 'should' check (priority in ('must', 'should', 'could')),
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  story_id uuid references public.stories on delete set null,
  number int not null,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee uuid references public.profiles on delete set null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  unique (workspace_id, number)
);
create index tasks_story_idx on public.tasks (story_id);

create table public.commits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  sha text not null check (sha ~ '^[0-9a-f]{7,40}$'),
  message text not null check (char_length(message) <= 8000),
  author_login text,
  author_name text not null default '',
  user_id uuid references public.profiles on delete set null,
  additions int not null default 0,
  deletions int not null default 0,
  files text[] not null default '{}',
  detailed boolean not null default false,
  url text,
  committed_at timestamptz not null,
  unique (workspace_id, sha)
);
create index commits_ws_time_idx on public.commits (workspace_id, committed_at desc);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  commit_id uuid not null references public.commits on delete cascade,
  story_id uuid references public.stories on delete cascade,
  task_id uuid references public.tasks on delete cascade,
  source text not null check (source in ('id', 'suggested', 'manual', 'ai')),
  status text not null default 'confirmed' check (status in ('confirmed', 'suggested', 'rejected')),
  score real,
  reason text,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(story_id, task_id) = 1),
  unique nulls not distinct (commit_id, story_id, task_id)
);
create index links_ws_idx on public.links (workspace_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid default auth.uid() references public.profiles on delete set null,
  story_id uuid references public.stories on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_ws_time_idx on public.messages (workspace_id, created_at desc);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  number int not null,
  title text not null check (char_length(title) between 1 and 200),
  rationale text not null default '' check (char_length(rationale) <= 4000),
  alternatives text not null default '' check (char_length(alternatives) <= 2000),
  story_id uuid references public.stories on delete set null,
  message_id uuid references public.messages on delete set null,
  supersedes uuid references public.decisions on delete set null,
  decided_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind text not null check (kind in ('commit', 'task', 'decision', 'story')),
  item_id uuid not null,
  subject uuid references public.profiles on delete cascade,
  raised_by uuid default auth.uid() references public.profiles on delete set null,
  note text not null check (char_length(note) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (char_length(resolution) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_ws_idx on public.disputes (workspace_id);

create table public.ai_cache (
  workspace_id uuid not null references public.workspaces on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

-- Numbering: stories and tasks share one counter (LF-1, LF-2 ...); decisions use D-1, D-2 ...
-- NOT NULL is checked after BEFORE triggers, so clients simply omit the number.

create function public.next_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'decisions' then
    update public.workspaces set dseq = dseq + 1 where id = new.workspace_id returning dseq into new.number;
  else
    update public.workspaces set seq = seq + 1 where id = new.workspace_id returning seq into new.number;
  end if;
  return new;
end $$;

create trigger stories_number before insert on public.stories
  for each row when (new.number is null) execute function public.next_number();
create trigger tasks_number before insert on public.tasks
  for each row when (new.number is null) execute function public.next_number();
create trigger decisions_number before insert on public.decisions
  for each row when (new.number is null) execute function public.next_number();

create function public.task_done_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_at := coalesce(new.done_at, now());
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end $$;

create trigger tasks_done_at before insert or update of status on public.tasks
  for each row execute function public.task_done_at();

-- Workspace scoping must not change after insert.
create function public.keep_workspace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.workspace_id <> old.workspace_id then
    raise exception 'workspace_id is immutable';
  end if;
  return new;
end $$;

create trigger stories_keep_ws before update on public.stories for each row execute function public.keep_workspace();
create trigger tasks_keep_ws before update on public.tasks for each row execute function public.keep_workspace();
create trigger commits_keep_ws before update on public.commits for each row execute function public.keep_workspace();
create trigger links_keep_ws before update on public.links for each row execute function public.keep_workspace();
create trigger messages_keep_ws before update on public.messages for each row execute function public.keep_workspace();
create trigger decisions_keep_ws before update on public.decisions for each row execute function public.keep_workspace();
create trigger disputes_keep_ws before update on public.disputes for each row execute function public.keep_workspace();

-- Cross-table references must stay inside the same workspace.
create function public.same_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ok boolean := true;
begin
  if tg_table_name = 'tasks' then
    if new.story_id is not null then
      select exists (select 1 from public.stories where id = new.story_id and workspace_id = new.workspace_id) into ok;
    end if;
  elsif tg_table_name = 'links' then
    select exists (select 1 from public.commits where id = new.commit_id and workspace_id = new.workspace_id)
       and (new.story_id is null or exists (select 1 from public.stories where id = new.story_id and workspace_id = new.workspace_id))
       and (new.task_id is null or exists (select 1 from public.tasks where id = new.task_id and workspace_id = new.workspace_id))
      into ok;
  elsif tg_table_name = 'decisions' then
    select (new.story_id is null or exists (select 1 from public.stories where id = new.story_id and workspace_id = new.workspace_id))
       and (new.message_id is null or exists (select 1 from public.messages where id = new.message_id and workspace_id = new.workspace_id))
       and (new.supersedes is null or exists (select 1 from public.decisions where id = new.supersedes and workspace_id = new.workspace_id))
      into ok;
  elsif tg_table_name = 'messages' then
    if new.story_id is not null then
      select exists (select 1 from public.stories where id = new.story_id and workspace_id = new.workspace_id) into ok;
    end if;
  end if;
  if not ok then
    raise exception 'reference points outside this workspace';
  end if;
  return new;
end $$;

create trigger tasks_same_ws before insert or update on public.tasks for each row execute function public.same_workspace();
create trigger links_same_ws before insert or update on public.links for each row execute function public.same_workspace();
create trigger decisions_same_ws before insert or update on public.decisions for each row execute function public.same_workspace();
create trigger messages_same_ws before insert or update on public.messages for each row execute function public.same_workspace();

-- Row-level security -------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.sync_state enable row level security;
alter table public.stories enable row level security;
alter table public.tasks enable row level security;
alter table public.commits enable row level security;
alter table public.links enable row level security;
alter table public.messages enable row level security;
alter table public.decisions enable row level security;
alter table public.disputes enable row level security;
alter table public.ai_cache enable row level security;

create policy "see self and teammates" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace(id));
create policy "edit self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read" on public.workspaces for select to authenticated using (public.is_member(id));
create policy "owners edit" on public.workspaces for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy "owners delete" on public.workspaces for delete to authenticated using (public.is_owner(id) and not demo);

create policy "members read" on public.members for select to authenticated using (public.is_member(workspace_id));
create policy "owners change roles" on public.members for update to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "owners remove, anyone leaves" on public.members for delete to authenticated
  using (public.is_owner(workspace_id) or user_id = (select auth.uid()));

create policy "owners manage" on public.invites for all to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

create policy "members read" on public.sync_state for select to authenticated using (public.is_member(workspace_id));
create policy "writers write" on public.sync_state for insert to authenticated with check (public.can_write(workspace_id));
create policy "writers update" on public.sync_state for update to authenticated
  using (public.can_write(workspace_id)) with check (public.can_write(workspace_id));

-- Content tables: members read, owners/members write, mentors read-only.
do $$
declare t text;
begin
  foreach t in array array['stories', 'tasks', 'commits', 'links', 'decisions'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_member(workspace_id))', t);
    execute format('create policy "writers insert" on public.%I for insert to authenticated with check (public.can_write(workspace_id))', t);
    execute format('create policy "writers update" on public.%I for update to authenticated using (public.can_write(workspace_id)) with check (public.can_write(workspace_id))', t);
    execute format('create policy "writers delete" on public.%I for delete to authenticated using (public.can_write(workspace_id))', t);
  end loop;
end $$;

create policy "members read" on public.messages for select to authenticated using (public.is_member(workspace_id));
create policy "members post as self" on public.messages for insert to authenticated
  with check (public.is_member(workspace_id) and user_id = (select auth.uid()));
create policy "authors edit" on public.messages for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(workspace_id));
create policy "authors delete" on public.messages for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(workspace_id));

create policy "members read" on public.disputes for select to authenticated using (public.is_member(workspace_id));
create policy "members raise as self" on public.disputes for insert to authenticated
  with check (public.is_member(workspace_id) and raised_by = (select auth.uid()) and status = 'open');
create policy "raiser or owner resolves" on public.disputes for update to authenticated
  using (public.is_member(workspace_id) and (raised_by = (select auth.uid()) or public.is_owner(workspace_id)))
  with check (public.is_member(workspace_id));
create policy "raiser deletes" on public.disputes for delete to authenticated
  using (raised_by = (select auth.uid()));

create policy "members read" on public.ai_cache for select to authenticated using (public.is_member(workspace_id));
create policy "members write" on public.ai_cache for insert to authenticated with check (public.is_member(workspace_id));
create policy "members refresh" on public.ai_cache for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- RPCs ----------------------------------------------------------------------------

create function public.create_workspace(p_name text, p_key text, p_course text default '', p_repo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.workspaces (name, key, course, repo, created_by)
  values (trim(p_name), upper(trim(p_key)), coalesce(trim(p_course), ''), nullif(trim(p_repo), ''), auth.uid())
  returning id into ws;
  insert into public.members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end $$;

create function public.invite_info(p_token text)
returns table (workspace_name text, course text, role public.member_role, expired boolean)
language sql stable security definer set search_path = '' as $$
  select w.name, w.course, i.role, i.expires_at < now()
  from public.invites i join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token
$$;

create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into inv from public.invites where token = p_token;
  if not found then raise exception 'invite not found'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;
  return inv.workspace_id;
end $$;

-- Owners can't demote or remove the last owner.
create function public.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.members
                     where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id)
     and exists (select 1 from public.workspaces where id = old.workspace_id) then
    raise exception 'a workspace needs at least one owner';
  end if;
  return coalesce(new, old);
end $$;

create trigger members_keep_owner before update or delete on public.members
  for each row execute function public.keep_an_owner();

-- Full-text search across the evidence, ranked, with snippets. Runs as the caller, so RLS applies.
create function public.search_evidence(p_workspace uuid, p_query text, p_limit int default 12)
returns table (kind text, id uuid, ref text, title text, snippet text, rank real, created_at timestamptz)
language sql stable set search_path = '' as $$
  with q as (
    -- OR together the stemmed words of the question, so partial matches still rank.
    select websearch_to_tsquery('english', array_to_string(tsvector_to_array(to_tsvector('english', p_query)), ' or ')) as tsq
  ),
  hits as (
    select 'decision'::text as kind, d.id, 'D-' || d.number as ref, d.title,
           d.title || '. ' || d.rationale || ' ' || d.alternatives as body, d.created_at
    from public.decisions d where d.workspace_id = p_workspace
    union all
    select 'story', s.id, w.key || '-' || s.number, s.title,
           s.title || '. ' || s.narrative || ' ' || s.acceptance, s.created_at
    from public.stories s join public.workspaces w on w.id = s.workspace_id where s.workspace_id = p_workspace
    union all
    select 'message', m.id, null, coalesce(p.name, 'Someone'), m.body, m.created_at
    from public.messages m left join public.profiles p on p.id = m.user_id where m.workspace_id = p_workspace
    union all
    select 'commit', c.id, left(c.sha, 7), split_part(c.message, E'\n', 1), c.message, c.committed_at
    from public.commits c where c.workspace_id = p_workspace
    union all
    select 'task', t.id, w.key || '-' || t.number, t.title, t.title, t.created_at
    from public.tasks t join public.workspaces w on w.id = t.workspace_id where t.workspace_id = p_workspace
  )
  select h.kind, h.id, h.ref, h.title,
         ts_headline('english', h.body, q.tsq, 'MaxWords=28, MinWords=12, StartSel=<<, StopSel=>>'),
         (ts_rank_cd(to_tsvector('english', h.body), q.tsq)
           * case h.kind when 'decision' then 2.0 when 'story' then 1.4 when 'message' then 1.0 else 0.8 end)::real,
         h.created_at
  from hits h, q
  where q.tsq is not null and to_tsvector('english', h.body) @@ q.tsq
  order by 6 desc, h.created_at desc
  limit least(greatest(p_limit, 1), 30)
$$;

-- Realtime for chat.
alter publication supabase_realtime add table public.messages;

-- Clients only ever use the authenticated role; lock the anonymous role out of tables.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.invite_info(text) to anon, authenticated;
-- Owners may rename and re-point a workspace, but not touch its key, counters or demo flag.
revoke update on public.workspaces from authenticated;
grant update (name, course, repo) on public.workspaces to authenticated;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.search_evidence(uuid, text, int) to authenticated;
grant execute on function public.is_member(uuid), public.can_write(uuid), public.is_owner(uuid), public.shares_workspace(uuid) to authenticated;
