import { adminAuth, db } from '../server/firebase';
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    'Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in the environment. Do not commit them.',
  );
let user;
try {
  user = await adminAuth.getUserByEmail(email);
} catch {
  user = await adminAuth.createUser({
    email,
    password,
    displayName: process.env.ADMIN_NAME ?? 'Cafe administrator',
  });
}
await db
  .collection('users')
  .doc(user.uid)
  .set({
    uid: user.uid,
    email,
    name: process.env.ADMIN_NAME ?? 'Cafe administrator',
    role: 'admin',
    active: true,
    createdAt: Date.now(),
  });
console.log(`Administrator provisioned: ${user.uid}. Existing passwords are not changed.`);
process.exit(0);
