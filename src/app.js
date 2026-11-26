import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Database } from './database.js';
import { AppError, ValidationError } from './errors.js';
import { authenticate, parseBody, readBody, requireRoles } from './http/context.js';
import { Router } from './http/router.js';
import { serveStatic } from './http/static.js';
import { parse } from './validation.js';
import { AuthService } from './services/auth-service.js';
import { registerRoutes } from './routes/index.js';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

/**
 * Build the application. Returns { server, db, ready } where `ready` resolves once the
 * database tables exist and the coordinator account is seeded.
 */
export function createApp(config) {
  const db = new Database(config.databasePath);
  const router = new Router();
  registerRoutes(router);

  const ready = new AuthService(db, config).ensureCoordinator();

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const method = req.method === 'HEAD' ? 'GET' : req.method;

    // ----- front end -----
    if (method === 'GET' && url.pathname === '/') {
      res.writeHead(307, { Location: '/ui/' });
      return res.end();
    }
    if (method === 'GET' && (url.pathname === '/ui' || url.pathname.startsWith('/ui/'))) {
      if (url.pathname === '/ui') { res.writeHead(307, { Location: '/ui/' }); return res.end(); }
      if (await serveStatic(res, PUBLIC_DIR, url.pathname.slice(4), req.method)) return;
      return sendJson(res, 404, { detail: 'Not Found' });
    }

    // ----- API -----
    const { route, raw } = router.match(method, url.pathname);
    const { opts } = route;
    const ctx = { req, db, config, query: {}, body: {}, params: {} };

    // 1. authentication / authorization come first (as FastAPI dependencies do)
    if (opts.auth) {
      Object.assign(ctx, authenticate(req, ctx));
      if (Array.isArray(opts.auth)) requireRoles(ctx.user, opts.auth);
    }

    // 2. validation: path + query + body errors are reported together
    const errors = [];
    ctx.params = Router.coerceParams(route, raw, errors);
    ctx.query = Router.validateQuery(opts.query, url.searchParams, errors);
    if (opts.body) {
      const { present, data } = parseBody(await readBody(req), req.headers['content-type']);
      if (!present && opts.optionalBody) ctx.body = parse(opts.body, {}, 'body', errors);
      else if (!present) errors.push({ type: 'missing', loc: ['body'], msg: 'Field required' });
      else ctx.body = parse(opts.body, data, 'body', errors);
    }
    Router.throwIfInvalid(errors);

    // 3. handler
    const result = await route.handler(ctx);
    return sendJson(res, opts.status ?? 200, result);
  }

  const server = createServer(async (req, res) => {
    try {
      await ready;
      await handle(req, res);
    } catch (e) {
      if (e instanceof ValidationError) return sendJson(res, 422, { detail: e.detail });
      if (e instanceof AppError) {
        return sendJson(res, e.statusCode, { detail: e.message },
          e.statusCode === 401 ? { 'WWW-Authenticate': 'Bearer' } : {});
      }
      console.error(e);
      if (!res.headersSent) sendJson(res, 500, { detail: 'Internal Server Error' });
      else res.end();
    }
  });
  server.on('close', () => { try { db.close(); } catch { /* already closed */ } });

  return { server, db, ready };
}
