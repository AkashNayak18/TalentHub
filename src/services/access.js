/** Shared ownership / authorization checks used by several services. */
import { ForbiddenError, NotFoundError } from '../errors.js';

export function getCompanyApplication(repo, company, applicationId) {
  const application = repo.get(applicationId);
  if (!application) throw new NotFoundError('Application not found');
  if (application.job.company_id !== company.id) {
    throw new ForbiddenError("This application belongs to another company's job");
  }
  return application;
}
