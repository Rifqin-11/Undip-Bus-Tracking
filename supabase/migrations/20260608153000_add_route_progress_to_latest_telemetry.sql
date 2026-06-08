alter table public.latest_buggy_telemetry
  add column if not exists path_cursor integer,
  add column if not exists current_stop_index integer;
