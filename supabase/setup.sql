-- One-time setup after the auth migration. Run it after creating the accounts
-- in Authentication → Users.
--
-- Replace the two emails below with the accounts you created, then run it.
-- Running it again is safe.

-- The owner: sees every list and is the only one who can change rules.
update public.profiles
set role = 'owner', full_name = 'Sergio M.'
where id = (select id from auth.users where email = 'OWNER_EMAIL');

-- The rep: gets every list that has no rep yet.
update public.profiles
set role = 'rep', full_name = 'Ted S.'
where id = (select id from auth.users where email = 'REP_EMAIL');

update public.lists
set owner_id = (select id from auth.users where email = 'REP_EMAIL')
where owner_id is null;

-- Notes written before sign-in existed belong to the rep.
update public.notes
set author_id = (select id from auth.users where email = 'REP_EMAIL')
where author_id is null;

-- Check: both accounts with their roles, and who each list belongs to.
select p.full_name, p.role, u.email, count(l.id) as lists
from public.profiles p
join auth.users u on u.id = p.id
left join public.lists l on l.owner_id = p.id
group by p.full_name, p.role, u.email
order by p.role;
