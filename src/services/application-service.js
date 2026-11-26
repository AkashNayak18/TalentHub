import { ApplicationStatus, Role } from '../enums.js';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../errors.js';
import { isUniqueViolation } from '../database.js';
import { ApplicationRepository } from '../repositories/application-repository.js';
import { JobRepository } from '../repositories/job-repository.js';
import { getCompanyApplication } from './access.js';
import { checkEligibility } from './eligibility.js';

export class ApplicationService {
  constructor(db) {
    this.applications = new ApplicationRepository(db);
    this.jobs = new JobRepository(db);
  }

  apply(student, jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundError('Job not found');
    if (!job.is_open) throw new BusinessRuleError('This job is closed for applications');
    if (student.is_placed) throw new BusinessRuleError('You have already accepted an offer and cannot apply to more jobs');
    if (this.applications.getByStudentAndJob(student.id, job.id)) throw new ConflictError('You have already applied for this job');

    const result = checkEligibility(student, job);
    if (!result.eligible) throw new BusinessRuleError('Not eligible: ' + result.reasons.join('; '));

    try {
      return this.applications.add({ student_id: student.id, job_id: job.id, status: ApplicationStatus.APPLIED });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError('You have already applied for this job');
      throw e;
    }
  }

  listForStudent(student) { return this.applications.listForStudent(student.id); }

  getForUser(user, applicationId, { student, company } = {}) {
    const application = this.applications.get(applicationId);
    if (!application) throw new NotFoundError('Application not found');
    const allowed = user.role === Role.COORDINATOR
      || (user.role === Role.STUDENT && student && application.student_id === student.id)
      || (user.role === Role.COMPANY && company && application.job.company_id === company.id);
    if (!allowed) throw new ForbiddenError('You do not have access to this application');
    return application;
  }

  shortlist(company, applicationId) {
    const application = getCompanyApplication(this.applications, company, applicationId);
    if (application.status !== ApplicationStatus.APPLIED) {
      throw new BusinessRuleError(`Only applications in APPLIED status can be shortlisted (current: ${application.status})`);
    }
    // Re-check eligibility: academic data may have been corrected since the student applied.
    const result = checkEligibility(application.student, application.job);
    if (!result.eligible) throw new BusinessRuleError('Student no longer meets the job criteria: ' + result.reasons.join('; '));
    this.applications.setStatus(application.id, ApplicationStatus.SHORTLISTED);
    return this.applications.get(application.id);
  }

  reject(company, applicationId) {
    const application = getCompanyApplication(this.applications, company, applicationId);
    if (![ApplicationStatus.APPLIED, ApplicationStatus.SHORTLISTED].includes(application.status)) {
      throw new BusinessRuleError(`Only APPLIED or SHORTLISTED applications can be rejected (current: ${application.status})`);
    }
    this.applications.setStatus(application.id, ApplicationStatus.REJECTED);
    return this.applications.get(application.id);
  }
}
