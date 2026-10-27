import { useEffect, useRef, useState } from 'react';
import { Volume2, Download } from 'lucide-react';
import type { Order, Status } from '../../shared/model';
import { businessRange, csv, sydneyParts } from '../../shared/domain';
import { useClock, useCollection, where, orderBy } from '../hooks';
import { download } from '../lib';
import OrderCard from '../components/OrderCard';
import { ErrorNotice } from '../components/Modal';
export function orderCSV(orders: Order[]) {
  return csv([
    [
      'Order',
      'Sydney date',
      'Type',
      'Table / name',
      'Status',
      'Payment',
      'Total AUD',
      'Source',
      'First visit',
      'USYD student',
      'Remade',
      'Refunded',
      'Wrong order',
      'Items',
      'Notes',
    ],
    ...orders.map((o) => [
      o.orderNumber,
      sydneyParts(o.submittedAt).date,
      o.orderType,
      o.tableNumber ?? o.customerName,
      o.orderStatus,
      o.paymentStatus,
      (o.total / 100).toFixed(2),
      o.source,
      o.isFirstVisit,
      o.isUsydStudent,
      o.remade,
      o.refunded,
      o.error,
      o.items
        .map((i) => `${i.quantity} x ${i.name} (${i.options.map((x) => x.name).join('; ')})`)
        .join(' | '),
      o.specialInstructions,
    ]),
  ]);
}
export default function Board() {
  const now = useClock();
  const [date, setDate] = useState(sydneyParts(now).date),
    [type, setType] = useState('All'),
    [status, setStatus] = useState('Live + completed'),
    [search, setSearch] = useState(''),
    [sound, setSound] = useState(false),
    [soundError, setSoundError] = useState('');
  const range = businessRange(date, date);
  const { data, error, loading, fromCache } = useCollection<Order>(
    'orders',
    [
      where('submittedAt', '>=', range.from),
      where('submittedAt', '<=', range.to),
      orderBy('submittedAt', 'desc'),
    ],
    date,
  );
  const orders = data.filter((o) => sydneyParts(o.submittedAt).date === date);
  const seen = useRef<Set<string> | null>(null),
    audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    seen.current = null;
  }, [date]);
  useEffect(() => {
    if (loading) return;
    const ids = new Set(data.map((o) => o.id));
    if (
      seen.current &&
      sound &&
      data.some((o) => o.orderStatus === 'Pending' && !seen.current!.has(o.id))
    ) {
      const ctx = audio.current;
      if (ctx) {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 740;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    }
    seen.current = ids;
  }, [data, sound, loading]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const filtered = orders.filter(
    (o) =>
      (type === 'All' || o.orderType === type) &&
      (status === 'All' ||
        (status === 'Live + completed'
          ? o.orderStatus !== 'Cancelled'
          : status === 'Active'
            ? !['Completed', 'Cancelled'].includes(o.orderStatus)
            : o.orderStatus === status)) &&
      `${o.orderNumber} ${o.customerName ?? ''} ${o.tableNumber ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const columns: Status[] =
    status === 'All'
      ? ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled']
      : status === 'Live + completed'
        ? ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed']
        : status === 'Active'
          ? ['Pending', 'Confirmed', 'Preparing', 'Ready']
          : [status as Status];
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">BEHIND EVERY GOOD COFFEE</p>
          <h1>On the counter.</h1>
          <p className="muted">
            Live orders · Sydney time ·{' '}
            {orders.filter((o) => !['Completed', 'Cancelled'].includes(o.orderStatus)).length} in
            progress
          </p>
        </div>
        <div className="toolbar">
          <button
            onClick={async () => {
              try {
                audio.current ??= new AudioContext();
                await audio.current.resume();
                setSound((v) => !v);
              } catch {
                setSoundError('Sound could not be enabled in this browser.');
              }
            }}
          >
            <Volume2 size={16} />
            {sound ? 'Sound on' : 'Enable sound'}
          </button>
          <button onClick={() => download(`orders-${date}.csv`, orderCSV(orders))}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>
      <ErrorNotice message={error || soundError} />
      {fromCache && !loading && (
        <p className="notice" role="status">
          Reconnecting to the order feed… showing cached orders. Check the connection before relying
          on this board.
        </p>
      )}
      <div className="filters">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          Service
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['All', 'Dine-in', 'Takeaway'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              'Live + completed',
              'Active',
              'All',
              'Pending',
              'Confirmed',
              'Preparing',
              'Ready',
              'Completed',
              'Cancelled',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Find an order
          <input
            placeholder="Number, name or table"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {loading ? (
        <p>Loading orders…</p>
      ) : (
        <div className="kanban">
          {columns.map((s) => (
            <section className="kanban-column" key={s}>
              <h2>
                <span className={`dot ${s.toLowerCase()}`} />
                {s}
                <b>{filtered.filter((o) => o.orderStatus === s).length}</b>
              </h2>
              {filtered
                .filter((o) => o.orderStatus === s)
                .sort((a, b) => a.submittedAt - b.submittedAt)
                .map((o) => (
                  <OrderCard key={o.id} order={o} now={now} />
                ))}
              {!filtered.some((o) => o.orderStatus === s) && (
                <div className="empty-column">A little breathing room.</div>
              )}
            </section>
          ))}
        </div>
      )}
      <p className="small muted">
        Keep this screen awake for live updates. Yellow: over 10 min · Red: over 15 min. Cancelled
        orders are available in the status filter.
      </p>
    </>
  );
}
