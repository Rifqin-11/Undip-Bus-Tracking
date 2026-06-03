create table if not exists public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  devices_id text not null,
  buggy_id uuid not null references public.buggies(id) on delete cascade,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists device_assignments_active_device_unique
  on public.device_assignments (lower(devices_id))
  where is_active = true;

create index if not exists device_assignments_buggy_id_idx
  on public.device_assignments (buggy_id);

create index if not exists device_assignments_devices_id_idx
  on public.device_assignments (devices_id);

create or replace function public.set_device_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists device_assignments_set_updated_at on public.device_assignments;
create trigger device_assignments_set_updated_at
  before update on public.device_assignments
  for each row
  execute function public.set_device_assignments_updated_at();

alter table public.latest_buggy_telemetry
  add column if not exists devices_id text;

create index if not exists latest_buggy_telemetry_devices_id_idx
  on public.latest_buggy_telemetry (devices_id);

alter table public.buggy_history
  add column if not exists devices_id text;

create index if not exists buggy_history_devices_id_recorded_at_idx
  on public.buggy_history (devices_id, recorded_at desc);
