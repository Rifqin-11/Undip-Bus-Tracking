alter table public.buggy_session_history
  add column if not exists passenger_boardings integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buggy_session_history_passenger_boardings_check'
      and conrelid = 'public.buggy_session_history'::regclass
  ) then
    alter table public.buggy_session_history
      add constraint buggy_session_history_passenger_boardings_check
        check (passenger_boardings is null or passenger_boardings >= 0) not valid;
  end if;
end $$;
