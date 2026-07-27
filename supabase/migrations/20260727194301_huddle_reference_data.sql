-- Vetted public meet-points, carried over from lib/data/seed.ts with their original slugs
-- so any existing references keep resolving.
insert into public.locations (id, university_id, name, area, safety_note) values
  ('loc-mckeldin', 'umd', 'McKeldin Library Lobby', 'McKeldin Mall', 'Public indoor meet-point with staff nearby.'),
  ('loc-stamp', 'umd', 'Stamp Student Union Atrium', 'Stamp', 'Central campus location with high foot traffic.'),
  ('loc-board-brew', 'umd', 'The Board and Brew', 'College Park', 'Public cafe near campus.'),
  ('loc-eppley', 'umd', 'Eppley Recreation Center Lobby', 'North Campus', 'Public lobby before activity areas.'),
  ('loc-hornbake', 'umd', 'Hornbake Plaza', 'Hornbake', 'Open public outdoor plaza.'),
  ('loc-tawes', 'umd', 'Tawes Plaza Benches', 'Arts District', 'Public outdoor seating near academic buildings.'),
  ('loc-eppley-gym', 'umd', 'Eppley Recreation Center Gym', 'North Campus', 'Public gym facility with staff on site.'),
  ('loc-eppley-pickleball', 'umd', 'Eppley Pickleball Courts', 'North Campus', 'Outdoor public courts next to Eppley Rec Center.'),
  ('loc-eppley-tennis', 'umd', 'Eppley Tennis Courts', 'North Campus', 'Public tennis courts next to Eppley Rec Center.'),
  ('loc-eppley-pool', 'umd', 'Eppley Aquatic Center', 'North Campus', 'Public pool facility with lifeguards on duty.'),
  ('loc-golf-course', 'umd', 'UMD Golf Course', 'South Campus', 'Public golf course on campus grounds.'),
  ('loc-paint-branch', 'umd', 'Paint Branch Trail', 'East Campus', 'Public outdoor trail - stay on marked paths.')
on conflict (id) do update
  set university_id = excluded.university_id,
      name = excluded.name,
      area = excluded.area,
      safety_note = excluded.safety_note;

-- Moderation terms previously hard-coded in lib/safety/keywords.ts.
insert into public.safety_keywords (term) values
  ('private residence'),
  ('dorm room only'),
  ('bring alcohol'),
  ('substances'),
  ('no one can know'),
  ('send nudes'),
  ('self harm'),
  ('kill myself'),
  ('hurt someone')
on conflict (term) do nothing;

-- Chat is the only surface that needs live updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
