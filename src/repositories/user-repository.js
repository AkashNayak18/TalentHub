const toUser = (r) => r && { ...r, is_active: !!r.is_active };
const toStudent = (r) => r && { ...r, is_placed: !!r.is_placed };

export class UserRepository {
  constructor(db) { this.db = db; }

  get(id) { return toUser(this.db.get('SELECT * FROM users WHERE id = ?', id)); }
  getByUsername(username) { return toUser(this.db.get('SELECT * FROM users WHERE username = ?', username)); }

  add({ username, password_hash, role }) {
    const id = this.db.insert(
      'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)', username, password_hash, role);
    return this.get(id);
  }

  addStudent({ user_id, name, branch, cgpa, active_backlogs }) {
    const id = this.db.insert(
      'INSERT INTO students (user_id, name, branch, cgpa, active_backlogs, is_placed) VALUES (?, ?, ?, ?, ?, 0)',
      user_id, name, branch, cgpa, active_backlogs);
    return toStudent(this.db.get('SELECT * FROM students WHERE id = ?', id));
  }

  addCompany({ user_id, name, industry }) {
    const id = this.db.insert('INSERT INTO companies (user_id, name, industry) VALUES (?, ?, ?)', user_id, name, industry);
    return this.db.get('SELECT * FROM companies WHERE id = ?', id);
  }

  getStudentByUserId(userId) { return toStudent(this.db.get('SELECT * FROM students WHERE user_id = ?', userId)); }
  getCompanyByUserId(userId) { return this.db.get('SELECT * FROM companies WHERE user_id = ?', userId); }
}
