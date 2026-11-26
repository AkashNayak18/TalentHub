/**
 * Tiny schema validator (the Node equivalent of the Pydantic models).
 * Produces FastAPI-style 422 errors: [{ type, loc: ['body', 'field'], msg }].
 */
import { ValidationError } from './errors.js';

const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export const t = {
  string: (o = {}) => ({ type: 'string', ...o }),
  number: (o = {}) => ({ type: 'number', ...o }),
  integer: (o = {}) => ({ type: 'integer', ...o }),
  boolean: (o = {}) => ({ type: 'boolean', ...o }),
  enum: (values, o = {}) => ({ type: 'enum', values: Object.values(values), ...o }),
  datetime: (o = {}) => ({ type: 'datetime', ...o }),
  list: (item, o = {}) => ({ type: 'list', item, ...o }),
};

const err = (loc, msg, type) => ({ type, loc, msg });

function parseDatetime(raw) {
  const m = DATETIME_RE.exec(raw.trim());
  if (!m) return null;
  const [, date, hm = '00:00', s = '00', frac = '0', zone = 'Z'] = m;
  let z = zone.toUpperCase();
  if (z !== 'Z') {
    const digits = z.slice(1).replace(':', '');
    z = `${z[0]}${digits.slice(0, 2)}:${digits.slice(2).padEnd(2, '0')}`;
  }
  const d = new Date(`${date}T${hm}:${s}.${frac.slice(0, 3).padEnd(3, '0')}${z}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Validate a single value. Returns { value } or { error: [msg, type] }. */
function check(spec, v) {
  switch (spec.type) {
    case 'string': {
      if (typeof v !== 'string') return { error: ['Input should be a valid string', 'string_type'] };
      if (spec.min != null && v.length < spec.min) {
        return { error: [`String should have at least ${spec.min} character${spec.min === 1 ? '' : 's'}`, 'string_too_short'] };
      }
      if (spec.max != null && v.length > spec.max) {
        return { error: [`String should have at most ${spec.max} characters`, 'string_too_long'] };
      }
      if (spec.pattern && !spec.pattern.test(v)) {
        return { error: [`String should match pattern '${spec.pattern.source}'`, 'string_pattern_mismatch'] };
      }
      return { value: spec.transform ? spec.transform(v) : v };
    }
    case 'number':
    case 'integer': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return { error: ['Input should be a valid number', 'float_type'] };
      if (spec.type === 'integer' && !Number.isInteger(v)) {
        return { error: ['Input should be a valid integer, got a number with a fractional part', 'int_from_float'] };
      }
      if (spec.ge != null && v < spec.ge) return { error: [`Input should be greater than or equal to ${spec.ge}`, 'greater_than_equal'] };
      if (spec.gt != null && v <= spec.gt) return { error: [`Input should be greater than ${spec.gt}`, 'greater_than'] };
      if (spec.le != null && v > spec.le) return { error: [`Input should be less than or equal to ${spec.le}`, 'less_than_equal'] };
      return { value: v };
    }
    case 'boolean': {
      if (typeof v === 'boolean') return { value: v };
      const s = String(v).toLowerCase();
      if (['true', '1', 'yes', 'on', 't', 'y'].includes(s)) return { value: true };
      if (['false', '0', 'no', 'off', 'f', 'n'].includes(s)) return { value: false };
      return { error: ['Input should be a valid boolean, unable to interpret input', 'bool_parsing'] };
    }
    case 'enum': {
      if (!spec.values.includes(v)) {
        const opts = spec.values.map((x) => `'${x}'`);
        const list = opts.length > 1 ? `${opts.slice(0, -1).join(', ')} or ${opts.at(-1)}` : opts[0];
        return { error: [`Input should be ${list}`, 'enum'] };
      }
      if (spec.reject?.includes(v)) return { error: [`Value error, ${spec.rejectMessage}`, 'value_error'] };
      return { value: v };
    }
    case 'datetime': {
      const d = typeof v === 'string' ? parseDatetime(v) : null;
      if (!d) return { error: ['Input should be a valid datetime', 'datetime_parsing'] };
      return { value: d };
    }
    case 'list': {
      if (!Array.isArray(v)) return { error: ['Input should be a valid list', 'list_type'] };
      if (spec.max != null && v.length > spec.max) {
        return { error: [`List should have at most ${spec.max} items after validation, not ${v.length}`, 'too_long'] };
      }
      const out = [];
      for (const [i, item] of v.entries()) {
        const r = check(spec.item, item);
        if (r.error) return { error: r.error, index: i };
        out.push(r.value);
      }
      return { value: spec.transform ? spec.transform(out) : out };
    }
    default:
      throw new Error(`unknown spec type ${spec.type}`);
  }
}

/**
 * Validate `data` (plain object) against `shape` ({ field: spec }).
 * Spec options: required (default true unless `default`/`optional`), default, optional.
 * Returns the cleaned object; pushes problems onto `errors` when supplied, otherwise throws.
 */
export function parse(shape, data, where = 'body', errors = null) {
  const own = errors ?? [];
  const out = {};
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    own.push(err([where], 'Input should be a valid dictionary or object to extract fields from', 'model_attributes_type'));
  } else {
    for (const [name, spec] of Object.entries(shape)) {
      const raw = data[name];
      if (raw === undefined || raw === null) {
        if ('default' in spec) out[name] = typeof spec.default === 'function' ? spec.default() : spec.default;
        else if (spec.optional) { /* leave unset */ }
        else own.push(err([where, name], 'Field required', 'missing'));
        continue;
      }
      const r = check(spec, raw);
      if (r.error) own.push(err([where, name, ...(r.index != null ? [r.index] : [])], r.error[0], r.error[1]));
      else out[name] = r.value;
    }
  }
  if (!errors && own.length) throw new ValidationError(own);
  return out;
}
