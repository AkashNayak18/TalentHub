import { StudentService } from '../services/student-service.js';
import { AcademicRecordUpdate, StudentListQuery, StudentNameUpdate, studentOut } from '../schemas.js';
import { COORDINATOR, STUDENT } from './auth.js';

export function studentRoutes(router) {
  router.add('GET', '/students/me', { auth: STUDENT }, ({ student }) => studentOut(student));

  router.add('PATCH', '/students/me', { auth: STUDENT, body: StudentNameUpdate },
    ({ db, student, body }) => studentOut(new StudentService(db).updateName(student, body.name)));

  router.add('GET', '/students', { auth: COORDINATOR, query: StudentListQuery },
    ({ db, query }) => new StudentService(db).listStudents(query.branch, query.placed).map(studentOut));

  router.add('PATCH', '/students/:student_id:int/academic-record', { auth: COORDINATOR, body: AcademicRecordUpdate },
    ({ db, params, body }) => studentOut(new StudentService(db).updateAcademicRecord(params.student_id, body)));
}
