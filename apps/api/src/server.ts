/**
 * Composition root: builds the Nordhaus scenario state, wires the Hono app
 * and starts the HTTP server. Serves the built web app (apps/web/dist) when
 * present so `pnpm start` runs the whole product on one port.
 */

import { serve } from '@hono/node-server';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extname, join, normalize } from 'node:path';
import type { Hono } from 'hono';

import { createApiApp, type ApiServices } from './app.js';
import { runNordhausBootstrap } from './bootstrap.js';
import { loadRuntimeConfig } from './runtime-config.js';

const PORT = Number(process.env.PORT ?? 8787);
const WEB_DIST = fileURLToPath(new URL('../../web/dist/', import.meta.url));

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function staticTarget(pathname: string): { file: string; mime: string } | null {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const file = join(WEB_DIST, relative);
  if (!file.startsWith(join(WEB_DIST, '')) || !existsSync(file) || !statSync(file).isFile()) {
    return null;
  }
  return { file, mime: MIME[extname(file)] ?? 'application/octet-stream' };
}

/**
 * The full HTTP app: API routes + static serving of the built web app with
 * SPA fallback. Exported separately from `main` so E2E tests can boot the
 * exact production composition on an ephemeral port.
 */
export function createServerApp(services: ApiServices): Hono {
  const app = createApiApp(services);

  if (existsSync(WEB_DIST)) {
    app.get('*', (c) => {
      const pathname = new URL(c.req.url).pathname;
      if (pathname.startsWith('/api/')) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
      }
      const target =
        staticTarget(pathname === '/' ? '/index.html' : pathname) ?? staticTarget('/index.html');
      if (target === null) {
        return c.text('Not found', 404);
      }
      return c.body(readFileSync(target.file), 200, {
        'Content-Type': target.mime,
        'Cache-Control': target.file.endsWith('index.html')
          ? 'no-cache'
          : 'public, max-age=31536000',
      });
    });
  }

  return app;
}

async function main(): Promise<void> {
  const services = await runNordhausBootstrap(loadRuntimeConfig());
  const app = createServerApp(services);

  const display = existsSync(WEB_DIST)
    ? `serving UI from ${WEB_DIST}`
    : 'UI not built (run pnpm dev:web for development mode)';
  console.log(
    `[api] Nordhaus scenario ready: ${services.company.name} / ${services.campaign.name}`,
  );
  console.log(`[api] listening on http://localhost:${PORT} (${display})`);

  serve({ fetch: app.fetch, port: PORT });
}

// Only boot the server when this module is the entry point (pnpm start /
// tsx apps/api/src/server.ts). When imported for tests or composition,
// the app factory is used instead — no stray listener.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error('[api] failed to start:', error);
    process.exitCode = 1;
  });
}
