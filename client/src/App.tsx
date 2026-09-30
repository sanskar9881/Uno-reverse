import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { FlyingCards } from './components/game/FlyingCards';
import { Toaster } from './components/ui/Toaster';
import { HubPage } from './pages/HubPage';

const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const WheelPage = lazy(() => import('./pages/WheelPage').then((m) => ({ default: m.WheelPage })));
const BottlePage = lazy(() => import('./pages/BottlePage').then((m) => ({ default: m.BottlePage })));
const CouplesPage = lazy(() => import('./pages/CouplesPage').then((m) => ({ default: m.CouplesPage })));
const IntimacyPage = lazy(() => import('./pages/IntimacyPage').then((m) => ({ default: m.IntimacyPage })));
const GroupPage = lazy(() => import('./pages/GroupPage').then((m) => ({ default: m.GroupPage })));
const RoomPage = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/uno" element={<LandingPage />} />
            <Route path="/wheel" element={<WheelPage />} />
            <Route path="/bottle" element={<BottlePage />} />
            <Route path="/couples" element={<CouplesPage />} />
            <Route path="/intimacy" element={<IntimacyPage />} />
            <Route path="/group" element={<GroupPage />} />
            <Route path="/room/:code" element={<RoomPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster />
        <FlyingCards />
      </BrowserRouter>
    </MotionConfig>
  );
}
