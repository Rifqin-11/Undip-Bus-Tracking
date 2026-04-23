-- Prevent duplicate rows for the same buggy session time range.
-- This migration is safe to re-run.

do $$
begin
  if to_regclass('public.buggy_session_history') is null then
    return;
  end if;

  -- Keep one row per (buggy_id, started_at, ended_at) and remove extras.
  execute $dedupe$
    delete from public.buggy_session_history a
    using public.buggy_session_history b
    where a.ctid < b.ctid
      and a.buggy_id = b.buggy_id
      and a.started_at = b.started_at
      and a.ended_at = b.ended_at
  $dedupe$;

  execute $idx$
    create unique index if not exists uq_buggy_session_history_time_window
    on public.buggy_session_history (buggy_id, started_at, ended_at)
  $idx$;
end
$$;
