-- Sign-in and who can see or change what.
--
-- One organization for now. Every account has a profile with a role:
--   owner → sees every list, and is the only one who can change scoring rules
--   rep   → sees only the lists assigned to them
-- Anyone who can see a lead can read and add notes on it; only a note's
-- author can edit or delete it. Nothing is readable without signing in.

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'rep' check (role in ('owner', 'rep')),
  created_at timestamptz not null default now()
);

-- Every new account gets a profile. The name comes from the "full_name"
-- user metadata if set, otherwise the part of the email before the @.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for accounts that already exist.
insert into public.profiles (id, full_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Ownership columns -----------------------------------------------------------

-- The rep a list belongs to. Existing lists are assigned in setup.sql.
alter table public.lists add column owner_id uuid references public.profiles (id);

-- Notes point at their author's profile instead of storing a name.
alter table public.notes
  add column author_id uuid references public.profiles (id) default auth.uid();
alter table public.notes drop column author;

-- Access helpers --------------------------------------------------------------

-- Used by the policies below. security definer so it can read profiles
-- without going through profiles' own policies.
create function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'owner'
  );
$$;

create function public.can_see_list(target_list uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.lists where id = target_list and owner_id = (select auth.uid())
  );
$$;

-- Replace the open proof-of-concept policies ---------------------------------

drop policy "Anyone can read lists" on public.lists;
drop policy "Anyone can read leads" on public.leads;
drop policy "Anyone can read rules" on public.rules;
drop policy "Anyone can add rules" on public.rules;
drop policy "Anyone can change rules" on public.rules;
drop policy "Anyone can remove rules" on public.rules;
drop policy "Anyone can read notes" on public.notes;
drop policy "Anyone can add notes" on public.notes;
drop policy if exists "Anyone can change notes" on public.notes;
drop policy if exists "Anyone can remove notes" on public.notes;

alter table public.profiles enable row level security;

create policy "Signed-in users can see teammates" on public.profiles
  for select to authenticated using (true);

create policy "Lists are visible to their rep and the owner" on public.lists
  for select to authenticated using (public.can_see_list(id));

create policy "Leads are visible with their list" on public.leads
  for select to authenticated using (public.can_see_list(list_id));

create policy "Rules are visible with their list" on public.rules
  for select to authenticated using (public.can_see_list(list_id));

create policy "Only the owner adds rules" on public.rules
  for insert to authenticated with check (public.is_owner());

create policy "Only the owner changes rules" on public.rules
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "Only the owner removes rules" on public.rules
  for delete to authenticated using (public.is_owner());

create policy "Notes are visible with their lead" on public.notes
  for select to authenticated using (
    exists (select 1 from public.leads where id = lead_id and public.can_see_list(list_id))
  );

create policy "Anyone who can see a lead can note it" on public.notes
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.leads where id = lead_id and public.can_see_list(list_id))
  );

create policy "Authors edit their own notes" on public.notes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own notes" on public.notes
  for delete to authenticated using (author_id = (select auth.uid()));
