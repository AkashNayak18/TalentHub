import { ForbiddenError, NotFoundError } from '../errors.js';
import { ApplicationRepository } from '../repositories/application-repository.js';
import { JobRepository } from '../repositories/job-repository.js';
import { checkEligibility } from './eligibility.js';

export class JobService {
  constructor(db) {
    this.jobs = new JobRepository(db);
    this.applications = new ApplicationRepository(db);
  }

  createJob(company, data) {
    return this.jobs.add({ ...data, company_id: company.id });
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundError('Job not found');
    return job;
  }

  listOpenJobs(student = null, eligibleOnly = false) {
    const jobs = this.jobs.listOpen();
    return student && eligibleOnly ? jobs.filter((j) => checkEligibility(student, j).eligible) : jobs;
  }

  checkStudentEligibility(student, jobId) {
    return checkEligibility(student, this.getJob(jobId));
  }

  closeJob(company, jobId) {
    this.#getOwnedJob(company, jobId);
    this.jobs.close(jobId);
    return this.jobs.get(jobId);
  }

  listApplications(company, jobId, status) {
    this.#getOwnedJob(company, jobId);
    return this.applications.listForJob(jobId, status);
  }

  #getOwnedJob(company, jobId) {
    const job = this.getJob(jobId);
    if (job.company_id !== company.id) throw new ForbiddenError('This job belongs to another company');
    return job;
  }
}
