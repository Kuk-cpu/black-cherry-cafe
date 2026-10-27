import { useState } from 'react';
import type { Order } from '../../shared/model';
import {
  analytics,
  businessRange,
  csv,
  money,
  sydneyParts,
  scheduledHours,
} from '../../shared/domain';
import { useCollection, useMenu, where, orderBy } from '../hooks';
import { useProfile } from './Staff';
import { download } from '../lib';
import { orderCSV } from './Board';
import { ErrorNotice } from '../components/Modal';
export default function Analytics() {
  const profile = useProfile(),
    today = sydneyParts(Date.now()).date;
  const [start, setStart] = useState(today),
    [end, setEnd] = useState(today);
  const range = businessRange(start, end);
  const { data, error } = useCollection<Order>(
    'orders',
    [
      where('submittedAt', '>=', range.from),
      where('submittedAt', '<=', range.to),
      orderBy('submittedAt', 'desc'),
    ],
    `${start}-${end}`,
  );
  const { settings } = useMenu();
  if (profile.role !== 'admin') return <p>Administrator access required.</p>;
  const orders = data.filter((o) => {
    const d = sydneyParts(o.submittedAt).date;
    return d >= start && d <= end;
  });
  const a = analytics(orders),
    pct = (v: number) => `${(v * 100).toFixed(1)}%`,
    mins = (v: number) => `${v.toFixed(1)} min`;
  const hoursByClock = scheduledHours(start, end, settings);
  const hours = hoursByClock.reduce((a, b) => a + b, 0);
  const peakCapacity = hoursByClock[a.peak.hour] ? a.peak.completed / hoursByClock[a.peak.hour] : 0;
  const metrics: [string, string][] = [
    ['Valid orders', String(a.count)],
    ['Order value', money(a.total)],
    ['Average order value', money(a.average)],
    ['Dine-in / Takeaway', `${a.dineIn} / ${a.takeaway}`],
    ['QR source share', pct(a.count ? a.qr / a.count : 0)],
    ['First-time guests', String(a.first)],
    ['USYD students', String(a.students)],
    ['New drink sales', money(a.newRevenue)],
    ['New drink / all drink sales', pct(a.newShare)],
    ['Average ordering time', mins(a.orderingMinutes)],
    ['Average preparation time', mins(a.preparingMinutes)],
    ['Average completion time', mins(a.completionMinutes)],
    ['Wrong order rate', pct(a.errorRate)],
    ['Remade rate', pct(a.remadeRate)],
    ['Refund rate', pct(a.refundRate)],
    ['Peak-hour completions / open hour', peakCapacity.toFixed(2)],
    ['Completed / scheduled open hour', `${(hours ? a.completed / hours : 0).toFixed(2)}`],
  ];
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">SMALL DETAILS, BETTER DAYS</p>
          <h1>A look at your day.</h1>
        </div>
        <div className="toolbar">
          <button
            onClick={() =>
              download(
                `insights-${start}-${end}.csv`,
                csv([
                  ['Metric', 'Value'],
                  ...metrics,
                  [],
                  ['Top product', 'Quantity'],
                  ...a.top.map((p) => [p.name, p.quantity]),
                  [],
                  ['Sydney hour', 'Orders', 'Completions'],
                  ...a.hourly.map((h) => [h.hour, h.count, h.completed]),
                ]),
              )
            }
          >
            Export insights
          </button>
          <button onClick={() => download(`orders-${start}-${end}.csv`, orderCSV(orders))}>
            Export orders
          </button>
        </div>
      </div>
      <div className="filters">
        <label>
          From
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => e.target.value && setStart(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => e.target.value && setEnd(e.target.value)}
          />
        </label>
        <span>Sydney local dates · cancelled orders excluded from sales</span>
      </div>
      <ErrorNotice message={error} />
      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <p className="eyebrow">THE CROWD FAVOURITES</p>
          <h2>Top five products</h2>
          {a.top.length ? (
            a.top.map((p, i) => (
              <div className="top-product" key={p.name}>
                <span>0{i + 1}</span>
                <strong>{p.name}</strong>
                <b>{p.quantity}</b>
              </div>
            ))
          ) : (
            <p className="muted">Your favourites will appear here after the first order.</p>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow">THE RHYTHM OF YOUR DAY</p>
          <h2>Hourly order volume</h2>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Peak hour ${a.peak.hour}:00 with ${a.peak.count} orders`}
          >
            {a.hourly.map((h) => (
              <div
                key={h.hour}
                title={`${h.hour}:00 — ${h.count} submitted, ${h.completed} completed`}
              >
                <span
                  style={{
                    height: `${Math.max(2, (h.count / Math.max(1, a.peak.count)) * 140)}px`,
                  }}
                />
                <small>{h.hour % 3 === 0 ? h.hour : ''}</small>
              </div>
            ))}
          </div>
          <p>
            {a.count
              ? `Peak: ${a.peak.hour}:00 · ${a.peak.count} orders`
              : 'No orders in this date range.'}
          </p>
          <details>
            <summary>Hourly values</summary>
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Orders</th>
                  <th>Completions</th>
                </tr>
              </thead>
              <tbody>
                {a.hourly
                  .filter((h) => h.count || h.completed)
                  .map((h) => (
                    <tr key={h.hour}>
                      <td>{h.hour}:00</td>
                      <td>{h.count}</td>
                      <td>{h.completed}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </section>
      </div>
      <p className="small muted">
        Preparation averages use orders with both timestamps. Error/remade/refund rates use all
        submitted orders. Throughput uses current scheduled opening hours across the selected dates;
        historical hours are not stored. Survey skips are not counted as “No”.
      </p>
    </>
  );
}
