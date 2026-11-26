import { JobService } from '../services/job-service.js';
import {
  ApplicationListQuery, JobCreate, JobListQuery, applicationOut, jobOut,
} from '../schemas.js';
import { COMPANY, STUDENT } from './auth.js';

export function jobRoutes(router) {
  router.add('POST', '/jobs', { auth: COMPANY, body: JobCreate, status: 201 },
    ({ db, company, body }) => jobOut(new JobService(db).createJob(company, body)));

  // All open jobs. Students can pass `eligible_only=true` to see only jobs they qualify for.
  router.add('GET', '/jobs', { auth: 'any', query: JobListQuery },
    ({ db, student, query }) => new JobService(db).listOpenJobs(student, query.eligible_only).map(jobOut));

  router.add('GET', '/jobs/:job_id:int', { auth: 'any' },
    ({ db, params }) => jobOut(new JobService(db).getJob(params.job_id)));

  router.add('GET', '/jobs/:job_id:int/eligibility', { auth: STUDENT }, ({ db, student, params }) => {
    const result = new JobService(db).checkStudentEligibility(student, params.job_id);
    return { job_id: params.job_id, eligible: result.eligible, reasons: result.reasons };
  });

  router.add('POST', '/jobs/:job_id:int/close', { auth: COMPANY },
    ({ db, company, params }) => jobOut(new JobService(db).closeJob(company, params.job_id)));

  router.add('GET', '/jobs/:job_id:int/applications', { auth: COMPANY, query: ApplicationListQuery },
    ({ db, company, params, query }) =>
      new JobService(db).listApplications(company, params.job_id, query.status).map(applicationOut));
}
