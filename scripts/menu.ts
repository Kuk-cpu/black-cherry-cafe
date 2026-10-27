import raw from '../src/data/menu.json';
import { productSchema, categorySchema, type Settings } from '../shared/model.js';
// Black Cherry Café menu, editable through the administration interface.
export const products = raw.products.map((p) => productSchema.parse(p));
export const categories = raw.categories.map((c) => categorySchema.parse(c));
export const settings: Settings = {
  announcement: 'A little pause, a really good coffee. Order here, then pay at the counter.',
  waitMinutes: 8,
  acceptingOrders: true,
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    open: day === 0 ? '08:00' : '07:00',
    close: day === 0 ? '14:00' : '16:00',
    closed: false,
  })),
};
