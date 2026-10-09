-- Notes can be edited and deleted.
--
-- updated_at is set when a note's text changes, so the app can mark it
-- "edited". Editing also clears verdict and reason: they describe the old
-- text, so the note is scored again from the new text.

alter table public.notes add column updated_at timestamptz;

-- Proof of concept: no sign-in yet, so anyone with the page can edit or
-- delete any note. Once auth exists, this narrows to the note's author.
create policy "Anyone can change notes" on public.notes
  for update to anon, authenticated using (true) with check (true);

create policy "Anyone can remove notes" on public.notes
  for delete to anon, authenticated using (true);
