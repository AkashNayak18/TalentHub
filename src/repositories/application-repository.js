import { JobRepository } from './job-repository.js';
import { toDb, utcnow } from '../utils.js';

const toStudent = (r) => r && { ...r, is_placed: !!r.is_placed };

export class ApplicationRepository {
  constructor(db) { this.db = db; this.jobs = new JobRepository(db); }

  /** Attach student, job, interview and offer to a raw application row. */
  #hydrate(row) {
    if (!row) return null;
    return {
      ...row,
      student: toStudent(this.db.get('SELECT * FROM students WHERE id = ?', row.student_id)),
      job: this.jobs.get(row.job_id),
      interview: this.db.get('SELECT * FROM interviews WHERE application_id = ?', row.id),
      offer: this.db.get('SELECT * FROM offers WHERE application_id = ?', row.id),
    };
  }

  add({ student_id, job_id, status }) {
    const id = this.db.insert(
      'INSERT INTO applications (student_id, job_id, status, applied_at) VALUES (?, ?, ?, ?)',
      student_id, job_id, status, toDb(utcnow()));
    return this.get(id);
  }

  get(id) { return this.#hydrate(this.db.get('SELECT * FROM applications WHERE id = ?', id)); }

  getByStudentAndJob(studentId, jobId) {
    return this.db.get('SELECT * FROM applications WHERE student_id = ? AND job_id = ?', studentId, jobId);
  }

  listForStudent(studentId) {
    return this.db.all('SELECT * FROM applications WHERE student_id = ? ORDER BY id', studentId).map((r) => this.#hydrate(r));
  }

  listForJob(jobId, status) {
    const rows = status
      ? this.db.all('SELECT * FROM applications WHERE job_id = ? AND status = ? ORDER BY id', jobId, status)
      : this.db.all('SELECT * FROM applications WHERE job_id = ? ORDER BY id', jobId);
    return rows.map((r) => this.#hydrate(r));
  }

  count() { return this.db.get('SELECT COUNT(*) AS n FROM applications').n; }
  setStatus(id, status) { this.db.run('UPDATE applications SET status = ? WHERE id = ?', status, id); }

  /* ---------- interviews ---------- */
  addInterview({ application_id, scheduled_at, mode, location }) {
    this.db.insert(
      `INSERT INTO interviews (application_id, scheduled_at, mode, location, result, remarks) VALUES (?, ?, ?, ?, 'PENDING', '')`,
      application_id, toDb(scheduled_at), mode, location);
    return this.db.get('SELECT * FROM interviews WHERE application_id = ?', application_id);
  }

  recordInterviewResult(applicationId, result, remarks) {
    this.db.run('UPDATE interviews SET result = ?, remarks = ? WHERE application_id = ?', result, remarks, applicationId);
    return this.db.get('SELECT * FROM interviews WHERE application_id = ?', applicationId);
  }

  /* ---------- offers ---------- */
  addOffer({ application_id, package_lpa }) {
    const id = this.db.insert(
      `INSERT INTO offers (application_id, package_lpa, status, issued_at) VALUES (?, ?, 'ISSUED', ?)`,
      application_id, package_lpa, toDb(utcnow()));
    return this.getOffer(id);
  }

  getOffer(id) { return this.db.get('SELECT * FROM offers WHERE id = ?', id); }

  /** Offers with the owning student id attached (offer.student_id). */
  getOfferWithOwner(id) {
    return this.db.get(
      'SELECT o.*, a.student_id FROM offers o JOIN applications a ON a.id = o.application_id WHERE o.id = ?', id);
  }

  listOffersForStudent(studentId) {
    return this.db.all(
      `SELECT o.*, a.student_id FROM offers o JOIN applications a ON a.id = o.application_id
       WHERE a.student_id = ? ORDER BY o.id`, studentId);
  }

  setOfferStatus(id, status, respondedAt = null) {
    this.db.run('UPDATE offers SET status = ?, responded_at = ? WHERE id = ?',
      status, respondedAt ? toDb(respondedAt) : null, id);
    return this.getOffer(id);
  }

  /** Every offer joined with student / job / company details (used by reports). */
  listAllOffersDetailed() {
    return this.db.all(
      `SELECT o.*, a.student_id, s.name AS student_name, s.branch, j.title AS job_title, c.name AS company_name
       FROM offers o
       JOIN applications a ON a.id = o.application_id
       JOIN students s ON s.id = a.student_id
       JOIN job_listings j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id
       ORDER BY o.id`);
  }
}
