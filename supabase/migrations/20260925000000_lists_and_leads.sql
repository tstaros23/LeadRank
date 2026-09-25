-- Lists and leads.
--
-- A list is one uploaded spreadsheet. Its header row is kept in `columns`,
-- in file order, so the app never renames, merges or reorders anything.
-- Each lead is one data row. Its cells live in `data`, keyed by the exact
-- header text, so any spreadsheet shape fits without a schema change.

create table public.lists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  source_filename text,
  sheet_name      text,
  -- Ordered header row: [{ "name": "Bed #", "type": "number" }, ...]
  columns         jsonb not null,
  created_at      timestamptz not null default now()
);

create table public.leads (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  -- Position in the uploaded file (1 = first data row). Never changes.
  row_number integer not null,
  -- Cells keyed by header: { "Community": "Abrams Residence", "Bed #": 29, ... }
  data       jsonb not null,
  created_at timestamptz not null default now(),
  unique (list_id, row_number)
);

create index leads_list_id_row_number_idx on public.leads (list_id, row_number);

-- Proof of concept: no sign-in yet, so the browser's anon key may read.
-- Writes stay closed until auth and per-rep ownership are added.
alter table public.lists enable row level security;
alter table public.leads enable row level security;

create policy "Anyone can read lists" on public.lists
  for select to anon, authenticated using (true);

create policy "Anyone can read leads" on public.leads
  for select to anon, authenticated using (true);
