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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived record;
begin
  select *
  into derived
  from public.huddle_derive_names(
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  );

  insert into public.profiles (
    id, email, first_name, last_name, last_initial, avatar_url, university_id
  )
  values (
    new.id,
    new.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(
      coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
      ''
    ),
    public.huddle_university_id_for_email(new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users;
  derived record;
  result public.profiles;
begin
  select * into auth_user from auth.users where id = (select auth.uid());
  if auth_user.id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select *
  into derived
  from public.huddle_derive_names(
    coalesce(
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name'
    ),
    auth_user.email
  );

  insert into public.profiles (
    id, email, first_name, last_name, last_initial, avatar_url, university_id
  )
  values (
    auth_user.id,
    auth_user.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(
      coalesce(
        auth_user.raw_user_meta_data ->> 'avatar_url',
        auth_user.raw_user_meta_data ->> 'picture'
      ),
      ''
    ),
    public.huddle_university_id_for_email(auth_user.email)
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = auth_user.id;
  return result;
end;
$$;

update public.profiles
set university_id = 'umb'
where university_id <> 'umb'
  and lower(btrim(email)) ~ '^[^[:space:]@]+@rx[.]maryland[.]edu$';

-- The trigger owner and ensure_profile security definer can call the helper. Browser roles cannot.
revoke execute on function public.huddle_university_id_for_email(text)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;
