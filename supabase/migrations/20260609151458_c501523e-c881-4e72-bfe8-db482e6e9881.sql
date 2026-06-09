
-- Extensions for scheduling + HTTP from Postgres
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============ kaggle_rows ============
create table public.kaggle_rows (
  id           bigserial primary key,
  source_file  text        not null,
  row_hash     text        not null,
  data         jsonb       not null,
  event_date   date,
  synced_at    timestamptz not null default now(),
  unique (source_file, row_hash)
);

create index kaggle_rows_file_date_idx on public.kaggle_rows (source_file, event_date);
create index kaggle_rows_data_gin       on public.kaggle_rows using gin (data);

grant select on public.kaggle_rows to anon, authenticated;
grant all    on public.kaggle_rows to service_role;
grant usage, select on sequence public.kaggle_rows_id_seq to service_role;

alter table public.kaggle_rows enable row level security;

create policy "kaggle_rows public read"
  on public.kaggle_rows for select
  to anon, authenticated
  using (true);

-- ============ kaggle_aggregates ============
create table public.kaggle_aggregates (
  metric       text   not null,
  bucket       text   not null,
  dimensions   jsonb  not null default '{}'::jsonb,
  value        numeric not null,
  updated_at   timestamptz not null default now(),
  primary key (metric, bucket, dimensions)
);

grant select on public.kaggle_aggregates to anon, authenticated;
grant all    on public.kaggle_aggregates to service_role;

alter table public.kaggle_aggregates enable row level security;

create policy "kaggle_aggregates public read"
  on public.kaggle_aggregates for select
  to anon, authenticated
  using (true);

-- ============ sync_runs ============
create table public.sync_runs (
  id               bigserial primary key,
  source           text        not null,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text        not null default 'running',
  files_processed  integer     not null default 0,
  rows_upserted    integer     not null default 0,
  error            text
);

create index sync_runs_source_started_idx on public.sync_runs (source, started_at desc);

grant all on public.sync_runs to service_role;
grant usage, select on sequence public.sync_runs_id_seq to service_role;

alter table public.sync_runs enable row level security;
-- no anon/authenticated policies → backend-only via service_role
