-- Create the buggy_history table
create table if not exists public.buggy_history (
  id uuid default gen_random_uuid() primary key,
  buggy_id text not null,
  buggy_numeric_id integer,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  accuracy double precision,
  heading double precision,
  altitude double precision,
  source text,
  recorded_at timestamp with time zone default now() not null
);

-- Create indexes for better query performance
create index if not exists idx_buggy_history_buggy_id on public.buggy_history(buggy_id);
create index if not exists idx_buggy_history_recorded_at on public.buggy_history(recorded_at);
create index if not exists idx_buggy_history_location on public.buggy_history(lat, lng);

-- Enable RLS (Row Level Security)
alter table public.buggy_history enable row level security;

-- Create RLS policies
create policy "Service role can insert history" on public.buggy_history
  for insert with check (true);

create policy "Service role can read history" on public.buggy_history
  for select using (true);

create policy "Authenticated users can read history" on public.buggy_history
  for select to authenticated using (true);

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on table public.buggy_history to anon, authenticated;