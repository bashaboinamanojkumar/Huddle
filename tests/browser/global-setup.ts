import { createClient } from "@supabase/supabase-js"
import {
  cleanupFixtureSql,
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_LOCATION_ID,
  FIXTURE_PASSWORD,
  INELIGIBLE_ACTIVITY_ID,
  RSVP_ACTIVITY_ID,
  runFixtureSql,
} from "./fixture"

export default async function globalSetup(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error("Browser fixture credentials are missing")
  }

  cleanupFixtureSql()
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Browser Fixture" },
  })
  if (error || !data.user) throw new Error(error?.message ?? "Could not create browser user")

  const browserClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await browserClient.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  })
  if (signInError) {
    throw new Error(`Browser fixture cannot authenticate: ${signInError.message}`)
  }
  await browserClient.auth.signOut()

  const userId = data.user.id
  runFixtureSql(`
    update public.profiles
    set first_name = 'Browser',
        last_initial = 'F',
        completed_onboarding = true,
        interests = array['coffee']::public.category[],
        availability_blocks = array['weekday_afternoon']::public.availability_block[]
    where id = '${userId}';

    insert into public.locations (id, university_id, name, area, safety_note)
    values (
      '${FIXTURE_LOCATION_ID}', 'umd', 'Browser Test Commons',
      'College Park', 'Meet in the staffed public lobby.'
    );

    insert into public.activities (
      id, title, description, category, location_id, host_id, capacity,
      start_time, availability_block, source, status, university_id
    ) values
      (
        '${DETAIL_ACTIVITY_ID}', 'Browser Detail Huddle', 'A deterministic browser fixture.',
        'coffee', '${FIXTURE_LOCATION_ID}', '${userId}', 4, now() + interval '1 day',
        'weekday_afternoon', 'seeded', 'approved', 'umd'
      ),
      (
        '${RSVP_ACTIVITY_ID}', 'Browser RSVP Huddle', 'Used to verify first-RSVP prompts.',
        'coffee', '${FIXTURE_LOCATION_ID}', '${userId}', 4, now() + interval '2 days',
        'weekday_afternoon', 'seeded', 'approved', 'umd'
      ),
      (
        '${INELIGIBLE_ACTIVITY_ID}', 'Browser Ineligible Pulse', 'No RSVP exists for this fixture.',
        'coffee', '${FIXTURE_LOCATION_ID}', '${userId}', 4, now() + interval '3 days',
        'weekday_afternoon', 'seeded', 'approved', 'umd'
      );

    insert into public.rsvps (activity_id, user_id, status)
    values ('${DETAIL_ACTIVITY_ID}', '${userId}', 'going');

    insert into public.notifications (
      id, user_id, type, category, title, body, url, data, dedupe_key,
      created_at, last_event_at
    ) values
      (
        '99300000-0000-4000-8000-000000000001', '${userId}',
        'activity_joined', 'activities', 'Browser activity update',
        'Your test activity is ready.', '/app/activity/${DETAIL_ACTIVITY_ID}',
        jsonb_build_object('activityId', '${DETAIL_ACTIVITY_ID}'),
        'browser:activity', now(), now()
      ),
      (
        '99300000-0000-4000-8000-000000000002', '${userId}',
        'chat_message', 'chat', 'Browser chat update',
        'A test chat update is waiting.', '/app/chats/${DETAIL_ACTIVITY_ID}',
        jsonb_build_object('activityId', '${DETAIL_ACTIVITY_ID}'),
        'browser:chat', now(), now() - interval '1 minute'
      );
  `)
}
