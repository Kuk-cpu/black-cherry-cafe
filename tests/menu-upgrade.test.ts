import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { products, categories } from '../scripts/menu';
import { imageManifest, productImage } from '../shared/images';
import { productSchema } from '../shared/model';
import { isProductInWindow, matchesMenuFilter, priceLine } from '../shared/domain';
import { mergeMenuDefaults } from '../scripts/migrations/merge-menu';
const latte = products.find((p) => p.id === 'latte')!;
const line = {
  productId: latte.id,
  quantity: 1,
  selections: { size: ['small'], temperature: ['hot'], milk: ['full-cream'], sugar: ['0'] },
  instructions: '',
};
describe('expanded editable menu', () => {
  it('contains 68 active menu products and correct category names', () => {
    expect(products).toHaveLength(68);
    expect(new Set(products.map((p) => p.id)).size).toBe(68);
    expect(
      products.every(
        (p) =>
          p.active &&
          p.available &&
          p.status === 'Available' &&
          p.availableUntil == null &&
          productSchema.safeParse(p).success,
      ),
    ).toBe(true);
    expect(categories.map((c) => c.name)).toEqual([
      'Coffee',
      'Non-Coffee',
      'Something New',
      'All-Day Kitchen',
    ]);
    expect(products.filter((p) => p.categoryId === 'food')).toHaveLength(22);
  });
  it('uses requested base and add-on prices in cents', () => {
    for (const [id, price] of Object.entries({
      espresso: 400,
      'flat-white': 500,
      'extra-shot': 80,
      'alternative-milk': 80,
      'almond-croissant': 750,
      'bacon-and-egg-roll': 1350,
      'big-breakfast': 2250,
      'strawberry-matcha-cloud': 850,
    }))
      expect(products.find((p) => p.id === id)?.basePrice).toBe(price);
    expect(latte.modifiers.find((g) => g.id === 'size')?.options.map((o) => o.name)).toEqual([
      'Small',
      'Large',
    ]);
    expect(
      priceLine(
        { ...line, selections: { ...line.selections, milk: ['oat'], extras: ['shot', 'decaf'] } },
        latte,
      ).unitPrice,
    ).toBe(660);
  });
  it('searches descriptions and combines dietary, price and popularity filters', () => {
    expect(matchesMenuFilter(latte, 'coffee', 'silky')).toBe(true);
    expect(matchesMenuFilter(latte, 'popular', '')).toBe(true);
    expect(matchesMenuFilter(latte, 'vegetarian', '')).toBe(true);
    expect(matchesMenuFilter({ ...latte, basePrice: 1000 }, 'under-ten', '')).toBe(false);
    expect(matchesMenuFilter({ ...latte, status: 'Hidden' }, 'all', '')).toBe(false);
    expect(matchesMenuFilter(latte, 'food', '')).toBe(false);
  });
  it('enforces exact availability boundaries for display and server pricing', () => {
    const p = { ...latte, availableFrom: 1000, availableUntil: 2000 };
    expect(isProductInWindow(p, 999)).toBe(false);
    expect(isProductInWindow(p, 1000)).toBe(true);
    expect(isProductInWindow(p, 1999)).toBe(true);
    expect(isProductInWindow(p, 2000)).toBe(false);
    expect(() => priceLine(line, p, true, 999)).toThrow('unavailable');
    expect(() => priceLine(line, p, true, 2000)).toThrow('unavailable');
    expect(priceLine(line, p, true, 1000).unitPrice).toBe(500);
    expect(productSchema.safeParse({ ...p, availableUntil: 999 }).success).toBe(false);
  });
  it('limits gluten-free options to suitable items and exposes independent food additions', () => {
    const croissant = products.find((p) => p.id === 'butter-croissant')!;
    const toast = products.find((p) => p.id === 'avocado-toast')!;
    expect(croissant.modifiers.some((g) => g.id === 'bread')).toBe(false);
    expect(
      toast.modifiers.find((g) => g.id === 'bread')?.options.some((o) => o.id === 'gluten-free'),
    ).toBe(true);
    expect(toast.modifiers.find((g) => g.id === 'additions')?.options.map((o) => o.name)).toEqual([
      'Add Egg',
      'Add Bacon',
      'Add Avocado',
    ]);
    expect(products.find((p) => p.id === 'almond-croissant')?.dietaryTags).toContain(
      'Contains Nuts',
    );
  });
});
describe('seed migration preservation', () => {
  it('updates unchanged defaults while retaining administrator edits', () => {
    const before = { ...latte, basePrice: 450 };
    const current = { ...before, name: 'My Latte', status: 'Sold Out' as const };
    const patch = mergeMenuDefaults(current, latte, before);
    expect(patch.basePrice).toBe(500);
    expect(patch).not.toHaveProperty('name');
    expect(patch).not.toHaveProperty('status');
    expect({ ...current, ...patch }).toMatchObject({
      name: 'My Latte',
      status: 'Sold Out',
      basePrice: 500,
    });
  });
  it('preserves custom prices and schedules on repeated seeding', () => {
    const current = { ...latte, basePrice: 650, availableUntil: 123456789 };
    const patch = mergeMenuDefaults(current, latte, latte);
    expect(patch).not.toHaveProperty('basePrice');
    expect(patch).not.toHaveProperty('availableUntil');
  });
});
describe('original illustration system', () => {
  it('maps every menu item to its own approved artwork with unique rendered pixels', () => {
    const images = products.map(productImage);
    expect(images.every((a) => a.imageSourceType === 'original-illustration')).toBe(true);
    expect(new Set(images.map((a) => a.card.sha256)).size).toBe(products.length);
    expect(new Set(images.map((a) => a.card.path)).size).toBe(products.length);
    expect(imageManifest.assets.filter((a) => a.imageSourceType === 'licensed-stock')).toHaveLength(
      0,
    );
  });
  it('ships transparent, correctly sized, lightweight WebP variants for every product', async () => {
    for (const p of products) {
      const a = productImage(p);
      for (const [v, width, budget] of [
        [a.card, 480, 150000],
        [a.detail, 960, 350000],
      ] as const) {
        const meta = await sharp('public' + v.path).metadata();
        expect(meta.hasAlpha).toBe(true);
        expect(meta.width).toBe(width);
        expect(meta.height).toBe((width * 3) / 4);
        expect(v.bytes).toBeLessThan(budget);
      }
    }
  });
});
