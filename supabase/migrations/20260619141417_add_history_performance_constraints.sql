create unique index if not exists buggy_session_history_unique_bucket_idx
  on public.buggy_session_history (buggy_id, session_date, session_number);

create index if not exists buggy_session_history_started_at_idx
  on public.buggy_session_history (started_at desc);

create index if not exists buggy_history_buggy_recorded_at_idx
  on public.buggy_history (buggy_id, recorded_at desc);

create index if not exists buggy_history_recorded_at_idx
  on public.buggy_history (recorded_at desc);
