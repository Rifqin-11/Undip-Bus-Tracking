alter table public.latest_buggy_telemetry
  add column if not exists received_at timestamptz;

update public.latest_buggy_telemetry
set received_at = coalesce(received_at, updated_at, recorded_at)
where received_at is null;

alter table public.latest_buggy_telemetry
  alter column received_at set default now();

create index if not exists latest_buggy_telemetry_received_at_idx
  on public.latest_buggy_telemetry (received_at desc);
