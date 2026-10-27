import { statuses, type Status } from './model.js';
export function normalizeOrderStatus(value: string): Status {
  if (value === 'New') return 'Pending';
  if (value === 'Accepted') return 'Confirmed';
  if ((statuses as readonly string[]).includes(value)) return value as Status;
  throw new Error('Unknown order status');
}
export function normalizeOrder<
  T extends { orderStatus: string; timeline: { status: string; at: number }[] },
>(order: T) {
  return {
    ...order,
    orderStatus: normalizeOrderStatus(order.orderStatus),
    timeline: order.timeline.map((event) => ({
      ...event,
      status: normalizeOrderStatus(event.status),
    })),
  };
}
