import {
  orderInputSchema,
  type CartLine,
  type Category,
  type Order,
  type Product,
  type Settings,
  type Status,
} from './model.js';
export const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
export function isProductInWindow(p: Product, at = Date.now()) {
  return (
    (p.availableFrom == null || at >= p.availableFrom) &&
    (p.availableUntil == null || at < p.availableUntil)
  );
}
export function matchesMenuFilter(p: Product, filter: string, search: string, at = Date.now()) {
  if (!p.active || p.status === 'Hidden' || !isProductInWindow(p, at)) return false;
  const match =
    filter === 'all' ||
    filter === p.categoryId ||
    (filter === 'vegetarian' && p.dietaryTags?.includes('Vegetarian')) ||
    (filter === 'under-ten' && p.basePrice < 1000) ||
    (filter === 'popular' && (p.tags.includes('Popular') || p.tags.includes('Recommended')));
  return (
    !!match && `${p.name} ${p.description}`.toLowerCase().includes(search.trim().toLowerCase())
  );
}
export function priceLine(line: CartLine, p: Product, isDrink = true, at = Date.now()) {
  if (!p.active || !p.available || p.status !== 'Available' || !isProductInWindow(p, at))
    throw new Error(`${p.name} is unavailable`);
  if (!Number.isInteger(p.basePrice) || p.basePrice < 0) throw new Error('Invalid product price');
  if (Object.keys(line.selections).some((k) => !p.modifiers.some((g) => g.id === k)))
    throw new Error('Unknown modifier group');
  const options: { name: string; price: number }[] = [];
  for (const g of p.modifiers) {
    const selected = line.selections[g.id] ?? [];
    if (g.required && selected.length === 0) throw new Error(`Select ${g.name}`);
    if (!g.multiple && selected.length > 1) throw new Error(`Choose one ${g.name}`);
    if (new Set(selected).size !== selected.length) throw new Error('Duplicate option');
    for (const key of selected) {
      const opt = g.options.find((o) => o.id === key);
      if (!opt || !Number.isInteger(opt.price) || opt.price < 0)
        throw new Error('Invalid modifier');
      options.push({ name: `${g.name}: ${opt.name}`, price: opt.price });
    }
  }
  const unitPrice = p.basePrice + options.reduce((a, o) => a + o.price, 0);
  return {
    ...line,
    name: p.name,
    basePrice: p.basePrice,
    unitPrice,
    lineTotal: unitPrice * line.quantity,
    options,
    isNew: p.tags.includes('New'),
    isDrink,
  };
}
export function priceOrder(raw: unknown, products: Product[], categories: Category[]) {
  const input = orderInputSchema.parse(raw);
  const items = input.items.map((l) => {
    const p = products.find((x) => x.id === l.productId);
    if (!p) throw new Error('Product not found');
    const c = categories.find((x) => x.id === p.categoryId);
    if (!c?.active) throw new Error('Category is unavailable');
    return priceLine(l, p, c.kind === 'drink');
  });
  const total = items.reduce((a, l) => a + l.lineTotal, 0);
  if (total > 200000) throw new Error('Please place large catering orders at the counter');
  return { input, items, total };
}
const next: Record<Status, Status[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};
export const canTransition = (from: Status, to: Status) => next[from].includes(to);
export function sydneyParts(at: number) {
  const p = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (key: string) => p.find((x) => x.type === key)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    time: `${get('hour')}:${get('minute')}`,
    hour: Number(get('hour')),
  };
}
export function isOpen(settings: Settings, at = Date.now()) {
  const p = sydneyParts(at);
  const h = settings.hours.find((x) => x.day === p.day);
  return settings.acceptingOrders && !!h && !h.closed && p.time >= h.open && p.time < h.close;
}
export function businessRange(start: string, end: string) {
  // UTC bounds padded, then filter by Sydney date; handles DST without fixed offsets.
  return {
    from: Date.parse(`${start}T00:00:00Z`) - 14 * 3600000,
    to: Date.parse(`${end}T23:59:59Z`) + 1,
  };
}
export function analytics(orders: Order[]) {
  const valid = orders.filter((o) => o.orderStatus !== 'Cancelled');
  const total = valid.reduce((a, o) => a + o.total, 0);
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const duration = (
    end: 'readyAt' | 'completedAt' | 'submittedAt',
    start: 'preparingAt' | 'submittedAt' | 'sessionStartedAt',
  ) =>
    avg(
      valid
        .filter((o) => o[end] !== null && o[start] !== null)
        .map((o) => ((o[end] ?? 0) - (o[start] ?? 0)) / 60000),
    );
  const products = new Map<string, { name: string; quantity: number }>();
  let newRevenue = 0,
    drinkRevenue = 0;
  for (const o of valid)
    for (const i of o.items) {
      const p = products.get(i.productId) ?? { name: i.name, quantity: 0 };
      p.quantity += i.quantity;
      products.set(i.productId, p);
      if (i.isDrink) {
        drinkRevenue += i.lineTotal;
        if (i.isNew) newRevenue += i.lineTotal;
      }
    }
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: valid.filter((o) => sydneyParts(o.submittedAt).hour === hour).length,
    completed: valid.filter((o) => o.completedAt && sydneyParts(o.completedAt).hour === hour)
      .length,
  }));
  return {
    count: valid.length,
    total,
    average: valid.length ? total / valid.length : 0,
    dineIn: valid.filter((o) => o.orderType === 'Dine-in').length,
    takeaway: valid.filter((o) => o.orderType === 'Takeaway').length,
    qr: valid.filter((o) => o.source === 'qr').length,
    first: valid.filter((o) => o.isFirstVisit === true).length,
    students: valid.filter((o) => o.isUsydStudent === true).length,
    newRevenue,
    newShare: drinkRevenue ? newRevenue / drinkRevenue : 0,
    orderingMinutes: duration('submittedAt', 'sessionStartedAt'),
    preparingMinutes: duration('readyAt', 'preparingAt'),
    completionMinutes: duration('completedAt', 'submittedAt'),
    errorRate: orders.length ? orders.filter((o) => o.error || o.remade).length / orders.length : 0,
    remadeRate: orders.length ? orders.filter((o) => o.remade).length / orders.length : 0,
    refundRate: orders.length ? orders.filter((o) => o.refunded).length / orders.length : 0,
    top: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    hourly,
    peak: hourly.reduce((a, b) => (b.count > a.count ? b : a)),
    completed: valid.filter((o) => o.orderStatus === 'Completed').length,
  };
}
export function csv(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((v) => {
            let s = String(v ?? '');
            if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}

/** Scheduled hours per clock-hour bucket, including partial-hour opening and closing. */
export function scheduledHours(start: string, end: string, settings: Settings | null): number[] {
  const hours = Array<number>(24).fill(0);
  if (!settings) return hours;
  for (
    let d = Date.parse(start + 'T12:00:00Z');
    d <= Date.parse(end + 'T12:00:00Z');
    d += 86400000
  ) {
    const schedule = settings.hours.find((h) => h.day === new Date(d).getUTCDay());
    if (!schedule || schedule.closed) continue;
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    for (let hour = 0; hour < 24; hour++)
      hours[hour] +=
        Math.max(
          0,
          Math.min((hour + 1) * 60, minutes(schedule.close)) -
            Math.max(hour * 60, minutes(schedule.open)),
        ) / 60;
  }
  return hours;
}
