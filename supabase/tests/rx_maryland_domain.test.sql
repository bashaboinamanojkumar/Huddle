begin;

select plan(9);

select is(
  (
    select university_id
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000817'
  ),
  'umb',
  'existing rx.maryland.edu profile is backfilled to UMB'
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
  'huddle_university_id_for_email',
  'new user trigger uses the shared database mapper'
);
select matches(
  pg_get_functiondef('public.ensure_profile()'::regprocedure),
  'huddle_university_id_for_email',
  'profile repair uses the shared database mapper'
);

select * from finish();
rollback;
