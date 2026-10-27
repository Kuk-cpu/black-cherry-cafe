import { useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Coffee, LayoutDashboard, LogOut, Settings, UtensilsCrossed, QrCode } from 'lucide-react';
import { auth, errorMessage } from '../lib';
import { useStaff } from '../hooks';
import { ErrorNotice } from '../components/Modal';
import type { StaffUser } from '../../shared/model';
export function useProfile() {
  return useOutletContext<StaffUser>();
}
export default function Staff() {
  const { user, profile, loading } = useStaff();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState('');
  if (loading)
    return (
      <main className="login-page">
        <p>Checking your staff session…</p>
      </main>
    );
  if (!profile)
    return (
      <main className="login-page">
        <a href="/order" className="wordmark">
          black cherry <small>CAFÉ</small>
        </a>
        <div className="panel">
          <p className="eyebrow">BEHIND THE COUNTER</p>
          <h1>Hello, team.</h1>
          <p className="muted">A good day starts with a good workflow.</p>
          <ErrorNotice message={error} />
          {message && <p role="status">{message}</p>}
          {user ? (
            <>
              <p>
                Your account does not have active staff access. Ask the administrator to enable your
                profile.
              </p>
              <button onClick={() => void signOut(auth)}>Sign out</button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const data = new FormData(e.currentTarget);
                  await signInWithEmailAndPassword(auth, email, String(data.get('password')));
                } catch {
                  setError('Could not sign in. Check your email and password.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input name="password" type="password" required autoComplete="current-password" />
              </label>
              <button className="primary full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={async () => {
                  try {
                    await sendPasswordResetEmail(auth, email);
                    setMessage('If an account exists, a reset email has been sent.');
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Reset password
              </button>
            </form>
          )}
        </div>
      </main>
    );
  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <a href="/order" className="wordmark">
          black cherry<small>TEAM SPACE</small>
        </a>
        <nav>
          <NavLink to="/staff" end>
            <Coffee size={18} /> Live orders
          </NavLink>
          <NavLink to="/staff/menu">
            <UtensilsCrossed size={18} /> Menu & availability
          </NavLink>
          {profile.role === 'admin' && (
            <>
              <NavLink to="/staff/analytics">
                <LayoutDashboard size={18} /> Insights
              </NavLink>
              <NavLink to="/staff/qr">
                <QrCode size={18} /> Table QR codes
              </NavLink>
              <NavLink to="/staff/settings">
                <Settings size={18} /> Store & team
              </NavLink>
            </>
          )}
        </nav>
        <div className="staff-profile">
          <strong>{profile.name}</strong>
          <small>{profile.role}</small>
          <button onClick={() => void signOut(auth)}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <main className="staff-main">
        <Outlet context={profile} />
      </main>
    </div>
  );
}
