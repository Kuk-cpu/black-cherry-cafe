import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
if (
  process.env.VERCEL &&
  (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
)
  throw new Error('Emulators must not be enabled on Vercel');
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID (see .env.example)');
if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    if (!projectId.startsWith('demo-'))
      throw new Error('Local emulator requires a demo- project ID');
    initializeApp({ projectId });
  } else {
    if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY)
      throw new Error('Missing server Firebase credentials');
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}
export const db = getFirestore();
export const adminAuth = getAuth();
