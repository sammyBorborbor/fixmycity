-- External CV API integration (milestone 5).
--
-- The team's image model shipped as a standalone REST service (the "DID
-- Backend") that OWNS classification + duplicate detection: submit-report posts
-- the photo to it and it stores the image in its own container, runs
-- perceptual-hash dedup against everything already there, validates the photo is
-- a genuine environmental concern, and returns the verdicts. It exposes no
-- embedding vector, so the pgvector path from 20260708140000 is now dormant
-- (columns/index kept, not dropped, to avoid a destructive down-migration and
-- to leave the door open if a vector endpoint appears later).
--
-- These columns persist what the CV API returns per report so the console can
-- surface it (AI category suggestion + "possible duplicate" chips) without
-- re-calling the model, and so check-duplicates can map the CV API's own
-- integer report ids back to our rows.

alter table public.reports
  add column external_report_id bigint,          -- the report's id in the CV API's own DB
  add column duplicate_status text,              -- CV verdict: new | duplicate | possible_duplicate | supporting_evidence
  add column detected_objects jsonb,             -- raw CV object detections (audit/debug + optional console display)
  add column perceptual_hash text;               -- CV perceptual hash (audit/debug; dedup itself runs CV-side)

-- Reverse lookup: the CV API reports duplicate_of_report_id / /duplicates using
-- its own integer ids; check-duplicates resolves those back to our rows via this.
create unique index reports_external_report_id_key
  on public.reports (external_report_id)
  where external_report_id is not null;

comment on column public.reports.external_report_id is
  'Report id in the external CV API (DID Backend); null until/unless the CV call succeeds.';
comment on column public.reports.duplicate_status is
  'Latest duplicate verdict from the CV API. Advisory only — the officer still decides via reject-as-duplicate.';
