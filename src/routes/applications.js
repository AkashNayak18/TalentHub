import { ApplicationService } from '../services/application-service.js';
import { ApplicationCreate, applicationOut } from '../schemas.js';
import { COMPANY, STUDENT } from './auth.js';

export function applicationRoutes(router) {
  router.add('POST', '/applications', { auth: STUDENT, body: ApplicationCreate, status: 201 },
    ({ db, student, body }) => applicationOut(new ApplicationService(db).apply(student, body.job_id)));

  // NB: registered before '/applications/:application_id' so "me" is not parsed as an id.
  router.add('GET', '/applications/me', { auth: STUDENT },
    ({ db, student }) => new ApplicationService(db).listForStudent(student).map(applicationOut));

  router.add('GET', '/applications/:application_id:int', { auth: 'any' },
    ({ db, user, student, company, params }) =>
      applicationOut(new ApplicationService(db).getForUser(user, params.application_id, { student, company })));

  router.add('POST', '/applications/:application_id:int/shortlist', { auth: COMPANY },
    ({ db, company, params }) => applicationOut(new ApplicationService(db).shortlist(company, params.application_id)));

  router.add('POST', '/applications/:application_id:int/reject', { auth: COMPANY },
    ({ db, company, params }) => applicationOut(new ApplicationService(db).reject(company, params.application_id)));
}
