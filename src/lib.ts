import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
const env = import.meta.env;
export const configured = !!env.VITE_FIREBASE_PROJECT_ID;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'missing-config',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'missing-config',
  appId: env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app),
  db = getFirestore(app);
export const emulator = env.VITE_USE_EMULATORS === 'true';
if (emulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
export async function api<T>(op: string, data: unknown): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const res = await fetch(`/api/service?op=${op}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error ?? 'Request failed');
  return value as T;
}
export function download(name: string, data: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const time = (at: number) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
export function errorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code?.startsWith('auth/'))
    return 'We couldn’t complete that request. Please check your details and try again.';
  if (code === 'permission-denied') return 'Please sign in again to continue.';
  if (code === 'unavailable' || error instanceof TypeError)
    return 'We couldn’t connect. Please check your connection and try again.';
  if (code) return 'We couldn’t load the latest update. Please try again shortly.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
