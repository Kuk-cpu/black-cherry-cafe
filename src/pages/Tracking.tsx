import { normalizeOrder } from '../../shared/order-status';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Check, Clock, Coffee } from 'lucide-react';
import type { PublicOrder } from '../../shared/model';
import { money } from '../../shared/domain';
import { api, db, errorMessage, time } from '../lib';
import { ErrorNotice } from '../components/Modal';
export default function Tracking() {
  const { token = '' } = useParams();
  const [order, setOrder] = useState<PublicOrder | null>(null),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(false),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError('Invalid tracking link.');
      return;
    }
    return onSnapshot(
      doc(db, 'publicOrders', token),
      { includeMetadataChanges: true },
      (s) => {
        setOffline(s.metadata.fromCache);
        if (!s.exists()) {
          setError('Order not found. Check your tracking link.');
          return;
        }
        setOrder(normalizeOrder(s.data() as PublicOrder));
        setError('');
      },
      (e) => setError(errorMessage(e)),
    );
  }, [token]);
  return (
    <main className="tracking-page">
      <Link className="wordmark" to="/order">
        black cherry <small>CAFÉ</small>
      </Link>
      <ErrorNotice message={error} />
      {order ? (
        <>
          <div className="tracking-hero">
            <span className="round-icon">
              <Coffee size={32} />
            </span>
            <p className="eyebrow">A GOOD CUP IS ON ITS WAY</p>
            <h1>
              {order.orderStatus === 'Completed'
                ? 'Thanks for stopping by.'
                : order.orderStatus === 'Cancelled'
                  ? 'Order cancelled.'
                  : 'You’re in good hands.'}
            </h1>
            <p className="order-number">{order.orderNumber}</p>
            <p>
              {order.orderType} · Ordered at {time(order.submittedAt)}
            </p>
            <div className="hero-pill">
              <Clock size={16} />
              {order.waitMinutes} min estimated wait
            </div>
          </div>
          <section className="panel">
            <div className="section-head">
              <h2>Order progress</h2>
              <span className="status-badge" data-testid="tracking-status">
                {order.orderStatus}
              </span>
            </div>
            {offline && (
              <p role="status" className="notice">
                Reconnecting… showing the last saved update.
              </p>
            )}
            <ol className="timeline">
              {order.timeline.map((s, i) => (
                <li key={s.status}>
                  <span>
                    <Check size={15} />
                  </span>
                  <div>
                    <strong>{s.status}</strong>
                    <small>{time(s.at)}</small>
                  </div>
                  {i === order.timeline.length - 1 && <b>Latest</b>}
                </li>
              ))}
            </ol>
            <div className="payment-note">
              <strong>
                {order.paymentStatus === 'Paid' ? 'Payment recorded' : 'Pay at Counter'}
              </strong>
              <p>
                {order.paymentStatus === 'Paid'
                  ? 'Thank you.'
                  : 'Please visit our team at the counter to pay.'}
              </p>
            </div>
          </section>
          <section className="panel">
            <h2>Your order</h2>
            {order.items.map((i, n) => (
              <div className="cart-line" key={n}>
                <div>
                  <h3>
                    {i.quantity} × {i.name}
                  </h3>
                  <p>{i.options.map((o) => o.name).join(' · ')}</p>
                  {i.instructions && <p>{i.instructions}</p>}
                </div>
                <strong>{money(i.lineTotal)}</strong>
              </div>
            ))}
            <div className="total-row">
              <span>Total</span>
              <strong>{money(order.total)}</strong>
            </div>
          </section>
          {order.orderStatus === 'Completed' && (
            <section className="panel">
              <h2>How was your little pause?</h2>
              {sent ? (
                <p role="status">Thanks — your feedback means a lot.</p>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    setBusy(true);
                    try {
                      await api('feedback', {
                        publicToken: token,
                        rating: Number(form.get('rating')),
                        tasteRating: Number(form.get('tasteRating')),
                        valueRating: Number(form.get('valueRating')),
                        comment: String(form.get('comment')),
                        newProductInterest: String(form.get('interest')),
                      });
                      setSent(true);
                      setError('');
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="form-grid">
                    {[
                      ['rating', 'Overall'],
                      ['tasteRating', 'Taste'],
                      ['valueRating', 'Value'],
                    ].map(([name, label]) => (
                      <label key={name}>
                        {label}
                        <select name={name} defaultValue="5">
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option value={n} key={n}>
                              {n} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <label>
                    Your thoughts
                    <textarea name="comment" maxLength={1000} />
                  </label>
                  <label>
                    What would you like to try next?
                    <input name="interest" maxLength={200} />
                  </label>
                  <button className="primary" disabled={busy}>
                    {busy ? 'Sending…' : 'Send feedback'}
                  </button>
                </form>
              )}
            </section>
          )}
          <p className="small muted">Keep this link private — it gives access to this order.</p>
          <Link className="text-button" to="/order">
            Back to the menu ↗
          </Link>
        </>
      ) : (
        !error && <p role="status">Finding your order…</p>
      )}
    </main>
  );
}
