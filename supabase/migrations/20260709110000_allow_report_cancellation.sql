-- Allow a citizen to cancel (withdraw) their own report while it is still
-- Submitted (before an officer acknowledges it). Cancellation is a hard delete
-- of the report, which cascades to its status_transitions and notifications.
--
-- The append-only trigger on status_transitions previously blocked UPDATE *and*
-- DELETE, which made deleting a report impossible once its initial 'submitted'
-- transition existed (the cascade delete tripped the trigger). We relax it to
-- block only UPDATE: audit rows remain immutable in content, but may be removed
-- when their parent report is deleted. Direct client deletes stay impossible —
-- there is no DELETE RLS policy on status_transitions, and cancellation runs
-- through the service-role `cancel-report` edge function only.

drop trigger if exists transitions_append_only on public.status_transitions;

create trigger transitions_append_only
  before update on public.status_transitions
  for each row execute function private.block_transition_mutation();
