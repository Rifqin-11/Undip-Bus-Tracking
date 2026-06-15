alter table public.haltes
add column if not exists is_optional boolean not null default false;

update public.haltes
set is_optional = true
where lower(name) like '%fakultas psikologi%';
