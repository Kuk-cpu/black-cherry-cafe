import { normalizeOrder } from '../shared/order-status.js';
import { imageFields, productImage } from '../shared/images.js';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { db, adminAuth } from './firebase.js';
import {
  categorySchema,
  availabilityFields,
  cleanText,
  feedbackSchema,
  orderInputSchema,
  productSchema,
  settingsSchema,
  statuses,
  type Category,
  type Order,
  type Product,
  type PublicOrder,
  type Settings,
  type StaffUser,
} from '../shared/model.js';
import { canTransition, isOpen, priceOrder } from '../shared/domain.js';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const docId = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
function projection(o: Order): PublicOrder {
  return {
    orderNumber: o.orderNumber,
    orderType: o.orderType,
    items: o.items,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    submittedAt: o.submittedAt,
    waitMinutes: o.waitMinutes,
    timeline: o.timeline,
  };
}
export async function rateLimit(ip: string, kind: string, max: number) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) fail(503, 'Rate limiting is not configured');
  const bucket = Math.floor(Date.now() / 60000);
  const key = createHmac('sha256', secret!).update(`${kind}:${ip}:${bucket}`).digest('hex');
  const ref = db.collection('rateLimits').doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = Number(snap.data()?.count ?? 0);
    if (count >= max) fail(429, 'Too many requests. Please wait a minute.');
    tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis(Date.now() + 120000) });
  });
}
export async function authenticate(bearer: string | undefined) {
  if (!bearer?.startsWith('Bearer ')) return fail(401, 'Please sign in');
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(bearer.slice(7), true)).uid;
  } catch {
    return fail(401, 'Your session has expired');
  }
  const user = (await db.collection('users').doc(uid).get()).data() as StaffUser | undefined;
  if (!user?.active || !['staff', 'admin'].includes(user.role))
    return fail(403, 'Staff access is disabled');
  return user;
}
export async function placeOrder(raw: unknown) {
  const input = orderInputSchema.parse(raw);
  const payloadHash = hash(JSON.stringify(input));
  const now = Date.now();
  if (input.sessionStartedAt > now + 30000 || input.sessionStartedAt < now - 24 * 3600000)
    fail(400, 'Your menu session expired. Please reload the menu.');
  const keyRef = db.collection('idempotency').doc(hash(input.idempotencyKey));
  const ref = db.collection('orders').doc();
  const publicToken = randomBytes(32).toString('hex');
  return db.runTransaction(async (tx) => {
    const key = await tx.get(keyRef);
    if (key.exists) {
      if (key.data()?.payloadHash !== payloadHash)
        fail(409, 'This submission key was already used for another cart');
      return key.data()!.response as { publicToken: string; orderNumber: string };
    }
    const settingsSnap = await tx.get(db.doc('settings/store'));
    const settings = settingsSnap.data() as Settings | undefined;
    if (!settings || !isOpen(settings, now))
      fail(409, 'We are closed for online orders. Please speak to the counter.');
    const productIds = [...new Set(input.items.map((l) => l.productId))];
    const ps = await tx.getAll(...productIds.map((id) => db.collection('products').doc(id)));
    const products = ps.filter((p) => p.exists).map((p) => p.data() as Product);
    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const cs = categoryIds.length
      ? await tx.getAll(...categoryIds.map((id) => db.collection('categories').doc(id)))
      : [];
    let priced: ReturnType<typeof priceOrder>;
    try {
      priced = priceOrder(
        input,
        products,
        cs.map((c) => c.data() as Category),
      );
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : 'Invalid order');
    }
    const counterRef = db.doc('counters/orders');
    const counter = await tx.get(counterRef);
    const sequence = Number(counter.data()?.value ?? 1023) + 1;
    const orderNumber = `BC-${sequence}`;
    const order: Order = {
      id: ref.id,
      orderNumber,
      publicToken,
      orderType: input.orderType,
      tableNumber: input.orderType === 'Dine-in' ? input.tableNumber! : null,
      customerName: input.orderType === 'Takeaway' ? input.customerName! : null,
      source: input.source,
      isFirstVisit: input.isFirstVisit,
      isUsydStudent: input.isUsydStudent,
      items: priced.items,
      subtotal: priced.total,
      total: priced.total,
      paymentMethod: 'Pay at Counter',
      paymentStatus: 'Unpaid',
      orderStatus: 'Pending',
      specialInstructions: input.specialInstructions,
      sessionStartedAt: Math.min(input.sessionStartedAt, now),
      submittedAt: now,
      createdAt: now,
      acceptedAt: null,
      preparingAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: null,
      remade: false,
      refunded: false,
      error: false,
      waitMinutes: settings!.waitMinutes,
      timeline: [{ status: 'Pending', at: now }],
    };
    const response = { publicToken, orderNumber };
    tx.set(counterRef, { value: sequence });
    tx.create(ref, order);
    tx.create(db.collection('publicOrders').doc(publicToken), projection(order));
    tx.create(keyRef, {
      payloadHash,
      response,
      expiresAt: Timestamp.fromMillis(now + 48 * 3600000),
    });
    return response;
  });
}
const updateSchema = z
  .object({
    id: docId,
    expectedStatus: z.enum(statuses),
    orderStatus: z.enum(statuses).optional(),
    paymentStatus: z.enum(['Paid', 'Unpaid']).optional(),
    remade: z.boolean().optional(),
    refunded: z.boolean().optional(),
    error: z.boolean().optional(),
  })
  .strict();
export async function updateOrder(raw: unknown, user: StaffUser) {
  const input = updateSchema.parse(raw);
  const ref = db.collection('orders').doc(input.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return fail(404, 'Order not found');
    const o = normalizeOrder(snap.data() as Order);
    if (o.orderStatus !== input.expectedStatus)
      fail(409, 'Another team member updated this order. Please try again.');
    const updated = { ...o };
    for (const k of ['paymentStatus', 'remade', 'refunded', 'error'] as const) {
      if (input[k] !== undefined) Object.assign(updated, { [k]: input[k] });
    }
    if (input.orderStatus) {
      if (!canTransition(o.orderStatus, input.orderStatus))
        fail(409, 'This status transition is not allowed');
      if (input.orderStatus === 'Completed' && updated.paymentStatus !== 'Paid')
        fail(409, 'Please record counter payment before completing');
      updated.orderStatus = input.orderStatus;
      const field = {
        Confirmed: 'acceptedAt',
        Preparing: 'preparingAt',
        Ready: 'readyAt',
        Completed: 'completedAt',
        Cancelled: 'cancelledAt',
        Pending: 'submittedAt',
      }[input.orderStatus];
      Object.assign(updated, { [field]: Date.now() });
      updated.timeline = [...o.timeline, { status: input.orderStatus, at: Date.now() }];
    }
    if (updated.refunded && updated.paymentStatus !== 'Paid')
      fail(409, 'Only paid orders can be marked refunded');
    tx.set(ref, updated);
    tx.set(db.collection('publicOrders').doc(o.publicToken), projection(updated));
    tx.create(db.collection('audit').doc(), {
      uid: user.uid,
      action: 'order.update',
      orderId: o.id,
      changes: input,
      at: Date.now(),
    });
    return { ok: true };
  });
}
export async function feedback(raw: unknown) {
  const input = feedbackSchema.parse(raw);
  const result = await db
    .collection('orders')
    .where('publicToken', '==', input.publicToken)
    .limit(1)
    .get();
  if (result.empty) fail(404, 'Order not found');
  const orderRef = result.docs[0].ref;
  const ref = db.collection('feedback').doc(orderRef.id);
  return db.runTransaction(async (tx) => {
    const [order, snap] = await Promise.all([tx.get(orderRef), tx.get(ref)]);
    if (order.data()?.orderStatus !== 'Completed')
      fail(409, 'Feedback is available after completion');
    if (snap.exists) fail(409, 'Thank you — feedback was already submitted');
    const { publicToken: _token, ...data } = input;
    tx.create(ref, { ...data, id: ref.id, orderId: orderRef.id, createdAt: Date.now() });
    return { ok: true };
  });
}
export async function manage(raw: unknown, user: StaffUser) {
  const input = z
    .object({
      entity: z.enum(['products', 'categories', 'settings', 'users']),
      action: z.enum(['save', 'delete', 'availability']),
      id: docId,
      data: z.unknown().optional(),
    })
    .strict()
    .parse(raw);
  if (input.action === 'availability' && input.entity === 'products') {
    const data = z
      .object({ status: z.enum(['Available', 'Sold Out']) })
      .strict()
      .parse(input.data);
    const ref = db.collection('products').doc(input.id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.status === 'Hidden') fail(404, 'Product not available');
      tx.update(ref, { ...availabilityFields(data.status), updatedAt: Date.now() });
      tx.create(db.collection('audit').doc(), {
        uid: user.uid,
        action: 'availability',
        productId: input.id,
        at: Date.now(),
        ...data,
      });
    });
    return { ok: true };
  }
  if (user.role !== 'admin') fail(403, 'Administrator access required');
  const ref = db.collection(input.entity).doc(input.id);
  if (input.action === 'delete') {
    if (!['products', 'categories'].includes(input.entity)) fail(400, 'Deletion is not supported');
    await db.runTransaction(async (tx) => {
      if (input.entity === 'categories') {
        const children = await tx.get(
          db.collection('products').where('categoryId', '==', input.id).limit(1),
        );
        if (!children.empty) fail(409, 'Move or delete products in this category first');
      }
      tx.delete(ref);
      tx.create(db.collection('audit').doc(), {
        uid: user.uid,
        action: 'delete',
        entity: input.entity,
        id: input.id,
        at: Date.now(),
      });
    });
    return { ok: true };
  }
  if (input.entity === 'products') {
    const parsed = productSchema.parse(input.data);
    const image = productImage(parsed);
    if (parsed.active && image.imageSourceType === 'placeholder')
      fail(400, 'Choose a product illustration before making this item available.');
    const p = { ...parsed, ...imageFields(image) };
    if (p.id !== input.id) fail(400, 'Product ID mismatch');
    await db.runTransaction(async (tx) => {
      const [category, existing] = await Promise.all([
        tx.get(db.collection('categories').doc(p.categoryId)),
        tx.get(ref),
      ]);
      if (!category.exists) fail(400, 'Category not found');
      tx.set(ref, {
        ...p,
        createdAt: existing.data()?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });
    });
  }
  if (input.entity === 'categories') {
    const c = categorySchema.parse(input.data);
    if (c.id !== input.id) fail(400, 'Category ID mismatch');
    await ref.set(c);
  }
  if (input.entity === 'settings') {
    if (input.id !== 'store') fail(400, 'Invalid settings ID');
    await ref.set(settingsSchema.parse(input.data));
  }
  if (input.entity === 'users') {
    const data = z
      .object({ name: cleanText(80).min(1), role: z.enum(['staff', 'admin']), active: z.boolean() })
      .strict()
      .parse(input.data);
    const authUser = await adminAuth.getUser(input.id);
    await db.runTransaction(async (tx) => {
      const admins = await tx.get(db.collection('users').where('role', '==', 'admin'));
      const active = admins.docs.filter((d) => d.data().active);
      if (
        active.length === 1 &&
        active[0].id === input.id &&
        (!data.active || data.role !== 'admin')
      )
        fail(409, 'Keep at least one active administrator');
      const old = await tx.get(ref);
      tx.set(ref, {
        ...data,
        uid: input.id,
        email: authUser.email ?? '',
        createdAt: old.data()?.createdAt ?? Date.now(),
      });
    });
  }
  await db
    .collection('audit')
    .add({ uid: user.uid, action: 'save', entity: input.entity, id: input.id, at: Date.now() });
  return { ok: true };
}
