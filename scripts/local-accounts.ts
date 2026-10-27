import { db, adminAuth } from '../server/firebase.js';
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIREBASE_PROJECT_ID?.startsWith('demo-')
)
  throw new Error('This command requires local Auth and Firestore emulators.');
for (const [uid, email, role] of [
  ['demo-admin', 'admin@blackcherry.test', 'admin'],
  ['demo-staff', 'staff@blackcherry.test', 'staff'],
]) {
  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({ uid, email, password: 'CafeDemo123!' });
  }
  const ref = db.doc(`users/${uid}`);
  if (!(await ref.get()).exists)
    await ref.create({
      uid,
      email,
      name: role === 'admin' ? 'Alex · Manager' : 'Sam · Barista',
      role,
      active: true,
      createdAt: Date.now(),
    });
}
// Local integration tests need ordering open regardless of the test runner's clock.
const ref = db.doc('settings/store');
const settings = (await ref.get()).data();
if (settings)
  await ref.update({
    acceptingOrders: true,
    hours: settings.hours.map((h: object) => ({
      ...h,
      open: '00:00',
      close: '23:59',
      closed: false,
    })),
  });
console.log('Local staff accounts are ready.');
process.exit(0);
