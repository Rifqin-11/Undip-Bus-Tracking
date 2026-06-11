alter table public.buggy_history
  add column if not exists received_at timestamptz,
  add column if not exists gsm jsonb,
  add column if not exists path_cursor integer,
  add column if not exists current_stop_index integer;
