alter table public.buggy_history
  add column if not exists passengers integer;

alter table public.buggy_history
  add constraint buggy_history_passengers_check
    check (passengers is null or passengers >= 0) not valid;
