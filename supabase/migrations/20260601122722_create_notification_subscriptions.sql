create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_agent text,
  user_lat double precision,
  user_lng double precision,
  nearby_radius_meters integer not null default 150,
  last_notified_key text,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_subscriptions_lat_check
    check (user_lat is null or (user_lat between -90 and 90)),
  constraint notification_subscriptions_lng_check
    check (user_lng is null or (user_lng between -180 and 180)),
  constraint notification_subscriptions_radius_check
    check (nearby_radius_meters between 50 and 1000)
);

create index if not exists notification_subscriptions_user_id_idx
  on public.notification_subscriptions (user_id);

create index if not exists notification_subscriptions_last_notified_at_idx
  on public.notification_subscriptions (last_notified_at desc);

alter table public.notification_subscriptions enable row level security;
