-- Store operational telemetry from MQTT/GPS tracker simulator.
-- Safe to run repeatedly.

alter table public.buggy_history
  add column if not exists passengers integer,
  add column if not exists capacity integer;

comment on column public.buggy_history.passengers is
  'Passenger count reported by MQTT/GPS telemetry.';

comment on column public.buggy_history.capacity is
  'Vehicle passenger capacity reported by MQTT/GPS telemetry.';
