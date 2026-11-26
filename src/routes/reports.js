import { ReportService } from '../services/report-service.js';
import { COORDINATOR } from './auth.js';

export function reportRoutes(router) {
  router.add('GET', '/reports/placement-statistics', { auth: COORDINATOR },
    ({ db }) => new ReportService(db).placementStatistics());

  router.add('GET', '/reports/placed-students', { auth: COORDINATOR },
    ({ db }) => new ReportService(db).placedStudents());
}
