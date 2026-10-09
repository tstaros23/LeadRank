-- Importing a list: the list and all of its rows are saved in one step, so a
-- failure part-way through leaves nothing behind.
--
-- rows is a JSON array of { "row_number": 7, "data": { "Bed #": 29, ... } }.
-- owner_id is the rep the list is for, or null for a list only the owner sees.
--
-- security definer: the function itself checks that the caller is the owner,
-- then writes on their behalf.

create function public.import_list(
  name            text,
  source_filename text,
  sheet_name      text,
  columns         jsonb,
  owner_id        uuid,
  rows            jsonb
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Only the organization owner can import lists.';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
    raise exception 'The list has no rows.';
  end if;
  if jsonb_typeof(columns) <> 'array' or jsonb_array_length(columns) = 0 then
    raise exception 'The list has no columns.';
  end if;

  insert into public.lists (name, source_filename, sheet_name, columns, owner_id)
  values (name, source_filename, sheet_name, columns, owner_id)
  returning id into new_id;

  insert into public.leads (list_id, row_number, data)
  select new_id, (r ->> 'row_number')::integer, r -> 'data'
  from jsonb_array_elements(rows) as r;

  return new_id;
end;
$$;

revoke all on function public.import_list(text, text, text, jsonb, uuid, jsonb) from public;
grant execute on function public.import_list(text, text, text, jsonb, uuid, jsonb) to authenticated;
