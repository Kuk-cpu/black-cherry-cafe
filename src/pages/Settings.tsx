import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Settings as StoreSettings, StaffUser } from '../../shared/model';
import { useCollection } from '../hooks';
import { api, db, errorMessage } from '../lib';
import { useProfile } from './Staff';
import { ErrorNotice } from '../components/Modal';
export default function Settings() {
  const profile = useProfile();
  const [settings, setSettings] = useState<StoreSettings | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [uid, setUid] = useState(''),
    [name, setName] = useState(''),
    [role, setRole] = useState('staff');
  const { data: users, error: userError } = useCollection<StaffUser>('users');
  const { data: feedback } = useCollection<{
    id: string;
    rating: number;
    comment: string;
    newProductInterest: string;
  }>('feedback');
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'store'),
        (s) => setSettings(s.data() as StoreSettings),
        (e) => setError(errorMessage(e)),
      ),
    [],
  );
  if (profile.role !== 'admin') return <p>Administrator access required.</p>;
  async function save(entity: string, id: string, data: unknown) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await api('manage', { entity, action: 'save', id, data });
      setMessage('Changes saved.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h1>Store & team.</h1>
        </div>
      </div>
      <ErrorNotice message={error || userError} />
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {settings && (
        <section className="panel">
          <h2>The daily details</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save('settings', 'store', settings);
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={settings.acceptingOrders}
                onChange={(e) => setSettings({ ...settings, acceptingOrders: e.target.checked })}
              />{' '}
              Accept online orders during opening hours
            </label>
            <label>
              Homepage announcement
              <textarea
                maxLength={600}
                value={settings.announcement}
                onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
              />
            </label>
            <label>
              Estimated wait (minutes)
              <input
                type="number"
                min="1"
                max="120"
                value={settings.waitMinutes}
                onChange={(e) => setSettings({ ...settings, waitMinutes: Number(e.target.value) })}
              />
            </label>
            <h3>Opening hours · Australia/Sydney</h3>
            {settings.hours.map((h, i) => (
              <div className="hours-row" key={h.day}>
                <strong>
                  {
                    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
                      h.day
                    ]
                  }
                </strong>
                <label>
                  Open
                  <input
                    type="time"
                    required
                    disabled={h.closed}
                    value={h.open}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        hours: settings.hours.map((v, n) =>
                          n === i ? { ...v, open: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Close
                  <input
                    type="time"
                    required
                    disabled={h.closed}
                    value={h.close}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        hours: settings.hours.map((v, n) =>
                          n === i ? { ...v, close: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        hours: settings.hours.map((v, n) =>
                          n === i ? { ...v, closed: e.target.checked } : v,
                        ),
                      })
                    }
                  />{' '}
                  Closed
                </label>
              </div>
            ))}
            <p className="small muted">
              Same-day hours only. Daylight saving is handled in Sydney local time. Set the open
              switch off for an unexpected closure.
            </p>
            <button className="primary" disabled={busy}>
              Save store settings
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>Team access</h2>
        <p className="muted">
          Create the account in Firebase Authentication first, then paste its UID here. Existing
          access can be disabled immediately.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save('users', uid, { name, role, active: true });
          }}
          className="form-grid"
        >
          <label>
            Firebase UID
            <input required value={uid} onChange={(e) => setUid(e.target.value)} />
          </label>
          <label>
            Team member name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Enable / update member
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={busy}
                      onChange={(e) =>
                        void save('users', u.uid, {
                          name: u.name,
                          role: e.target.value,
                          active: u.active,
                        })
                      }
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void save('users', u.uid, { name: u.name, role: u.role, active: !u.active })
                      }
                    >
                      {u.active ? 'Disable access' : 'Enable access'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Guest feedback</h2>
        {feedback.length ? (
          feedback.map((f) => (
            <article className="feedback" key={f.id}>
              <strong>{f.rating} / 5</strong>
              <p>{f.comment || 'No comment'}</p>
              {f.newProductInterest && <small>Wants to try: {f.newProductInterest}</small>}
            </article>
          ))
        ) : (
          <p className="muted">Completed-order feedback will appear here.</p>
        )}
      </section>
    </>
  );
}
