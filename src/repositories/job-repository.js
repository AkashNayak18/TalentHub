import { toDb, utcnow } from '../utils.js';

const SELECT = `SELECT j.*, c.name AS company_name FROM job_listings j JOIN companies c ON c.id = j.company_id`;

const toJob = (r) => r && {
  ...r,
  is_open: !!r.is_open,
  allowed_branches: r.allowed_branches_csv.split(',').filter(Boolean),
};

export class JobRepository {
  constructor(db) { this.db = db; }

  add(job) {
    const id = this.db.insert(
      `INSERT INTO job_listings (company_id, title, description, location, package_lpa, min_cgpa,
        max_active_backlogs, allowed_branches_csv, is_open, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      job.company_id, job.title, job.description, job.location, job.package_lpa, job.min_cgpa,
      job.max_active_backlogs, job.allowed_branches.join(','), toDb(utcnow()));
    return this.get(id);
  }

  get(id) { return toJob(this.db.get(`${SELECT} WHERE j.id = ?`, id)); }
  listOpen() { return this.db.all(`${SELECT} WHERE j.is_open = 1 ORDER BY j.id`).map(toJob); }
  listAll() { return this.db.all(`${SELECT} ORDER BY j.id`).map(toJob); }
  listCompanies() { return this.db.all('SELECT * FROM companies ORDER BY id'); }
  close(id) { this.db.run('UPDATE job_listings SET is_open = 0 WHERE id = ?', id); }
}
