import { NotFoundError } from '../errors.js';
import { StudentRepository } from '../repositories/student-repository.js';

export class StudentService {
  constructor(db) { this.students = new StudentRepository(db); }

  updateName(student, name) {
    this.students.updateName(student.id, name);
    return this.students.get(student.id);
  }

  listStudents(branch, placed) {
    return this.students.listAll({ branch: branch ? branch.trim().toUpperCase() : undefined, placed });
  }

  updateAcademicRecord(studentId, data) {
    if (!this.students.get(studentId)) throw new NotFoundError('Student not found');
    this.students.updateAcademicRecord(studentId, data);
    return this.students.get(studentId);
  }
}
