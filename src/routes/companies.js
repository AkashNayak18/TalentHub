import { companyOut } from '../schemas.js';
import { COMPANY } from './auth.js';

export function companyRoutes(router) {
  router.add('GET', '/companies/me', { auth: COMPANY }, ({ company }) => companyOut(company));
}
