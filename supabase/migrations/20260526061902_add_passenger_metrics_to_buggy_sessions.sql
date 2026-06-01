alter table public.buggy_session_history
  add column if not exists passenger_avg double precision,
  add column if not exists passenger_peak integer,
  add column if not exists passenger_samples integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buggy_session_history_passenger_avg_check'
      and conrelid = 'public.buggy_session_history'::regclass
  ) then
    alter table public.buggy_session_history
      add constraint buggy_session_history_passenger_avg_check
        check (passenger_avg is null or passenger_avg >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'buggy_session_history_passenger_peak_check'
      and conrelid = 'public.buggy_session_history'::regclass
  ) then
    alter table public.buggy_session_history
      add constraint buggy_session_history_passenger_peak_check
        check (passenger_peak is null or passenger_peak >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'buggy_session_history_passenger_samples_check'
      and conrelid = 'public.buggy_session_history'::regclass
  ) then
    alter table public.buggy_session_history
      add constraint buggy_session_history_passenger_samples_check
        check (passenger_samples is null or passenger_samples >= 0) not valid;
  end if;
end $$;
