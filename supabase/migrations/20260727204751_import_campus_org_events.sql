-- Campus org listings previously hardcoded in app/api/terplink/route.tsx. They live here
-- so students can RSVP and open a group chat around them. Ids are derived from the source
-- id so re-running the import updates rows instead of duplicating them.
insert into public.activities (
  id, external_id, external_url, title, description, category, location_id,
  host_id, capacity, start_time, availability_block, source, status,
  university_id, cohort, comfort_size, safety_preference
)
values
  (md5('umb-wellness-001')::uuid, 'umb-wellness-001', 'https://terplink.umd.edu',
   'UMB Student Wellness Walk',
   'A casual morning walk for UMB students to connect, unwind, and get some fresh air between classes.',
   'outdoors', 'loc-eppley', null, 15, '2026-07-22T13:00:00Z', 'weekday_morning', 'org', 'approved',
   'umb', 'umb-pilot', 'either', 'none'),

  (md5('terplink-12478027')::uuid, 'terplink-12478027', 'https://terplink.umd.edu/event/12478027',
   'Figure Drawing Workshop',
   'Join Studio A for a live, clothed model figure drawing session with multiple timed sessions. All supplies provided — no experience needed.',
   'arts', 'loc-stamp', null, 20, '2026-07-20T22:30:00Z', 'weekday_evening', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12467869')::uuid, 'terplink-12467869', 'https://terplink.umd.edu/event/12467869',
   'Community Learning Garden Volunteer Hours',
   'Join us in the Community Learning Garden for fresh air, good vibes, and garden therapy. No experience needed. Located between Eppley and the School of Public Health.',
   'volunteering', 'loc-eppley', null, 20, '2026-07-21T14:00:00Z', 'weekday_morning', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12510045')::uuid, 'terplink-12510045', 'https://terplink.umd.edu/event/12510045',
   'Cozy Conversations: Heart & Harm',
   'Join the Memorial Chapel for free lunch and conversation about religious and spiritual practice, wellness, and mental health. Spots are limited — great for an honest, low-key chat.',
   'faith', 'loc-mckeldin', null, 15, '2026-07-22T16:00:00Z', 'weekday_afternoon', 'org', 'approved',
   'umd', 'umd-pilot', 'small', 'none'),

  (md5('terplink-12467873')::uuid, 'terplink-12467873', 'https://terplink.umd.edu/event/12467873',
   'Community Learning Garden Volunteer Hours',
   'Saturday morning garden therapy — fresh air, good vibes, no experience needed. SSL hours available. Located between Eppley and the School of Public Health.',
   'volunteering', 'loc-eppley', null, 20, '2026-07-25T13:00:00Z', 'weekend_morning', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12437391')::uuid, 'terplink-12437391', 'https://terplink.umd.edu/event/12437391',
   'Terrapin Anime Society: Otakon 2026',
   'Join UMD students at Otakon — one of the largest anime and Japanese pop culture conventions in the US, right in Washington DC. Panels, cosplay, artist alleys, and more.',
   'hangout', 'loc-stamp', null, 30, '2026-07-31T12:00:00Z', 'weekend_morning', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12478035')::uuid, 'terplink-12478035', 'https://terplink.umd.edu/event/12478035',
   'Gnome Handbuilding',
   'Create a ceramic gnome in Studio A''s pottery studio! Gnomes will be fired and ready within 3 weeks. Wear clothes you''re comfortable getting dirty.',
   'arts', 'loc-stamp', null, 15, '2026-08-01T17:00:00Z', 'weekend_afternoon', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12478030')::uuid, 'terplink-12478030', 'https://terplink.umd.edu/event/12478030',
   'Play in Clay',
   'Experiment with clay and the pottery wheel! Learn to wedge, center, and pull a cylinder. Drop in, first-come first-serve. Wear clothes you''re comfortable getting dirty.',
   'arts', 'loc-stamp', null, 20, '2026-08-08T17:00:00Z', 'weekend_afternoon', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12472469')::uuid, 'terplink-12472469', 'https://terplink.umd.edu/event/12472469',
   'STAMP Garden Club Event',
   'Help care for the Chef''s Garden with weeding and watering. Meet near the clock at Stamp. No experience necessary, SSL hours available, gloves and tools provided.',
   'volunteering', 'loc-stamp', null, 15, '2026-08-19T13:00:00Z', 'weekday_morning', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12501410')::uuid, 'terplink-12501410', 'https://terplink.umd.edu/event/12501410',
   'STAMP Extravaganza',
   'Kick off your first night on campus! Hypnotist, game show, bingo, karaoke, scavenger hunt, glow bowling, and prizes. Free food and fun until midnight — perfect for meeting new people.',
   'hangout', 'loc-stamp', null, 200, '2026-08-29T01:00:00Z', 'weekend_evening', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12483338')::uuid, 'terplink-12483338', 'https://terplink.umd.edu/event/12483338',
   'SEE Presents: Moonlit Music',
   'An outdoor evening music event at the Nyumburu Amphitheater. A great low-key way to unwind and meet people under the stars.',
   'arts', 'loc-hornbake', null, 100, '2026-08-30T01:00:00Z', 'weekend_evening', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none'),

  (md5('terplink-12389371')::uuid, 'terplink-12389371', 'https://terplink.umd.edu/event/12389371',
   'stART — Art Volunteering with Kids',
   'Help elementary-aged kids from the College Park community with art projects. Meet at the UMD Memorial Chapel at 2pm to carpool. Not religious — focused on art and mentorship.',
   'volunteering', 'loc-mckeldin', null, 15, '2026-09-01T19:00:00Z', 'weekday_afternoon', 'org', 'approved',
   'umd', 'umd-pilot', 'either', 'none')

on conflict (external_id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  location_id = excluded.location_id,
  capacity = excluded.capacity,
  start_time = excluded.start_time,
  availability_block = excluded.availability_block,
  status = excluded.status,
  university_id = excluded.university_id,
  cohort = excluded.cohort,
  comfort_size = excluded.comfort_size,
  safety_preference = excluded.safety_preference,
  external_url = excluded.external_url;
