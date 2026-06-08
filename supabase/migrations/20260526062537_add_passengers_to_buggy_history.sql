alter table public.buggy_history
  add column if not exists passengers integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buggy_history_passengers_check'
      and conrelid = 'public.buggy_history'::regclass
  ) then
    alter table public.buggy_history
      add constraint buggy_history_passengers_check
        check (passengers is null or passengers >= 0) not valid;
  end if;
end $$;
