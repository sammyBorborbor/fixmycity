-- Milestone 5: AI duplicate detection support.
-- A vector index for embedding similarity search, a duplicate-of link on the
-- audit log (parallel to the existing `note` column), and the SQL function
-- backing check-duplicates: PostGIS proximity+time filter, then pgvector
-- cosine-distance ranking. Called only by the service-role client.

-- ---- Vector index ---------------------------------------------------------
-- HNSW over IVFFlat: IVFFlat needs a representative sample at build time to
-- balance its lists (rule of thumb ~rows/1000) and performs poorly on this
-- pilot's tiny expected row count; HNSW has no training step.
create index reports_embedding_hnsw_idx
  on public.reports
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ---- Duplicate-of link (on the audit row, alongside `note`) ---------------
-- A fact about a specific reject transition ("rejected because it duplicates
-- report X"), not an ongoing property of the report itself, so it lives on
-- status_transitions rather than adding a second staff-writable pointer
-- column to reports.
-- `on delete restrict` (matching reports.reporter_id below), not `set null`:
-- status_transitions is append-only (the block_transition_mutation trigger
-- rejects ANY update, even one from a FK's own ON DELETE SET NULL action), so
-- SET NULL would make deleting a referenced report fail with "append-only"
-- instead of the clear FK violation RESTRICT gives.
alter table public.status_transitions
  add column duplicate_of_report_id uuid references public.reports (id) on delete restrict;

-- ---- Duplicate candidate lookup --------------------------------------------
-- Open (not resolved/rejected) reports within p_radius_m metres and p_days
-- days of the target, ranked by pgvector cosine distance on `embedding`.
-- Only ever called by the service-role client (which already bypasses RLS),
-- so no security definer is needed here.
create or replace function public.find_duplicate_candidates(
  p_report_id uuid,
  p_radius_m int default 100,
  p_days int default 7,
  p_limit int default 3
)
returns table (
  id uuid,
  reference text,
  category public.report_category,
  location_name text,
  status public.report_status,
  photo_path text,
  similarity real,
  distance_m real,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    r.id,
    r.reference,
    r.category,
    r.location_name,
    r.status,
    r.photo_urls[1] as photo_path,
    (1 - (r.embedding operator(extensions.<=>) t.embedding))::real as similarity,
    extensions.st_distance(r.location, t.location)::real as distance_m,
    r.created_at
  from public.reports r
  cross join (
    select location, embedding from public.reports where id = p_report_id
  ) as t
  where r.id <> p_report_id
    and r.embedding is not null
    and t.embedding is not null
    and r.status not in ('resolved', 'rejected')
    and extensions.st_dwithin(r.location, t.location, p_radius_m)
    and r.created_at >= now() - make_interval(days => p_days)
  order by r.embedding operator(extensions.<=>) t.embedding
  limit p_limit;
$$;

-- new functions are not auto-exposed to anon/authenticated under this
-- project's Data API config; these grants make that explicit rather than
-- relying on the implicit default, matching the "explicit grants only"
-- convention set in 20260707132647_tighten_table_privileges.sql.
revoke execute on function public.find_duplicate_candidates(uuid, int, int, int) from public;
grant execute on function public.find_duplicate_candidates(uuid, int, int, int) to service_role;
