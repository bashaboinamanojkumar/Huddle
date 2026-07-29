-- Campus org listings (TerpLink) are surfaced by Huddle but run by the organisation, so
-- they have no Huddle host. Peer meetups still require one.
alter table public.activities
  alter column host_id drop not null;

alter table public.activities
  add constraint activities_host_required
  check (source = 'org' or host_id is not null);

-- Peer meetups stay deliberately small; only org listings may seat a crowd.
alter table public.activities
  drop constraint activities_capacity_check;

alter table public.activities
  add constraint activities_capacity_check
  check (capacity >= 2 and capacity <= (case when source = 'org' then 1000 else 50 end));

-- external_id makes the org import re-runnable; external_url links back to the listing.
alter table public.activities
  add column if not exists external_id text,
  add column if not exists external_url text;

alter table public.activities
  add constraint activities_external_id_key unique (external_id);

-- Neither column is in the authenticated insert grant, so only migrations may set them.
