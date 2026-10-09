-- Call notes. A lead can have any number of notes.
--
-- verdict and reason are filled in later, when the model reads each note
-- (1 = the call moved the lead forward, 0 = it didn't). They stay null until
-- then and are written once, at save, never recomputed on page view.

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  -- Plain name until sign-in exists; becomes a user reference then.
  author     text not null,
  verdict    smallint check (verdict in (0, 1)),
  reason     text,
  created_at timestamptz not null default now()
);

create index notes_lead_id_created_at_idx on public.notes (lead_id, created_at desc);

-- Proof of concept: no sign-in yet, so anyone with the page can read and add
-- notes. Editing and deleting stay closed.
alter table public.notes enable row level security;

create policy "Anyone can read notes" on public.notes
  for select to anon, authenticated using (true);

create policy "Anyone can add notes" on public.notes
  for insert to anon, authenticated with check (true);
