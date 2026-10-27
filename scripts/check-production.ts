import { loadEnv } from 'vite';
import { createPrivateKey } from 'node:crypto';
import path from 'node:path';
export function productionProblems(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  for (const key of [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'RATE_LIMIT_SECRET',
    'APP_ORIGIN',
  ])
    if (!env[key]?.trim()) errors.push(`Missing ${key}`);
  if (
    env.VITE_USE_EMULATORS === 'true' ||
    env.FIRESTORE_EMULATOR_HOST ||
    env.FIREBASE_AUTH_EMULATOR_HOST
  )
    errors.push('Production must connect to cloud Firebase');
  if (
    env.FIREBASE_PROJECT_ID?.startsWith('demo-') ||
    env.VITE_FIREBASE_PROJECT_ID?.startsWith('demo-')
  )
    errors.push('Use a cloud Firebase project ID');
  if (env.FIREBASE_PROJECT_ID !== env.VITE_FIREBASE_PROJECT_ID)
    errors.push('Client and server Firebase projects must match');
  if ((env.RATE_LIMIT_SECRET?.length ?? 0) < 32)
    errors.push('RATE_LIMIT_SECRET needs at least 32 characters');
  try {
    const url = new URL(env.APP_ORIGIN ?? '');
    if (
      url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      errors.push('APP_ORIGIN must be the HTTPS origin of the deployed site');
  } catch {
    errors.push('APP_ORIGIN must be a valid HTTPS origin');
  }
  if (
    env.FIREBASE_CLIENT_EMAIL &&
    !env.FIREBASE_CLIENT_EMAIL.endsWith(`@${env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`)
  )
    errors.push('Service account must belong to the configured Firebase project');
  if (env.FIREBASE_PRIVATE_KEY)
    try {
      createPrivateKey(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'));
    } catch {
      errors.push('FIREBASE_PRIVATE_KEY is not a valid private key');
    }
  return errors;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve('scripts/check-production.ts')
) {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  if (!process.argv.includes('--if-hosted') || env.VERCEL) {
    const errors = productionProblems(env);
    for (const error of errors) console.error(`Production configuration: ${error}`);
    if (errors.length) process.exitCode = 1;
    else console.log('Production Firebase and origin configuration passed.');
  }
}
