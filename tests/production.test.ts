import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { productionProblems } from '../scripts/check-production';
import { normalizeOrder, normalizeOrderStatus } from '../shared/order-status';
import { availabilityFields, productSchema, statuses } from '../shared/model';
import { products } from '../scripts/menu';
import { priceLine } from '../shared/domain';

describe('production configuration', () => {
  const privateKey = generateKeyPairSync('ed25519')
    .privateKey.export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const env = {
    VITE_FIREBASE_API_KEY: 'web-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'cafe.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'cafe',
    VITE_FIREBASE_APP_ID: 'web-app',
    FIREBASE_PROJECT_ID: 'cafe',
    FIREBASE_CLIENT_EMAIL: 'admin@cafe.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: privateKey,
    RATE_LIMIT_SECRET: 'a'.repeat(32),
    APP_ORIGIN: 'https://orders.blackcherry.cafe',
  };
  it('accepts complete cloud configuration and escaped key newlines', () => {
    expect(productionProblems(env)).toEqual([]);
    expect(
      productionProblems({ ...env, FIREBASE_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') }),
    ).toEqual([]);
  });
  it('rejects emulator connections, mismatched projects and invalid secrets', () => {
    expect(productionProblems({ ...env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).not.toEqual(
      [],
    );
    expect(productionProblems({ ...env, VITE_FIREBASE_PROJECT_ID: 'another' })).not.toEqual([]);
    expect(
      productionProblems({ ...env, FIREBASE_PRIVATE_KEY: 'invalid', RATE_LIMIT_SECRET: 'short' }),
    ).toHaveLength(2);
    expect(productionProblems({})).not.toEqual([]);
  });
  it('rejects insecure, local and non-origin deployment URLs', () => {
    for (const APP_ORIGIN of [
      'http://orders.blackcherry.cafe',
      'https://localhost',
      'https://127.0.0.1',
      'https://orders.blackcherry.cafe/path',
    ])
      expect(productionProblems({ ...env, APP_ORIGIN })).not.toEqual([]);
  });
});
describe('live menu and order migration', () => {
  it('preserves order identity and timestamps while translating old state history', () => {
    const order = {
      id: 'abc',
      orderNumber: 'BC-1042',
      total: 650,
      orderStatus: 'Accepted',
      timeline: [
        { status: 'New', at: 100 },
        { status: 'Accepted', at: 200 },
      ],
    };
    expect(normalizeOrder(order)).toEqual({
      ...order,
      orderStatus: 'Confirmed',
      timeline: [
        { status: 'Pending', at: 100 },
        { status: 'Confirmed', at: 200 },
      ],
    });
    expect(order.orderStatus).toBe('Accepted');
    for (const status of statuses) expect(normalizeOrderStatus(status)).toBe(status);
    expect(() => normalizeOrderStatus('invalid')).toThrow();
  });
  it('prices every menu item and its paid modifiers with integer cents', () => {
    for (const product of products) {
      const selections = Object.fromEntries(
        product.modifiers.map((g) => [g.id, g.required ? [g.options[0].id] : []]),
      );
      const line = { productId: product.id, quantity: 2, selections, instructions: '' };
      const defaultTotal =
        product.basePrice +
        product.modifiers.reduce((sum, g) => sum + (g.required ? g.options[0].price : 0), 0);
      expect(priceLine(line, product).lineTotal).toBe(defaultTotal * 2);
      for (const group of product.modifiers)
        for (const option of group.options) {
          const expected =
            defaultTotal - (group.required ? group.options[0].price : 0) + option.price;
          expect(
            priceLine({ ...line, selections: { ...selections, [group.id]: [option.id] } }, product)
              .unitPrice,
          ).toBe(expected);
        }
    }
  });
  it('keeps editable availability fields consistent and rejects unavailable ordering', () => {
    const product = products[0];
    for (const status of ['Available', 'Sold Out', 'Hidden'] as const)
      expect(productSchema.safeParse({ ...product, ...availabilityFields(status) }).success).toBe(
        true,
      );
    expect(productSchema.safeParse({ ...product, available: false }).success).toBe(false);
    for (const status of ['Sold Out', 'Hidden'] as const)
      expect(() =>
        priceLine(
          { productId: product.id, quantity: 1, selections: {}, instructions: '' },
          { ...product, ...availabilityFields(status) },
        ),
      ).toThrow();
  });
});
