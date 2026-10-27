import type { IncomingMessage, ServerResponse } from 'node:http';
// Vercel's Node request/response contract. Structural types keep its build-tool dependency out of this app.
export interface ApiRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: unknown;
}
export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(value: unknown): ApiResponse;
}
