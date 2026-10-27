import type { Product } from '../../shared/model.js';
// A three-way seed merge preserves admin edits while updating unchanged menu defaults.
export function mergeMenuDefaults(
  existing: Partial<Product> | undefined,
  next: Product,
  previous?: Partial<Product>,
): Partial<Product> {
  if (!existing) return next;
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    const current = (existing as Record<string, unknown>)[key];
    const before = (previous as Record<string, unknown> | undefined)?.[key];
    if (current === undefined || JSON.stringify(current) === JSON.stringify(before))
      patch[key] = value;
    // First migration replaces legacy generic artwork, including normalized placeholder paths.
    if (
      key.startsWith('image') &&
      (!existing.imageSourceType || existing.imageSourceType === 'placeholder')
    )
      patch[key] = value;
  }
  return patch as Partial<Product>;
}
