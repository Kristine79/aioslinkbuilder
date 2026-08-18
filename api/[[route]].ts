/**
 * Vercel serverless entry for the delivery API.
 *
 * All /api/* requests land here and run the exact same Hono application as
 * the local single-port server (`pnpm start`, apps/api/src/server.ts). The
 * Nordhaus bootstrap runs once per warm function instance, so the remote
 * environment mirrors the local demo state (in-memory repositories,
 * MockProvider, fixture AI). Static web assets come from the Vercel build
 * output (apps/web/dist) with SPA rewrites declared in vercel.json.
 */

import type { Hono } from 'hono';

import { createApiApp } from '../apps/api/src/app.js';
import { runNordhausBootstrap } from '../apps/api/src/bootstrap.js';

let cachedApp: Hono | undefined;

async function handler(request: Request): Promise<Response> {
  if (cachedApp === undefined) {
    const services = await runNordhausBootstrap();
    cachedApp = createApiApp(services);
  }
  return cachedApp.request(request);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
