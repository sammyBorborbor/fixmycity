-- Pin search_path on the append-only guard trigger (security advisor 0011).
alter function private.block_transition_mutation() set search_path = '';
