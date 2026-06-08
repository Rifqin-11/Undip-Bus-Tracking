create table if not exists public.latest_buggy_telemetry (
  id uuid primary key default gen_random_uuid(),
  buggy_id text not null,
  buggy_numeric_id integer,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  accuracy double precision,
  heading double precision,
  altitude double precision,
  battery_level integer,
  passengers integer,
  gsm jsonb,
  source text not null default 'gps_beacon',
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint latest_buggy_telemetry_buggy_id_key unique (buggy_id),
  constraint latest_buggy_telemetry_battery_level_check
    check (battery_level is null or (battery_level >= 0 and battery_level <= 100)),
  constraint latest_buggy_telemetry_passengers_check
    check (passengers is null or passengers >= 0)
);

create index if not exists latest_buggy_telemetry_recorded_at_idx
  on public.latest_buggy_telemetry (recorded_at desc);

alter table public.latest_buggy_telemetry enable row level security;
