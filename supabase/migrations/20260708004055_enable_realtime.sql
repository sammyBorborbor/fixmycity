-- Deliver row changes to subscribed clients. RLS still applies to realtime, so
-- citizens receive only their own notification inserts and staff receive all
-- report changes -- exactly matching the SELECT policies.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.reports;
