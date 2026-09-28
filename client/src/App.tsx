import { MotionConfig } from 'motion/react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { FlyingCards } from './components/game/FlyingCards';
import { Toaster } from './components/ui/Toaster';
import { BottlePage } from './pages/BottlePage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { HubPage } from './pages/HubPage';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomPage } from './pages/RoomPage';
import { WheelPage } from './pages/WheelPage';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/uno" element={<LandingPage />} />
          <Route path="/wheel" element={<WheelPage />} />
          <Route path="/bottle" element={<BottlePage />} />
          <Route path="/couples" element={<ComingSoonPage title="Couples Truth or Dare" />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
        <FlyingCards />
      </BrowserRouter>
    </MotionConfig>
  );
}
