/**
 * Minimal router: path params (":id" / ":id:int"), typed validation, auth guards and
 * FastAPI-style error semantics (auth errors first, then 422s collected from params/query/body).
 */
import { MethodNotAllowedError, NotFoundError, ValidationError } from '../errors.js';
import { parse } from '../validation.js';

const INT_RE = /^[+-]?\d+$/;

function compile(path) {
  const names = [];
  const source = path
    .split('/')
    .map((seg) => {
      const m = /^:(\w+)(?::(int))?$/.exec(seg);
      if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push({ name: m[1], int: m[2] === 'int' });
      return '([^/]+)';
    })
    .join('/');
  return { regex: new RegExp(`^${source}$`), names };
}

export class Router {
  routes = [];

  /**
   * @param {string} method
   * @param {string} path           e.g. '/jobs/:job_id:int/close'
   * @param {object} opts           { auth: undefined | 'any' | [roles], query, body, form, optionalBody, status }
   * @param {Function} handler      (ctx) => result | Promise<result>
   */
  add(method, path, opts, handler) {
    this.routes.push({ method, ...compile(path), opts, handler });
  }

  /** Returns the matching route + raw params, or throws 404 / 405. */
  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const raw = {};
      route.names.forEach((n, i) => { raw[n.name] = decodeURIComponent(m[i + 1]); });
      return { route, raw };
    }
    if (pathMatched) throw new MethodNotAllowedError('Method Not Allowed');
    throw new NotFoundError('Not Found');
  }

  /** Validate path params (int coercion) -> object, pushing 422 entries onto `errors`. */
  static coerceParams(route, raw, errors) {
    const params = {};
    for (const { name, int } of route.names) {
      if (!int) { params[name] = raw[name]; continue; }
      if (INT_RE.test(raw[name])) params[name] = Number(raw[name]);
      else errors.push({ type: 'int_parsing', loc: ['path', name], msg: 'Input should be a valid integer, unable to parse string as an integer' });
    }
    return params;
  }

  static validateQuery(shape, searchParams, errors) {
    if (!shape) return {};
    const obj = {};
    for (const key of Object.keys(shape)) if (searchParams.has(key)) obj[key] = searchParams.get(key);
    // Query values arrive as strings: coerce numbers, leave booleans/enums to the validator.
    for (const [key, spec] of Object.entries(shape)) {
      if (obj[key] === undefined) continue;
      if (spec.type === 'number' || spec.type === 'integer') {
        obj[key] = obj[key].trim() === '' ? NaN : Number(obj[key]);
      }
    }
    return parse(shape, obj, 'query', errors);
  }

  static throwIfInvalid(errors) { if (errors.length) throw new ValidationError(errors); }
}
