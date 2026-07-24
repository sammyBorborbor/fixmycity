-- Expand the report_category enum to match the external CV service's vocabulary.
-- Adds six categories (flooding, pothole, pollution, broken_public_facility,
-- sanitation, other) alongside the original three (dumping, drain, streetlight),
-- giving a 1:1 mapping onto the CV enum so the model's classifications persist and
-- citizens can report common issues beyond the original pilot three.
--
-- ALTER TYPE ... ADD VALUE is one-way (enum values can't be dropped) and is
-- backward-compatible: existing rows and code that only knows the original three
-- keep working. New values are added but not USED in this migration, so this is
-- safe to run even if the migration runner wraps it in a transaction.
alter type public.report_category add value if not exists 'flooding';
alter type public.report_category add value if not exists 'pothole';
alter type public.report_category add value if not exists 'pollution';
alter type public.report_category add value if not exists 'broken_public_facility';
alter type public.report_category add value if not exists 'sanitation';
alter type public.report_category add value if not exists 'other';
