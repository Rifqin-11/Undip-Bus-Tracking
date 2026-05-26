alter table public.buggy_session_history
  add column if not exists passenger_avg double precision,
  add column if not exists passenger_peak integer,
  add column if not exists passenger_samples integer;

alter table public.buggy_session_history
  add constraint buggy_session_history_passenger_avg_check
    check (passenger_avg is null or passenger_avg >= 0) not valid,
  add constraint buggy_session_history_passenger_peak_check
    check (passenger_peak is null or passenger_peak >= 0) not valid,
  add constraint buggy_session_history_passenger_samples_check
    check (passenger_samples is null or passenger_samples >= 0) not valid;
