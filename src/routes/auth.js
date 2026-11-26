import { Role } from '../enums.js';
import { AuthService } from '../services/auth-service.js';
import { CompanyRegister, LoginForm, StudentRegister, companyOut, studentOut, userOut } from '../schemas.js';

export function authRoutes(router) {
  router.add('POST', '/auth/register/student', { body: StudentRegister, status: 201 },
    async ({ db, config, body }) => studentOut(await new AuthService(db, config).registerStudent(body)));

  router.add('POST', '/auth/register/company', { body: CompanyRegister, status: 201 },
    async ({ db, config, body }) => companyOut(await new AuthService(db, config).registerCompany(body)));

  // OAuth2 password flow: form-encoded username/password (JSON is accepted too).
  router.add('POST', '/auth/login', { body: LoginForm },
    async ({ db, config, body }) => ({
      access_token: await new AuthService(db, config).login(body.username, body.password),
      token_type: 'bearer',
    }));

  router.add('GET', '/auth/me', { auth: 'any' }, ({ user }) => userOut(user));
}

export const STUDENT = [Role.STUDENT];
export const COMPANY = [Role.COMPANY];
export const COORDINATOR = [Role.COORDINATOR];
