import { db } from '../server/firebase.js';
import { categories, products, settings } from './menu.js';
import baseline from './migrations/menu-v1.json';
import { mergeMenuDefaults } from './migrations/merge-menu.js';
import { productSchema, type Product } from '../shared/model.js';
import { normalizeOrder } from '../shared/order-status.js';
const version = 'live-menu-v3';
const allowed = new Set([...Object.keys(productSchema.shape), 'createdAt', 'updatedAt']);
const migrationRef = db.doc('menuMigrations/live-menu-v3');
const migrated = (await migrationRef.get()).exists;
for (const c of categories) {
  const ref = db.doc(`categories/${c.id}`),
    existing = (await ref.get()).data();
  if (!existing) await ref.create(c);
  else if (!migrated) await ref.set({ ...existing, ...c });
}
for (const p of products) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`products/${p.id}`),
      snapshotRef = db.doc(`menuSeedSnapshots/${p.id}`);
    const [existing, snapshot] = await Promise.all([tx.get(ref), tx.get(snapshotRef)]);
    const current = existing.data();
    const previous = (snapshot.data()?.product ??
      baseline.products.find((old) => old.id === p.id)) as Product | undefined;
    const patch = mergeMenuDefaults(current as Product | undefined, p, previous);
    const merged = {
      ...current,
      ...patch,
      ...(!migrated
        ? {
            active: true,
            available: true,
            status: 'Available',
            availableFrom: null,
            availableUntil: null,
            imageUrl: p.imageUrl,
            imageDetailUrl: p.imageDetailUrl,
            imageAlt: p.imageAlt,
            imageSourceType: p.imageSourceType,
          }
        : {}),
      createdAt: current?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    // Replacing with schema fields removes retired metadata from existing documents.
    const clean = Object.fromEntries(Object.entries(merged).filter(([key]) => allowed.has(key)));
    const { createdAt, updatedAt, ...fields } = clean;
    tx.set(ref, { ...productSchema.parse(fields), createdAt, updatedAt });
    tx.set(snapshotRef, { version, product: p });
  });
}
const settingsRef = db.doc('settings/store');
if (!(await settingsRef.get()).exists) await settingsRef.create(settings);
// Preserve order numbers, amounts, timestamps and identity while migrating status labels atomically.
for (const collection of ['orders', 'publicOrders']) {
  for (const oldStatus of ['New', 'Accepted']) {
    let docs = await db
      .collection(collection)
      .where('orderStatus', '==', oldStatus)
      .limit(200)
      .get();
    while (!docs.empty) {
      for (const doc of docs.docs)
        await db.runTransaction(async (tx) => {
          const latest = await tx.get(doc.ref);
          if (!latest.exists) return;
          const order = latest.data()! as {
            orderStatus: string;
            timeline: { status: string; at: number }[];
            publicToken?: string;
          };
          const normalized = normalizeOrder(order);
          tx.update(doc.ref, {
            orderStatus: normalized.orderStatus,
            timeline: normalized.timeline,
          });
          if (collection === 'orders' && order.publicToken)
            tx.set(
              db.doc(`publicOrders/${order.publicToken}`),
              { orderStatus: normalized.orderStatus, timeline: normalized.timeline },
              { merge: true },
            );
        });
      docs = await db.collection(collection).where('orderStatus', '==', oldStatus).limit(200).get();
    }
  }
  // Completed and cancelled histories also retain their original times under the current vocabulary.
  const records = await db.collection(collection).get();
  for (const doc of records.docs) {
    const record = doc.data();
    if (record.timeline?.some((e: { status: string }) => ['New', 'Accepted'].includes(e.status)))
      await doc.ref.update({
        timeline: normalizeOrder(
          record as { orderStatus: string; timeline: { status: string; at: number }[] },
        ).timeline,
      });
  }
}
await db.doc('campaigns/student-example').delete();
await migrationRef.set({ version, completedAt: Date.now(), productCount: products.length });
console.log(
  `Black Cherry Café menu imported: ${products.length} products. Existing orders and administrator edits retained.`,
);
process.exit(0);
