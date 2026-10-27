import 'dotenv/config';
import { createServer } from 'node:http';
import type { ApiRequest, ApiResponse } from './http.js';
import handler from '../api/service.js';
createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/service') {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  for await (const chunk of req) {
    body += String(chunk);
    if (body.length > 40000) {
      res.writeHead(413).end();
      return;
    }
  }
  const request = Object.assign(req, {
    query: Object.fromEntries(url.searchParams),
    body,
  }) as ApiRequest;
  const response = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return response;
    },
    json(value: unknown) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
      return response;
    },
  }) as unknown as ApiResponse;
  await handler(request, response);
}).listen(3001, '127.0.0.1', () => console.log('Local API http://127.0.0.1:3001'));
