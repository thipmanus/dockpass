create extension if not exists pgcrypto;

create table if not exists public.ships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  description text not null,
  remark text null,
  code_hash text not null unique,
  start_at timestamptz not null,
  end_at timestamptz not null,
  early_checkin_minutes int not null default 5,
  on_time_until_minutes int not null default 10,
  close_before_end_minutes int not null default 5,
  created_by uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ship_assignees (
  id uuid primary key default gen_random_uuid(),
  ship_id uuid references public.ships(id) on delete cascade,
  email text not null,
  created_at timestamptz default now(),
  unique(ship_id, email)
);

create table if not exists public.checkin_logs (
  id uuid primary key default gen_random_uuid(),
  ship_id uuid references public.ships(id) on delete cascade,
  email text not null,
  status text not null,
  lat double precision,
  lng double precision,
  accuracy double precision,
  client_captured_at timestamptz null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz default now(),
  unique(ship_id, email)
);

create table if not exists public.checkin_attempts (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  email_hash text,
  code_hash text,
  ip_hash text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ships add column if not exists title text;
alter table public.ships add column if not exists description text;
alter table public.ships add column if not exists remark text;

update public.ships
set title = left(coalesce(nullif(trim(title), ''), name), 50)
where title is null or trim(title) = '' or char_length(trim(title)) > 50;

update public.ships
set description = left(coalesce(nullif(trim(description), ''), title), 500)
where description is null or trim(description) = '' or char_length(trim(description)) > 500;

update public.ships
set remark = left(trim(remark), 250)
where remark is not null and char_length(trim(remark)) > 250;

update public.ships
set
  early_checkin_minutes = least(greatest(early_checkin_minutes, 0), 1440),
  on_time_until_minutes = least(greatest(on_time_until_minutes, 0), 1440),
  close_before_end_minutes = least(greatest(close_before_end_minutes, 0), 1440)
where
  early_checkin_minutes < 0
  or early_checkin_minutes > 1440
  or on_time_until_minutes < 0
  or on_time_until_minutes > 1440
  or close_before_end_minutes < 0
  or close_before_end_minutes > 1440;

alter table public.ships alter column title set not null;
alter table public.ships alter column description set not null;

create index if not exists ships_start_at_idx on public.ships(start_at);
create index if not exists ship_assignees_ship_id_idx on public.ship_assignees(ship_id);
create index if not exists ship_assignees_email_idx on public.ship_assignees(email);
create index if not exists checkin_logs_ship_id_idx on public.checkin_logs(ship_id);
create index if not exists checkin_logs_email_idx on public.checkin_logs(email);
create index if not exists checkin_attempts_created_at_idx on public.checkin_attempts(created_at);
create index if not exists checkin_attempts_route_created_at_idx on public.checkin_attempts(route, created_at);
create index if not exists checkin_attempts_ip_hash_created_at_idx on public.checkin_attempts(ip_hash, created_at);
create index if not exists checkin_attempts_email_hash_created_at_idx on public.checkin_attempts(email_hash, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ships_updated_at on public.ships;
create trigger set_ships_updated_at
before update on public.ships
for each row
execute function public.set_updated_at();

do $$
begin
  alter table public.ships
    add constraint ships_end_after_start check (end_at > start_at);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_duration_max_24_hours check (end_at <= start_at + interval '24 hours');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_title_length check (char_length(trim(title)) between 1 and 50);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_description_length check (char_length(trim(description)) between 1 and 500);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_remark_length check (remark is null or char_length(trim(remark)) <= 250);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_time_rules_non_negative
    check (
      early_checkin_minutes >= 0
      and on_time_until_minutes >= 0
      and close_before_end_minutes >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ships
    add constraint ships_time_rules_max_1440
    check (
      early_checkin_minutes <= 1440
      and on_time_until_minutes <= 1440
      and close_before_end_minutes <= 1440
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.ship_assignees
    add constraint ship_assignees_email_normalized check (email = lower(trim(email)));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.checkin_logs
    add constraint checkin_logs_status_valid
    check (status in ('ON_TIME', 'LATE', 'OUT_OF_SHIP', 'TOO_EARLY'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.checkin_logs
    add constraint checkin_logs_lat_valid check (lat is null or (lat >= -90 and lat <= 90));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.checkin_logs
    add constraint checkin_logs_lng_valid check (lng is null or (lng >= -180 and lng <= 180));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.checkin_logs
    add constraint checkin_logs_accuracy_valid check (accuracy is null or (accuracy >= 0 and accuracy <= 10000));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.checkin_logs
    add constraint checkin_logs_email_normalized check (email = lower(trim(email)));
exception
  when duplicate_object then null;
end $$;

alter table public.ships enable row level security;
alter table public.ship_assignees enable row level security;
alter table public.checkin_logs enable row level security;
alter table public.checkin_attempts enable row level security;

drop policy if exists "No anonymous ships access" on public.ships;
drop policy if exists "No anonymous ship assignees access" on public.ship_assignees;
drop policy if exists "No anonymous checkin logs access" on public.checkin_logs;
drop policy if exists "No anonymous checkin attempts access" on public.checkin_attempts;

create policy "No anonymous ships access"
on public.ships
for all
using (false)
with check (false);

create policy "No anonymous ship assignees access"
on public.ship_assignees
for all
using (false)
with check (false);

create policy "No anonymous checkin logs access"
on public.checkin_logs
for all
using (false)
with check (false);

create policy "No anonymous checkin attempts access"
on public.checkin_attempts
for all
using (false)
with check (false);
