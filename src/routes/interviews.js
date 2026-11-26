import { InterviewService } from '../services/interview-service.js';
import { InterviewCreate, InterviewResultUpdate, interviewOut } from '../schemas.js';
import { COMPANY } from './auth.js';

export function interviewRoutes(router) {
  router.add('POST', '/applications/:application_id:int/interview', { auth: COMPANY, body: InterviewCreate, status: 201 },
    ({ db, company, params, body }) =>
      interviewOut(new InterviewService(db).schedule(company, params.application_id, body)));

  router.add('GET', '/applications/:application_id:int/interview', { auth: 'any' },
    ({ db, user, student, company, params }) =>
      interviewOut(new InterviewService(db).getForUser(user, params.application_id, { student, company })));

  router.add('PUT', '/applications/:application_id:int/interview/result', { auth: COMPANY, body: InterviewResultUpdate },
    ({ db, company, params, body }) =>
      interviewOut(new InterviewService(db).recordResult(company, params.application_id, body)));
}
