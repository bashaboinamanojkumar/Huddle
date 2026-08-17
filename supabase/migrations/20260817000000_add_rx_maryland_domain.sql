-- Keep application admission and profile campus assignment aligned for the School of Pharmacy.
create or replace function public.huddle_university_id_for_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p_email, ''))) ~
      '^[^[:space:]@]+@(umaryland[.]edu|rx[.]maryland[.]edu)$'
      then 'umb'
    else 'umd'
  end;
$$;

comment on function public.huddle_university_id_for_email(text) is
  'Maps an exact normalized eligible campus email to its Huddle university identifier.';

create or replace function public.huddle_set_profile_university_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.university_id := public.huddle_university_id_for_email(new.email);
  return new;
end;
$$;

comment on function public.huddle_set_profile_university_id() is
  'Derives a profile campus from its exact normalized email domain.';

drop trigger if exists set_profile_university_id_from_email on public.profiles;
create trigger set_profile_university_id_from_email
  before insert or update of email on public.profiles
  for each row execute function public.huddle_set_profile_university_id();

update public.profiles
set university_id = 'umb'
where university_id <> 'umb'
  and lower(btrim(email)) ~ '^[^[:space:]@]+@rx[.]maryland[.]edu$';

-- Profile writes can use these functions only through the database trigger.
revoke execute on function public.huddle_university_id_for_email(text)
  from public, anon, authenticated;
revoke execute on function public.huddle_set_profile_university_id()
  from public, anon, authenticated;
