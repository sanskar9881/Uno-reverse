import { MotionConfig } from 'motion/react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { FlyingCards } from './components/game/FlyingCards';
import { Toaster } from './components/ui/Toaster';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomPage } from './pages/RoomPage';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
        <FlyingCards />
      </BrowserRouter>
    </MotionConfig>
  );
}
