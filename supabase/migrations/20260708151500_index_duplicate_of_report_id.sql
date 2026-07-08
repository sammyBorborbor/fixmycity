-- Advisor follow-up to 20260708140000_ai_duplicate_detection.sql: the new
-- status_transitions.duplicate_of_report_id FK had no covering index.
create index transitions_duplicate_of_report_idx
  on public.status_transitions (duplicate_of_report_id)
  where duplicate_of_report_id is not null;
