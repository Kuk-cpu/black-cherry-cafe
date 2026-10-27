import { describe, it, expect } from 'vitest';
import {
  analytics,
  canTransition,
  csv,
  isOpen,
  priceLine,
  priceOrder,
  sydneyParts,
  scheduledHours,
} from '../shared/domain';
import { orderInputSchema, productSchema, settingsSchema, type Order } from '../shared/model';
import { products, categories, settings } from '../scripts/menu';
const latte = products.find((p) => p.id === 'latte')!;
const line = {
  productId: 'latte',
  quantity: 1,
  selections: { size: ['small'], temperature: ['hot'], milk: ['full-cream'], sugar: ['0'] },
  instructions: '',
};
export const validInput = () => ({
  items: [structuredClone(line)],
  orderType: 'Takeaway' as const,
  customerName: 'Jo',
  source: 'qr' as const,
  isFirstVisit: null,
  isUsydStudent: true,
  specialInstructions: '',
  sessionStartedAt: Date.now(),
  idempotencyKey: crypto.randomUUID(),
});
describe('server pricing and input validation', () => {
  it('prices a basic product in integer cents', () =>
    expect(priceLine(line, latte).lineTotal).toBe(500));
  it('adds oat milk and an extra shot', () =>
    expect(
      priceLine(
        { ...line, selections: { ...line.selections, milk: ['oat'], extras: ['shot'] } },
        latte,
      ).unitPrice,
    ).toBe(660));
  it('calculates quantities and multiple products', () => {
    const input = validInput();
    input.items = [
      { ...line, quantity: 2 },
      { ...line, quantity: 3 },
    ];
    expect(priceOrder(input, products, categories).total).toBe(2500);
  });
  it('rejects a client supplied total', () =>
    expect(() => priceOrder({ ...validInput(), total: 1 }, products, categories)).toThrow());
  it('rejects a client supplied line price', () =>
    expect(() =>
      orderInputSchema.parse({ ...validInput(), items: [{ ...line, unitPrice: -1 }] }),
    ).toThrow());
  it.each([0, -1, 1.1, 21])('rejects quantity %s', (quantity) =>
    expect(() =>
      priceOrder({ ...validInput(), items: [{ ...line, quantity }] }, products, categories),
    ).toThrow(),
  );
  it('requires milk when configured', () =>
    expect(() =>
      priceLine({ ...line, selections: { ...line.selections, milk: [] } }, latte),
    ).toThrow('Select Milk'));
  it('rejects unknown options', () =>
    expect(() =>
      priceLine({ ...line, selections: { ...line.selections, milk: ['free'] } }, latte),
    ).toThrow('Invalid modifier'));
  it('rejects unknown groups', () =>
    expect(() =>
      priceLine({ ...line, selections: { ...line.selections, discount: ['free'] } }, latte),
    ).toThrow('Unknown modifier'));
  it('rejects duplicate extras', () =>
    expect(() =>
      priceLine({ ...line, selections: { ...line.selections, extras: ['shot', 'shot'] } }, latte),
    ).toThrow('Duplicate'));
  it('rejects multiple single-choice values', () =>
    expect(() =>
      priceLine({ ...line, selections: { ...line.selections, milk: ['oat', 'soy'] } }, latte),
    ).toThrow('Choose one'));
  it('rejects unavailable products', () =>
    expect(() => priceLine(line, { ...latte, status: 'Sold Out' })).toThrow('unavailable'));
  it('rejects inactive categories', () =>
    expect(() =>
      priceOrder(
        validInput(),
        products,
        categories.map((c) => ({ ...c, active: false })),
      ),
    ).toThrow('Category'));
  it('allows food without drink options', () => {
    const p = products.find((p) => p.id === 'avocado-toast')!;
    expect(priceLine({ ...line, productId: p.id, selections: {} }, p, false).unitPrice).toBe(1450);
  });
  it.each([-1, 1.5])('rejects invalid stored price %s', (basePrice) =>
    expect(() => productSchema.parse({ ...latte, basePrice })).toThrow(),
  );
  it('rejects duplicate modifier IDs', () =>
    expect(() =>
      productSchema.parse({ ...latte, modifiers: [latte.modifiers[0], latte.modifiers[0]] }),
    ).toThrow());
  it('rejects markup in customer text', () =>
    expect(() =>
      orderInputSchema.parse({ ...validInput(), customerName: '<script>alert(1)</script>' }),
    ).toThrow());
  it('requires a table for dine-in', () =>
    expect(() => orderInputSchema.parse({ ...validInput(), orderType: 'Dine-in' })).toThrow());
});
describe('order state machine', () => {
  it('supports each forward transition', () => {
    expect(canTransition('Pending', 'Confirmed')).toBe(true);
    expect(canTransition('Confirmed', 'Preparing')).toBe(true);
    expect(canTransition('Preparing', 'Ready')).toBe(true);
    expect(canTransition('Ready', 'Completed')).toBe(true);
  });
  it('rejects skips, reversal, and reopening terminal orders', () => {
    expect(canTransition('Pending', 'Completed')).toBe(false);
    expect(canTransition('Preparing', 'Confirmed')).toBe(false);
    expect(canTransition('Completed', 'Pending')).toBe(false);
    expect(canTransition('Cancelled', 'Confirmed')).toBe(false);
  });
  it('allows cancellation before completion', () =>
    expect(canTransition('Ready', 'Cancelled')).toBe(true));
});
describe('Sydney opening hours', () => {
  it('is open at the opening boundary', () =>
    expect(isOpen(settings, Date.parse('2026-10-25T20:00:00Z'))).toBe(true));
  it('is closed at closing boundary', () =>
    expect(isOpen(settings, Date.parse('2026-10-26T05:00:00Z'))).toBe(false));
  it('handles winter UTC offset', () =>
    expect(sydneyParts(Date.parse('2026-07-06T21:00:00Z')).time).toBe('07:00'));
  it('handles summer UTC offset', () =>
    expect(sydneyParts(Date.parse('2026-10-25T20:00:00Z')).time).toBe('07:00'));
  it('honours manual pause and closed days', () => {
    expect(
      isOpen({ ...settings, acceptingOrders: false }, Date.parse('2026-10-25T20:00:00Z')),
    ).toBe(false);
    expect(
      isOpen(
        { ...settings, hours: settings.hours.map((h) => ({ ...h, closed: true })) },
        Date.now(),
      ),
    ).toBe(false);
  });
  it('rejects duplicate days and overnight hours', () => {
    expect(() =>
      settingsSchema.parse({ ...settings, hours: Array(7).fill(settings.hours[0]) }),
    ).toThrow();
    expect(() =>
      settingsSchema.parse({
        ...settings,
        hours: settings.hours.map((h) => ({ ...h, open: '20:00', close: '06:00' })),
      }),
    ).toThrow();
  });
});
describe('analytics and export', () => {
  it('neutralises spreadsheet formulas and quotes', () => {
    expect(csv([['=HYPERLINK("x")', 'Hello, café']])).toContain('"\'=HYPERLINK(""x"")"');
  });
  it('handles empty datasets', () => {
    const a = analytics([]);
    expect(a.average).toBe(0);
    expect(a.errorRate).toBe(0);
  });
  it('excludes cancellations from sales and counts remakes as errors', () => {
    const lineNew = { ...priceLine(line, latte), isNew: true, isDrink: true };
    const base = {
      orderStatus: 'Completed',
      total: 500,
      items: [lineNew],
      orderType: 'Takeaway',
      source: 'qr',
      isFirstVisit: null,
      isUsydStudent: true,
      sessionStartedAt: 1000,
      submittedAt: 61000,
      preparingAt: 121000,
      readyAt: 241000,
      completedAt: 301000,
      remade: true,
      refunded: false,
      error: false,
    } as Order;
    const a = analytics([base, { ...base, orderStatus: 'Cancelled', remade: false }]);
    expect(a.total).toBe(500);
    expect(a.newShare).toBe(1);
    expect(a.preparingMinutes).toBe(2);
    expect(a.completionMinutes).toBe(4);
    expect(a.errorRate).toBe(0.5);
  });
});

it('accounts for partial-hour peak capacity denominators', () => {
  const hours = scheduledHours('2026-10-26', '2026-10-26', {
    ...settings,
    hours: settings.hours.map((h) => ({ ...h, open: '07:30', close: '09:15' })),
  });
  expect(hours[7]).toBe(0.5);
  expect(hours[8]).toBe(1);
  expect(hours[9]).toBe(0.25);
  expect(hours.reduce((a, b) => a + b, 0)).toBe(1.75);
});
