-- Accounts created before last_initial existed have blank name parts, which renders as a
-- bare "Student" everywhere. Fill only the empty halves so any name a student already set
-- is preserved.
update public.profiles p
set first_name = case
      when btrim(p.first_name) = '' then derived.out_first_name
      else p.first_name
    end,
    last_initial = case
      when btrim(p.last_initial) = '' then derived.out_last_initial
      else p.last_initial
    end
from auth.users u
cross join lateral public.huddle_derive_names(
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.email
) derived
where p.id = u.id
  and (btrim(p.first_name) = '' or btrim(p.last_initial) = '');
