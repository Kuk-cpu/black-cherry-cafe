import { useState } from 'react';
import type { Order, Status } from '../../shared/model';
import { money } from '../../shared/domain';
import { api, errorMessage, time } from '../lib';
import { ErrorNotice } from './Modal';
export default function OrderCard({ order: o, now }: { order: Order; now: number }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const age = Math.floor((now - o.submittedAt) / 60000);
  const active = !['Completed', 'Cancelled'].includes(o.orderStatus);
  const next: Partial<Record<Status, Status>> = {
    Pending: 'Confirmed',
    Confirmed: 'Preparing',
    Preparing: 'Ready',
    Ready: 'Completed',
  };
  async function update(data: object) {
    setBusy(true);
    setError('');
    try {
      await api('update', { id: o.id, expectedStatus: o.orderStatus, ...data });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className={`order-card ${active && age > 15 ? 'late' : active && age > 10 ? 'warning' : ''}`}
      data-testid={`order-${o.orderNumber}`}
    >
      <div className="order-card-head">
        <h3>{o.orderNumber}</h3>
        <span>{active ? `${age} min` : time(o.submittedAt)}</span>
      </div>
      <p className="order-location">
        {o.orderType === 'Dine-in' ? `Table ${o.tableNumber}` : `Takeaway · ${o.customerName}`}
        <small>{time(o.submittedAt)}</small>
      </p>
      <ul>
        {o.items.map((i, n) => (
          <li key={n}>
            <strong>
              {i.quantity} × {i.name}
            </strong>
            <p>{i.options.map((x) => x.name).join(' · ')}</p>
            {i.instructions && <p className="instruction">{i.instructions}</p>}
          </li>
        ))}
      </ul>
      {o.specialInstructions && <p className="instruction">Note: {o.specialInstructions}</p>}
      <div className="order-card-head">
        <strong>{money(o.total)}</strong>
        <span className={o.paymentStatus === 'Paid' ? 'paid' : 'unpaid'}>{o.paymentStatus}</span>
      </div>
      <ErrorNotice message={error} />
      <div className="order-controls">
        <button
          disabled={busy}
          onClick={() =>
            void update({ paymentStatus: o.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid' })
          }
        >
          {o.paymentStatus === 'Paid' ? 'Undo paid' : 'Mark paid'}
        </button>
        {active && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (
                next[o.orderStatus] === 'Completed' &&
                !confirm(
                  `Complete ${o.orderNumber}? Confirm the order has been collected and paid.`,
                )
              )
                return;
              void update({ orderStatus: next[o.orderStatus] });
            }}
          >
            {next[o.orderStatus]}
          </button>
        )}
      </div>
      <details>
        <summary>Issue / correction</summary>
        <div className="issue-controls">
          {(['error', 'remade', 'refunded'] as const).map((k) => (
            <label key={k}>
              <input
                disabled={busy}
                type="checkbox"
                checked={o[k]}
                onChange={(e) => void update({ [k]: e.target.checked })}
              />
              {k === 'error' ? 'Wrong order' : k === 'remade' ? 'Remade' : 'Refunded (record only)'}
            </label>
          ))}
          {active && (
            <button
              disabled={busy}
              className="danger"
              onClick={() => {
                if (confirm(`Cancel ${o.orderNumber}?`)) void update({ orderStatus: 'Cancelled' });
              }}
            >
              Cancel order
            </button>
          )}
        </div>
      </details>
    </article>
  );
}
