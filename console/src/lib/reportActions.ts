import type { StatusName, TransitionAction } from './store.tsx';

export interface AvailableActions {
  ack: boolean;      // acknowledge (Submitted | Reopened)
  assign: boolean;   // assign a crew (Submitted | Acknowledged | Reopened)
  progress: boolean; // mark in progress (Assigned)
  resolve: boolean;  // mark resolved (In Progress)
  reject: boolean;   // reject (any non-terminal state)
}

/* Which report actions a button should offer = valid for the report's current
   status AND permitted for the caller's role (permsFor().actions). Pure so the
   DetailPanel and tests share one definition of the state machine's UI surface. */
export function availableActions(status: StatusName, allowed: Set<TransitionAction>): AvailableActions {
  return {
    ack: (status === 'Submitted' || status === 'Reopened') && allowed.has('acknowledge'),
    assign: ['Acknowledged', 'Reopened', 'Submitted'].includes(status) && allowed.has('assign'),
    progress: status === 'Assigned' && allowed.has('in_progress'),
    resolve: status === 'In Progress' && allowed.has('resolve'),
    reject: !['Resolved', 'Rejected'].includes(status) && allowed.has('reject'),
  };
}
