import type { ApiRequest, ApiResponse } from '../server/http.js';
import { ZodError } from 'zod';
import {
  authenticate,
  feedback,
  HttpError,
  manage,
  placeOrder,
  rateLimit,
  updateOrder,
} from '../server/service.js';
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!req.headers['content-type']?.includes('application/json'))
      throw new HttpError(415, 'JSON required');
    const origin = req.headers.origin;
    const allowed = process.env.APP_ORIGIN;
    if (
      origin &&
      allowed &&
      origin !== allowed &&
      !(
        process.env.FIRESTORE_EMULATOR_HOST &&
        /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
      )
    )
      throw new HttpError(403, 'Origin is not allowed');
    const raw: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(raw ?? null).length > 40000) throw new HttpError(413, 'Request too large');
    const op = typeof req.query.op === 'string' ? req.query.op : '';
    const ip = process.env.VERCEL
      ? String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? 'unknown')
          .split(',')[0]
          .trim()
      : (req.socket.remoteAddress ?? 'local');
    if (op === 'order' || op === 'feedback') {
      await rateLimit(ip, op, op === 'order' ? 12 : 20);
      return res.status(200).json(await (op === 'order' ? placeOrder(raw) : feedback(raw)));
    }
    const user = await authenticate(req.headers.authorization);
    await rateLimit(user.uid, 'staff', 180);
    if (op === 'me') return res.status(200).json(user);
    if (op === 'update') return res.status(200).json(await updateOrder(raw, user));
    if (op === 'manage') return res.status(200).json(await manage(raw, user));
    throw new HttpError(404, 'Endpoint not found');
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e instanceof ZodError)
      return res
        .status(400)
        .json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (e instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON' });
    console.error('API failure', e instanceof Error ? e.message : 'Unknown error');
    return res
      .status(500)
      .json({ error: 'Something went wrong. Please try again or visit the counter.' });
  }
}
