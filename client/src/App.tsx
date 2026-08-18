import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';

export default function App() {
  const location = useLocation();

  // GoatCounter's own script only counts the page it loads on; since this is a
  // client-side-routed SPA, every route change (including the first one) needs
  // its own manual count. See the `no_onload` setting on the script tag in
  // index.html. The script tag is `async`, so on the very first render it may
  // not have finished loading yet — retry briefly instead of dropping the count.
  useEffect(() => {
    const path = location.pathname + location.search;
    let cancelled = false;
    const tryCount = () => {
      if (cancelled) return;
      if (window.goatcounter?.count) window.goatcounter.count({ path });
      else setTimeout(tryCount, 100);
    };
    tryCount();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game/:roomId" element={<GameRoom />} />
    </Routes>
  );
}
