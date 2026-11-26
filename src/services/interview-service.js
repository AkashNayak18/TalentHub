import { ApplicationStatus, InterviewResult } from '../enums.js';
import { BusinessRuleError, NotFoundError } from '../errors.js';
import { ApplicationRepository } from '../repositories/application-repository.js';
import { utcnow } from '../utils.js';
import { getCompanyApplication } from './access.js';
import { ApplicationService } from './application-service.js';

export class InterviewService {
  constructor(db) {
    this.db = db;
    this.applications = new ApplicationRepository(db);
  }

  schedule(company, applicationId, data) {
    const application = getCompanyApplication(this.applications, company, applicationId);
    if (application.status !== ApplicationStatus.SHORTLISTED) {
      throw new BusinessRuleError(
        `Interviews can only be scheduled for SHORTLISTED applications (current: ${application.status})`);
    }
    if (data.scheduled_at.getTime() <= utcnow().getTime()) {
      throw new BusinessRuleError('Interview must be scheduled for a future date and time');
    }
    return this.db.transaction(() => {
      const interview = this.applications.addInterview({
        application_id: application.id, scheduled_at: data.scheduled_at, mode: data.mode, location: data.location,
      });
      this.applications.setStatus(application.id, ApplicationStatus.INTERVIEW_SCHEDULED);
      return interview;
    });
  }

  recordResult(company, applicationId, data) {
    const application = getCompanyApplication(this.applications, company, applicationId);
    const { interview } = application;
    if (!interview || application.status !== ApplicationStatus.INTERVIEW_SCHEDULED) {
      throw new BusinessRuleError('There is no pending interview for this application');
    }
    if (interview.result !== InterviewResult.PENDING) {
      throw new BusinessRuleError('The interview result has already been recorded');
    }
    return this.db.transaction(() => {
      const updated = this.applications.recordInterviewResult(application.id, data.result, data.remarks);
      this.applications.setStatus(
        application.id,
        data.result === InterviewResult.PASSED ? ApplicationStatus.SELECTED : ApplicationStatus.NOT_SELECTED);
      return updated;
    });
  }

  getForUser(user, applicationId, profiles) {
    const application = new ApplicationService(this.db).getForUser(user, applicationId, profiles);
    if (!application.interview) throw new NotFoundError('No interview has been scheduled for this application');
    return application.interview;
  }
}
