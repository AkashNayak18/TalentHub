import { Role } from '../enums.js';
import { AuthenticationError, ConflictError } from '../errors.js';
import { UserRepository } from '../repositories/user-repository.js';
import { createAccessToken, hashPassword, verifyPassword } from '../security.js';
import { isUniqueViolation } from '../database.js';

export class AuthService {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.users = new UserRepository(db);
    this.dummyHash = null;
  }

  async #register(data, role, createProfile) {
    if (this.users.getByUsername(data.username)) throw new ConflictError('Username is already taken');
    const passwordHash = await hashPassword(data.password, this.config.pbkdf2Iterations);
    try {
      return this.db.transaction(() => {
        const user = this.users.add({ username: data.username, password_hash: passwordHash, role });
        return createProfile(user);
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError('Username is already taken');
      throw e;
    }
  }

  registerStudent(data) {
    return this.#register(data, Role.STUDENT, (user) => this.users.addStudent({
      user_id: user.id, name: data.name, branch: data.branch, cgpa: data.cgpa, active_backlogs: data.active_backlogs,
    }));
  }

  registerCompany(data) {
    return this.#register(data, Role.COMPANY, (user) => this.users.addCompany({
      user_id: user.id, name: data.name, industry: data.industry,
    }));
  }

  async login(username, password) {
    const user = this.users.getByUsername(username);
    // Same error (and similar timing) for unknown user / wrong password to avoid user enumeration.
    const hash = user?.password_hash ?? (this.dummyHash ??= await hashPassword('dummy-password', this.config.pbkdf2Iterations));
    const ok = await verifyPassword(password, hash);
    if (!user || !user.is_active || !ok) throw new AuthenticationError('Incorrect username or password');
    return createAccessToken(user.id, user.role, this.config);
  }

  /** Coordinators cannot self-register; one account is seeded from settings. */
  async ensureCoordinator() {
    if (this.users.getByUsername(this.config.coordinatorUsername)) return;
    const hash = await hashPassword(this.config.coordinatorPassword, this.config.pbkdf2Iterations);
    this.users.add({ username: this.config.coordinatorUsername, password_hash: hash, role: Role.COORDINATOR });
  }
}
