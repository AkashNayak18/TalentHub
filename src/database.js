import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

// Same schema as the original SQLAlchemy models, so an existing talenthub.db keeps working.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER NOT NULL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER NOT NULL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users (id),
  name VARCHAR(100) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  cgpa FLOAT NOT NULL,
  active_backlogs INTEGER NOT NULL,
  is_placed BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_students_branch ON students (branch);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER NOT NULL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users (id),
  name VARCHAR(150) NOT NULL,
  industry VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS job_listings (
  id INTEGER NOT NULL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies (id),
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(100) NOT NULL,
  package_lpa FLOAT NOT NULL,
  min_cgpa FLOAT NOT NULL,
  max_active_backlogs INTEGER NOT NULL,
  allowed_branches_csv VARCHAR(500) NOT NULL,
  is_open BOOLEAN NOT NULL,
  created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_job_listings_company_id ON job_listings (company_id);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER NOT NULL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id),
  job_id INTEGER NOT NULL REFERENCES job_listings (id),
  status VARCHAR(30) NOT NULL,
  applied_at DATETIME NOT NULL,
  CONSTRAINT uq_student_job UNIQUE (student_id, job_id)
);
CREATE INDEX IF NOT EXISTS ix_applications_student_id ON applications (student_id);
CREATE INDEX IF NOT EXISTS ix_applications_job_id ON applications (job_id);

CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER NOT NULL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications (id),
  scheduled_at DATETIME NOT NULL,
  mode VARCHAR(10) NOT NULL,
  location VARCHAR(200) NOT NULL,
  result VARCHAR(10) NOT NULL,
  remarks TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER NOT NULL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications (id),
  package_lpa FLOAT NOT NULL,
  status VARCHAR(10) NOT NULL,
  issued_at DATETIME NOT NULL,
  responded_at DATETIME
);
`;

/** Thin synchronous wrapper around node:sqlite with statement caching and transactions. */
export class Database {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA foreign_keys = ON');
    this.raw.exec(SCHEMA);
    this.cache = new Map();
    this.depth = 0;
  }

  #stmt(sql) {
    let s = this.cache.get(sql);
    if (!s) { s = this.raw.prepare(sql); this.cache.set(sql, s); }
    return s;
  }

  get(sql, ...params) { return this.#stmt(sql).get(...params) ?? null; }
  all(sql, ...params) { return this.#stmt(sql).all(...params); }
  run(sql, ...params) { return this.#stmt(sql).run(...params); }
  insert(sql, ...params) { return Number(this.#stmt(sql).run(...params).lastInsertRowid); }

  /** Runs fn atomically; rolls back if it throws. Nested calls join the outer transaction. */
  transaction(fn) {
    if (this.depth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }

  close() { this.raw.close(); }
}

export const isUniqueViolation = (e) => /UNIQUE constraint failed/i.test(e?.message ?? '');
