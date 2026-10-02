-- Scoring rules, per list.
--
-- Each list gets its own rules, built from its own columns. A column can
-- have any number of rules; each one that is on counts equally toward fit:
--   fit = rules hit ÷ rules turned on
--
-- `value` holds the operator's settings:
--   between       { "min": 40, "max": 120 }
--   at_least      { "min": 40 }
--   at_most       { "max": 120 }
--   equals        { "value": "FellowshipLIFE" }   (text or number)
--   is_one_of     { "values": ["Atlas Healthcare", "FellowshipLIFE"] }
--   contains      { "text": "senior" }
--   is_blank      null
--   is_not_blank  null

-- Replaces the earlier org-wide draft of this table, if it was created.
drop table if exists public.scoring_rules;

create table public.rules (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  column_name text not null,
  operator    text not null check (operator in (
    'between', 'at_least', 'at_most', 'equals',
    'is_one_of', 'contains', 'is_blank', 'is_not_blank'
  )),
  value       jsonb,
  enabled     boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rules_list_id_idx on public.rules (list_id, position);

-- Proof of concept: no sign-in yet, so anyone with the page can edit rules.
-- Once auth exists, writes narrow to the list's owner.
alter table public.rules enable row level security;

create policy "Anyone can read rules" on public.rules
  for select to anon, authenticated using (true);

create policy "Anyone can add rules" on public.rules
  for insert to anon, authenticated with check (true);

create policy "Anyone can change rules" on public.rules
  for update to anon, authenticated using (true) with check (true);

create policy "Anyone can remove rules" on public.rules
  for delete to anon, authenticated using (true);
