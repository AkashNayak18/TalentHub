const toStudent = (r) => r && { ...r, is_placed: !!r.is_placed };

export class StudentRepository {
  constructor(db) { this.db = db; }

  get(id) { return toStudent(this.db.get('SELECT * FROM students WHERE id = ?', id)); }

  listAll({ branch, placed } = {}) {
    const where = [];
    const params = [];
    if (branch) { where.push('branch = ?'); params.push(branch); }
    if (placed !== undefined && placed !== null) { where.push('is_placed = ?'); params.push(placed ? 1 : 0); }
    const sql = `SELECT * FROM students${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id`;
    return this.db.all(sql, ...params).map(toStudent);
  }

  updateAcademicRecord(id, { branch, cgpa, active_backlogs }) {
    this.db.run(
      'UPDATE students SET branch = COALESCE(?, branch), cgpa = COALESCE(?, cgpa), active_backlogs = COALESCE(?, active_backlogs) WHERE id = ?',
      branch ?? null, cgpa ?? null, active_backlogs ?? null, id);
  }

  updateName(id, name) { this.db.run('UPDATE students SET name = ? WHERE id = ?', name, id); }
  setPlaced(id, placed) { this.db.run('UPDATE students SET is_placed = ? WHERE id = ?', placed ? 1 : 0, id); }
}
