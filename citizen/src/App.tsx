import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store.tsx';
import BottomNav from './components/BottomNav.tsx';

import Login from './screens/Login.tsx';
import Home from './screens/Home.tsx';
import ReportFlow from './screens/ReportFlow.tsx';
import MyReports from './screens/MyReports.tsx';
import ReportDetail from './screens/ReportDetail.tsx';
import Map from './screens/Map.tsx';
import Profile from './screens/Profile.tsx';
import Notifications from './screens/Notifications.tsx';

/* Auth guard — everything below /login requires a signed-in user. Waits for
   the session restore so a page reload doesn't bounce through /login. */
function RequireAuth({ children }: { children: ReactElement }) {
  const { user, authReady } = useStore();
  if (!authReady) return <div className="flex-1 bg-paper" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/* Authenticated shell: status bar + scrollable screen area + bottom nav.
   Screen area resets scroll to top on every route change. */
function AppShell() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [pathname]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-paper">
      {/* body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </div>

      {/* bottom tabs */}
      <BottomNav />
    </div>
  );
}

/* Bezel removed: the app fills the viewport, mobile-first, centered at
   max-width 420px on wider screens. */
export default function App() {
  return (
    <div className="mx-auto w-full max-w-[420px] h-[100dvh] flex flex-col overflow-hidden bg-paper shadow-xl">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportFlow />} />
          <Route path="/reports" element={<MyReports />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/map" element={<Map />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
