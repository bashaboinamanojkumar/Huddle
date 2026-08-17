begin;

select plan(9);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '80000000-0000-4000-8000-000000000817',
  'authenticated',
  'authenticated',
  'pharmacy-trigger@rx.maryland.edu',
  '',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Pharmacy Trigger"}'::jsonb,
  now(),
  now()
);

select is(
  (
    select university_id
    from public.profiles
    where id = '80000000-0000-4000-8000-000000000817'
  ),
  'umb',
  'new rx.maryland.edu auth user receives a UMB profile'
);

select is(
  public.huddle_university_id_for_email('pharmacy@rx.maryland.edu'),
  'umb',
  'rx.maryland.edu maps to UMB'
);
select is(
  public.huddle_university_id_for_email(' Pharmacy@RX.MARYLAND.EDU '),
  'umb',
  'rx.maryland.edu mapping normalizes case and whitespace'
);
select is(
  public.huddle_university_id_for_email('student@umaryland.edu'),
  'umb',
  'umaryland.edu remains UMB'
);
select is(
  public.huddle_university_id_for_email('student@umd.edu'),
  'umd',
  'umd.edu remains UMD'
);
select is(
  public.huddle_university_id_for_email('student@mail.rx.maryland.edu'),
  'umd',
  'nested rx domain is not classified as UMB'
);
select is(
  public.huddle_university_id_for_email('student@rx.maryland.edu.evil.test'),
  'umd',
  'rx lookalike is not classified as UMB'
);
select matches(
  pg_get_functiondef('public.handle_new_user()'::regprocedure),
  'insert into public[.]notification_preferences',
  'rx domain migration preserves notification provisioning for new users'
);
select matches(
  pg_get_functiondef('public.ensure_profile()'::regprocedure),
  'insert into public[.]notification_preferences',
  'rx domain migration preserves notification provisioning during profile repair'
);

select * from finish();
rollback;
