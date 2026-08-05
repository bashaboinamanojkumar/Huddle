-- Owner-private, immutable, idempotent meetup pulse responses.

create or replace function public.submit_pulse_response(
  p_activity_id uuid,
  p_did_meet boolean,
  p_rating integer default null
)
returns public.pulses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result public.pulses;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_did_meet is null then
    raise exception 'Pulse response is required' using errcode = '22023';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'Pulse rating must be between 1 and 5' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.rsvps r
    where r.activity_id = p_activity_id
      and r.user_id = actor
      and r.status = 'going'
  ) then
    raise exception 'Only going attendees can submit a pulse response'
      using errcode = '42501';
  end if;

  insert into public.pulses (activity_id, user_id, did_meet, rating)
  values (p_activity_id, actor, p_did_meet, p_rating)
  on conflict (activity_id, user_id) do nothing
  returning * into result;

  if result.id is not null then
    return result;
  end if;

  select * into result
  from public.pulses
  where activity_id = p_activity_id and user_id = actor;

  if result.did_meet is not distinct from p_did_meet
    and result.rating is not distinct from p_rating
  then
    return result;
  end if;

  raise exception 'Pulse response already submitted with different values'
    using errcode = '22023';
end;
$$;

drop policy if exists "Log own pulses" on public.pulses;
revoke insert, update, delete on public.pulses from anon, authenticated;

revoke execute on function public.submit_pulse_response(uuid, boolean, integer)
  from public, anon;
grant execute on function public.submit_pulse_response(uuid, boolean, integer)
  to authenticated;
