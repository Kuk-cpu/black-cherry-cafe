import { z } from 'zod';
import { imageSourceTypes, localImagePath } from './media-policy.js';
export const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (s) => !/[<>]/.test(s) && ![...s].some((c) => c.charCodeAt(0) < 9),
      'Please use plain text without angle brackets',
    );
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const cents = z.number().int().min(0).max(100000);
export const optionSchema = z.object({ id, name: cleanText(80).min(1), price: cents }).strict();
export const modifierSchema = z
  .object({
    id,
    name: cleanText(80).min(1),
    required: z.boolean(),
    multiple: z.boolean(),
    options: z.array(optionSchema).min(1).max(20),
  })
  .strict()
  .refine(
    (g) => new Set(g.options.map((o) => o.id)).size === g.options.length,
    'Duplicate option IDs',
  );
export const productSchema = z
  .object({
    id,
    categoryId: id,
    name: cleanText(120).min(1),
    description: cleanText(600),
    imageUrl: z
      .string()
      .max(1000)
      .refine(
        (s) => localImagePath.safeParse(s).success || /^\/images\/[a-z-]+\.svg$/.test(s),
        'Use a registered local image; external hotlinks are not allowed',
      ),
    imageDetailUrl: localImagePath.optional(),
    imageAlt: cleanText(240).min(8).optional(),
    imageSourceType: z.enum(imageSourceTypes).optional(),
    basePrice: cents,
    modifiers: z.array(modifierSchema).max(12),
    allergens: z.array(cleanText(80)).max(20),
    tags: z
      .array(z.enum(['New', 'Limited', 'Popular', 'Recommended', 'Student deal', 'Seasonal']))
      .max(6),
    dietaryTags: z
      .array(z.enum(['Vegetarian', 'Contains Nuts']))
      .max(2)
      .optional(),
    active: z.boolean(),
    available: z.boolean(),
    availableFrom: z.number().int().nonnegative().nullable().optional(),
    availableUntil: z.number().int().positive().nullable().optional(),
    status: z.enum(['Available', 'Sold Out', 'Hidden']),
    displayOrder: z.number().int().min(0).max(9999),
  })
  .strict()
  .refine(
    (p) => new Set(p.modifiers.map((m) => m.id)).size === p.modifiers.length,
    'Duplicate modifier IDs',
  )
  .refine(
    (p) => p.active === (p.status !== 'Hidden') && p.available === (p.status === 'Available'),
    { message: 'Availability must match the product status', path: ['status'] },
  )
  .refine(
    (p) =>
      p.availableFrom == null || p.availableUntil == null || p.availableUntil > p.availableFrom,
    { message: 'End time must be after start time', path: ['availableUntil'] },
  );
export type Product = z.infer<typeof productSchema> & { createdAt?: number; updatedAt?: number };
export const categorySchema = z
  .object({
    id,
    name: cleanText(80).min(1),
    displayOrder: z.number().int().min(0).max(9999),
    active: z.boolean(),
    kind: z.enum(['drink', 'food']),
    seasonal: z.boolean().optional(),
  })
  .strict();
export type Category = z.infer<typeof categorySchema>;
export const settingsSchema = z
  .object({
    announcement: cleanText(600),
    waitMinutes: z.number().int().min(1).max(120),
    acceptingOrders: z.boolean(),
    hours: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            closed: z.boolean(),
          })
          .strict(),
      )
      .length(7),
  })
  .strict()
  .refine(
    (s) =>
      new Set(s.hours.map((h) => h.day)).size === 7 &&
      s.hours.every((h) => h.closed || h.open < h.close),
    'Use seven unique days and same-day opening hours',
  );
export type Settings = z.infer<typeof settingsSchema>;
export const lineSchema = z
  .object({
    productId: id,
    quantity: z.number().int().min(1).max(20),
    selections: z.record(id, z.array(id).max(20)),
    instructions: cleanText(300),
  })
  .strict();
export type CartLine = z.infer<typeof lineSchema>;
export const orderInputSchema = z
  .object({
    items: z.array(lineSchema).min(1).max(30),
    orderType: z.enum(['Dine-in', 'Takeaway']),
    tableNumber: z
      .string()
      .regex(/^\d{1,3}$/)
      .optional(),
    customerName: cleanText(40).optional(),
    source: z.enum(['qr', 'direct']),
    isFirstVisit: z.boolean().nullable(),
    isUsydStudent: z.boolean().nullable(),
    specialInstructions: cleanText(500),
    sessionStartedAt: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.orderType === 'Dine-in' && !v.tableNumber)
      c.addIssue({ code: 'custom', message: 'Enter a table number', path: ['tableNumber'] });
    if (v.orderType === 'Takeaway' && !v.customerName)
      c.addIssue({ code: 'custom', message: 'Enter a pickup name', path: ['customerName'] });
  });
export type OrderInput = z.infer<typeof orderInputSchema>;
export const statuses = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
] as const;
export type Status = (typeof statuses)[number];
export type PricedLine = CartLine & {
  name: string;
  unitPrice: number;
  lineTotal: number;
  basePrice: number;
  options: { name: string; price: number }[];
  isNew: boolean;
  isDrink: boolean;
};
export interface Order {
  id: string;
  orderNumber: string;
  publicToken: string;
  orderType: 'Dine-in' | 'Takeaway';
  tableNumber: string | null;
  customerName: string | null;
  source: 'qr' | 'direct';
  isFirstVisit: boolean | null;
  isUsydStudent: boolean | null;
  items: PricedLine[];
  subtotal: number;
  total: number;
  paymentMethod: 'Pay at Counter';
  paymentStatus: 'Unpaid' | 'Paid';
  orderStatus: Status;
  specialInstructions: string;
  sessionStartedAt: number;
  submittedAt: number;
  acceptedAt: number | null;
  preparingAt: number | null;
  readyAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  createdAt: number;
  remade: boolean;
  refunded: boolean;
  error: boolean;
  waitMinutes: number;
  timeline: { status: Status; at: number }[];
}
export type PublicOrder = Pick<
  Order,
  | 'orderNumber'
  | 'orderType'
  | 'items'
  | 'total'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'orderStatus'
  | 'submittedAt'
  | 'waitMinutes'
  | 'timeline'
>;
export interface StaffUser {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  active: boolean;
  createdAt: number;
}
export const feedbackSchema = z
  .object({
    publicToken: z.string().regex(/^[a-f0-9]{64}$/),
    rating: z.number().int().min(1).max(5),
    tasteRating: z.number().int().min(1).max(5),
    valueRating: z.number().int().min(1).max(5),
    comment: cleanText(1000),
    newProductInterest: cleanText(200),
  })
  .strict();

export function availabilityFields(status: Product['status']) {
  return { active: status !== 'Hidden', available: status === 'Available', status };
}
