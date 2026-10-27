import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { db, adminAuth } from '../server/firebase';
import {
  authenticate,
  placeOrder,
  updateOrder,
  manage,
  feedback,
  rateLimit,
} from '../server/service';
import type { Order, StaffUser } from '../shared/model';
import { products } from '../scripts/menu';
import { imageFields, placeholder } from '../shared/images';
let env: RulesTestEnvironment;
let order: Order;
const staff: StaffUser = {
  uid: 'demo-staff',
  name: 'Sam',
  email: 'staff@blackcherry.test',
  role: 'staff',
  active: true,
  createdAt: 0,
};
const admin = { ...staff, uid: 'demo-admin', role: 'admin' as const };
const input = () => ({
  items: [
    {
      productId: 'latte',
      quantity: 1,
      selections: {
        size: ['small'],
        temperature: ['hot'],
        milk: ['oat'],
        sugar: ['0'],
        extras: ['shot'],
      },
      instructions: '',
    },
  ],
  orderType: 'Takeaway',
  customerName: 'Integration',
  source: 'qr',
  isFirstVisit: null,
  isUsydStudent: true,
  specialInstructions: '',
  sessionStartedAt: Date.now(),
  idempotencyKey: crypto.randomUUID(),
});
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Integration tests require emulator');
  env = await initializeTestEnvironment({
    projectId: 'demo-black-cherry',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
  const response = await placeOrder(input());
  order = (
    await db.collection('orders').where('publicToken', '==', response.publicToken).get()
  ).docs[0].data() as Order;
}, 30000);
afterAll(async () => {
  await env?.cleanup();
});
describe('Firestore boundary', () => {
  it('allows public visible menu queries', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(env.unauthenticatedContext().firestore(), 'products'),
          where('status', 'in', ['Available', 'Sold Out']),
        ),
      ),
    );
  });
  it('denies public order enumeration and private order gets', async () => {
    const client = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(client, 'orders')));
    await assertFails(getDoc(doc(client, 'orders', order.id)));
    await assertFails(getDocs(collection(client, 'publicOrders')));
  });
  it('allows only capability-based sanitized tracking', async () => {
    const snap = await assertSucceeds(
      getDoc(doc(env.unauthenticatedContext().firestore(), 'publicOrders', order.publicToken)),
    );
    expect(snap.data()?.orderNumber).toBe(order.orderNumber);
    expect(snap.data()).not.toHaveProperty('customerName');
    expect(snap.data()).not.toHaveProperty('isUsydStudent');
  });
  it('denies guest creation and role escalation', async () => {
    const client = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(client, 'orders', 'attack'), { total: 0 }));
    await assertFails(
      setDoc(doc(env.authenticatedContext('demo-staff').firestore(), 'users', 'demo-staff'), {
        role: 'admin',
      }),
    );
  });
  it('allows active staff reads but denies direct menu and order writes', async () => {
    const client = env.authenticatedContext('demo-staff').firestore();
    await assertSucceeds(getDoc(doc(client, 'orders', order.id)));
    await assertFails(setDoc(doc(client, 'products', 'latte'), { basePrice: 1 }));
    await assertFails(setDoc(doc(client, 'orders', order.id), { orderStatus: 'Completed' }));
  });
  it('denies disabled staff and arbitrary signed-in customers', async () => {
    await db.doc('users/disabled-test').set({ ...staff, uid: 'disabled-test', active: false });
    await assertFails(
      getDocs(collection(env.authenticatedContext('disabled-test').firestore(), 'orders')),
    );
    await assertFails(
      getDocs(collection(env.authenticatedContext('stranger').firestore(), 'orders')),
    );
  });
});
describe('server transactions', () => {
  it('uses server pricing', () => expect(order.total).toBe(660));
  it('rejects fake client totals', async () => {
    await expect(placeOrder({ ...input(), total: 1 })).rejects.toThrow();
  });
  it('deduplicates simultaneous submissions and rejects changed reuse', async () => {
    const body = input();
    const [a, b] = await Promise.all([placeOrder(body), placeOrder(body)]);
    expect(a).toEqual(b);
    const snap = await db.collection('orders').where('publicToken', '==', a.publicToken).get();
    expect(snap.size).toBe(1);
    await expect(placeOrder({ ...body, customerName: 'Changed' })).rejects.toThrow('already used');
  }, 30000); // Firestore intentionally retries one of the competing transactions.
  it('enforces opening hours', async () => {
    const ref = db.doc('settings/store');
    const old = (await ref.get()).data()!;
    await ref.update({ acceptingOrders: false });
    try {
      await expect(placeOrder(input())).rejects.toThrow('closed');
    } finally {
      await ref.set(old);
    }
  });
  it('rejects sold out items', async () => {
    const ref = db.doc('products/latte');
    await ref.update({ status: 'Sold Out' });
    try {
      await expect(placeOrder(input())).rejects.toThrow('unavailable');
    } finally {
      await ref.update({ status: 'Available' });
    }
  });
  it('requires staff authentication and admin for menu prices', async () => {
    await expect(authenticate(undefined)).rejects.toThrow('sign in');
    await expect(authenticate('Bearer forged')).rejects.toThrow('expired');
    await expect(
      manage({ entity: 'products', action: 'delete', id: 'latte' }, staff),
    ).rejects.toThrow('Administrator');
  });
  it('allows staff to pause products but forbids changing price through availability', async () => {
    await expect(
      manage(
        {
          entity: 'products',
          action: 'availability',
          id: 'latte',
          data: { status: 'Sold Out', basePrice: 1 },
        },
        staff,
      ),
    ).rejects.toThrow();
  });
  it('protects the last active admin', async () => {
    await expect(
      manage(
        {
          entity: 'users',
          action: 'save',
          id: 'demo-admin',
          data: { name: 'Alex', role: 'staff', active: true },
        },
        admin,
      ),
    ).rejects.toThrow('at least one');
  });
  it('normalizes unregistered product images and refuses external hotlinks at the API boundary', async () => {
    const id = 'image-test-' + crypto.randomUUID();
    const data = {
      ...products[0],
      id,
      status: 'Hidden',
      active: false,
      available: false,
      imageUrl: '/menu-images/real/unregistered-480.webp',
    };
    try {
      await manage({ entity: 'products', action: 'save', id, data }, admin);
      expect((await db.doc(`products/${id}`).get()).data()).toMatchObject(imageFields(placeholder));
      await expect(
        manage(
          {
            entity: 'products',
            action: 'save',
            id,
            data: { ...data, imageUrl: 'https://example.com/coffee.jpg' },
          },
          admin,
        ),
      ).rejects.toThrow();
    } finally {
      await db.doc(`products/${id}`).delete();
    }
  });
  it('requires payment, handles concurrent status edits, and updates the projection', async () => {
    await expect(
      updateOrder({ id: order.id, expectedStatus: 'Pending', orderStatus: 'Ready' }, staff),
    ).rejects.toThrow('transition');
    await updateOrder({ id: order.id, expectedStatus: 'Pending', orderStatus: 'Confirmed' }, staff);
    await expect(
      updateOrder({ id: order.id, expectedStatus: 'Pending', orderStatus: 'Confirmed' }, staff),
    ).rejects.toThrow('Another');
    await updateOrder(
      { id: order.id, expectedStatus: 'Confirmed', orderStatus: 'Preparing' },
      staff,
    );
    await updateOrder({ id: order.id, expectedStatus: 'Preparing', orderStatus: 'Ready' }, staff);
    await expect(
      updateOrder({ id: order.id, expectedStatus: 'Ready', orderStatus: 'Completed' }, staff),
    ).rejects.toThrow('payment');
    await updateOrder(
      { id: order.id, expectedStatus: 'Ready', paymentStatus: 'Paid', orderStatus: 'Completed' },
      staff,
    );
    expect((await db.doc(`publicOrders/${order.publicToken}`).get()).data()?.orderStatus).toBe(
      'Completed',
    );
  });
  it('accepts only one feedback per completed order', async () => {
    const data = {
      publicToken: order.publicToken,
      rating: 5,
      tasteRating: 5,
      valueRating: 4,
      comment: 'Lovely',
      newProductInterest: 'Tea',
    };
    await feedback(data);
    await expect(feedback(data)).rejects.toThrow('already submitted');
  });
  it('rate limits across calls using Firestore', async () => {
    const ip = crypto.randomUUID();
    await rateLimit(ip, 'test', 2);
    await rateLimit(ip, 'test', 2);
    await expect(rateLimit(ip, 'test', 2)).rejects.toThrow('Too many');
  });
  it('uses actual emulator Auth accounts', async () => {
    expect((await adminAuth.getUser('demo-staff')).email).toBe('staff@blackcherry.test');
  });
});
