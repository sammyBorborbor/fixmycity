import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store.tsx';
import NavRail from './components/NavRail.tsx';
import TopHeader from './components/TopHeader.tsx';
import DetailPanel from './components/DetailPanel.tsx';

import Login from './screens/Login.tsx';
import Inbox from './screens/Inbox.tsx';
import MapView from './screens/MapView.tsx';
import Assignments from './screens/Assignments.tsx';
import Crews from './screens/Crews.tsx';
import Analytics from './screens/Analytics.tsx';
import Users from './screens/Users.tsx';
import AuditLog from './screens/AuditLog.tsx';
import Profile from './screens/Profile.tsx';
import Settings from './screens/Settings.tsx';

/* Screens reached through AppShell's <Outlet> receive this context. */
export interface AppOutletContext {
  openRow: (id: string) => void;
  activeId: string | null;
}

/* Auth guard — everything below /login requires a signed-in staff user. Waits
   for the session restore so a reload doesn't bounce through /login. */
function RequireAuth({ children }: { children: ReactElement }) {
  const { user, authReady } = useStore();
  if (!authReady) return <div className="w-full h-[100dvh] bg-paper" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/* Shared authed shell: nav rail + top header + scrollable screen area, with
   the slide-in detail panel overlaid on top. `openRow` (opens the panel) and
   `activeId` (the open report) are handed to screens via the Outlet context.
   Navigating to another route closes the panel and resets scroll. */
function AppShell() {
  const { reports } = useStore();
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const openRow = useCallback((id: string) => setDetailId(id), []);
  const detail = reports.find(r => r.id === detailId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the panel + reset scroll on navigation
    setDetailId(null);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  return (
    <div className="flex w-full h-[100dvh] bg-paper text-ink">
      {/* nav rail */}
      <NavRail />

      {/* main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <Outlet context={{ openRow, activeId: detailId } satisfies AppOutletContext} />
        </main>
      </div>

      {/* slide-in detail panel */}
      {detail && <DetailPanel report={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/" element={<Inbox />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/crews" element={<Crews />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<Users />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
