import { StrictMode, lazy, Suspense, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Menu from './pages/Menu';
import Tracking from './pages/Tracking';
import { configured } from './lib';
import './style.css';
const Staff = lazy(() => import('./pages/Staff')),
  Board = lazy(() => import('./pages/Board')),
  MenuAdmin = lazy(() => import('./pages/MenuAdmin')),
  Analytics = lazy(() => import('./pages/Analytics')),
  QR = lazy(() => import('./pages/QR')),
  Settings = lazy(() => import('./pages/Settings'));
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="login-page">
        <h1>Something went wrong.</h1>
        <p>Your cart is saved on this device. Please reload, or order at the counter.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      {configured ? (
        <BrowserRouter>
          <Suspense fallback={<p className="loading">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/order" replace />} />
              <Route path="/order" element={<Menu />} />
              <Route path="/track/:token" element={<Tracking />} />
              <Route path="/staff" element={<Staff />}>
                <Route index element={<Board />} />
                <Route path="menu" element={<MenuAdmin />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="qr" element={<QR />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route
                path="*"
                element={
                  <main className="login-page">
                    <h1>Page not found</h1>
                    <a href="/order">Back to the menu</a>
                  </main>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      ) : (
        <main className="login-page">
          <h1>We’ll be right with you.</h1>
          <p>Online ordering is temporarily unavailable. Please place your order at the counter.</p>
        </main>
      )}
    </Boundary>
  </StrictMode>,
);
