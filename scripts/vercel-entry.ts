/**
 * Vercel serverless entry for the delivery API.
 *
 * This file is bundled to `api/index.mjs` by `pnpm build:vercel:api`
 * (esbuild). The bundle is required because Vercel leaves workspace
 * dependencies external, and their package exports point at TypeScript
 * sources, which the Node.js runtime cannot import.
 *
 * All /api/* requests are rewritten to this function by vercel.json
 * (`/api/(.*)` -> `/api/index`), so the single Hono application sees the
 * original URL and routes exactly as the local single-port server
 * (`pnpm start`, apps/api/src/server.ts). The Nordhaus bootstrap runs once
 * per warm function instance, mirroring the local demo state (in-memory
 * repositories, MockProvider, fixture AI). Static web assets come from the
 * Vercel build output (apps/web/dist) with SPA rewrites in vercel.json.
 *
 * Both Vercel launcher conventions are covered: named exports for the
 * web-style launcher, and a default export that adapts the Node.js
 * (req, res) style into a standard Request for the same Hono app.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Hono } from 'hono';

import { createApiApp } from '../apps/api/src/app.js';
import { runNordhausBootstrap } from '../apps/api/src/bootstrap.js';

let cachedApp: Hono | undefined;

async function getApp(): Promise<Hono> {
  if (cachedApp === undefined) {
    const services = await runNordhausBootstrap();
    cachedApp = createApiApp(services);
  }
  return cachedApp;
}

async function handler(request: Request): Promise<Response> {
  const app = await getApp();
  return app.request(request);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function nodeHandler(request: unknown, res?: ServerResponse): Promise<Response | void> {
  if (request instanceof Request) {
    return handler(request);
  }
  const req = request as IncomingMessage;
  const method = req.method ?? 'GET';
  const rawUrl = req.url ?? '/';
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://vercel.local${rawUrl}`;
  const headers = new Headers(req.headers as Record<string, string | string[]>);
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await readBody(req);
  }
  const response = await handler(new Request(url, init));
  if (res !== undefined) {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  }
  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export default nodeHandler;
