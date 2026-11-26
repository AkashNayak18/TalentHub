import { applicationRoutes } from './applications.js';
import { authRoutes } from './auth.js';
import { companyRoutes } from './companies.js';
import { interviewRoutes } from './interviews.js';
import { jobRoutes } from './jobs.js';
import { offerRoutes } from './offers.js';
import { reportRoutes } from './reports.js';
import { studentRoutes } from './students.js';

export function registerRoutes(router) {
  for (const register of [authRoutes, studentRoutes, companyRoutes, jobRoutes,
    applicationRoutes, interviewRoutes, offerRoutes, reportRoutes]) register(router);

  router.add('GET', '/health', {}, () => ({ status: 'ok' }));
}
