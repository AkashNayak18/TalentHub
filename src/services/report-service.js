import { OfferStatus } from '../enums.js';
import { ApplicationRepository } from '../repositories/application-repository.js';
import { JobRepository } from '../repositories/job-repository.js';
import { StudentRepository } from '../repositories/student-repository.js';

const pct = (part, whole) => (whole ? Math.round((part * 100 * 100) / whole) / 100 : 0.0);
const round2 = (n) => Math.round(n * 100) / 100;

export class ReportService {
  constructor(db) {
    this.students = new StudentRepository(db);
    this.jobs = new JobRepository(db);
    this.applications = new ApplicationRepository(db);
  }

  placementStatistics() {
    const students = this.students.listAll();
    const companies = this.jobs.listCompanies();
    const jobs = this.jobs.listAll();
    const offers = this.applications.listAllOffersDetailed();

    const placed = students.filter((s) => s.is_placed);
    const accepted = offers.filter((o) => o.status === OfferStatus.ACCEPTED);
    const packages = accepted.map((o) => o.package_lpa);

    const branches = new Map(); // branch -> [total, placed]
    for (const s of students) {
      const row = branches.get(s.branch) ?? [0, 0];
      row[0] += 1;
      row[1] += s.is_placed ? 1 : 0;
      branches.set(s.branch, row);
    }

    const perCompany = new Map(companies.map((c) => [c.name, [0, 0]])); // name -> [issued, accepted]
    for (const o of offers) {
      const row = perCompany.get(o.company_name) ?? [0, 0];
      row[0] += 1;
      row[1] += o.status === OfferStatus.ACCEPTED ? 1 : 0;
      perCompany.set(o.company_name, row);
    }
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

    return {
      total_students: students.length,
      placed_students: placed.length,
      unplaced_students: students.length - placed.length,
      placement_percentage: pct(placed.length, students.length),
      total_companies: companies.length,
      total_jobs: jobs.length,
      open_jobs: jobs.filter((j) => j.is_open).length,
      total_applications: this.applications.count(),
      offers_issued: offers.length,
      offers_accepted: accepted.length,
      offers_declined: offers.filter((o) => o.status === OfferStatus.DECLINED).length,
      offers_pending: offers.filter((o) => o.status === OfferStatus.ISSUED).length,
      average_package_lpa: packages.length ? round2(packages.reduce((a, b) => a + b, 0) / packages.length) : 0.0,
      highest_package_lpa: packages.length ? Math.max(...packages) : 0.0,
      branch_wise: [...branches.entries()].sort(byKey).map(([branch, [total, p]]) => ({
        branch, total_students: total, placed_students: p, placement_percentage: pct(p, total),
      })),
      company_wise: [...perCompany.entries()].sort(byKey).map(([company, [issued, acc]]) => ({
        company, offers_issued: issued, offers_accepted: acc,
      })),
    };
  }

  placedStudents() {
    return this.applications.listAllOffersDetailed()
      .filter((o) => o.status === OfferStatus.ACCEPTED)
      .map((o) => ({
        student_id: o.student_id, student_name: o.student_name, branch: o.branch,
        company: o.company_name, job_title: o.job_title, package_lpa: o.package_lpa,
      }));
  }
}
