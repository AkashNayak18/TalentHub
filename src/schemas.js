/** Request shapes (validation) and response serializers - the Node equivalent of schemas.py. */
import { ApplicationStatus, InterviewMode, InterviewResult } from './enums.js';
import { normalizeBranch, toApi } from './utils.js';
import { t } from './validation.js';

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

/* ---------- request shapes ---------- */
export const StudentRegister = {
  username: t.string({ min: 3, max: 50, pattern: USERNAME_PATTERN }),
  password: t.string({ min: 8, max: 128 }),
  name: t.string({ min: 1, max: 100 }),
  branch: t.string({ min: 2, max: 50, transform: normalizeBranch }),
  cgpa: t.number({ ge: 0, le: 10 }),
  active_backlogs: t.integer({ ge: 0, le: 50, default: 0 }),
};

export const CompanyRegister = {
  username: t.string({ min: 3, max: 50, pattern: USERNAME_PATTERN }),
  password: t.string({ min: 8, max: 128 }),
  name: t.string({ min: 1, max: 150 }),
  industry: t.string({ max: 100, default: '' }),
};

export const LoginForm = { username: t.string(), password: t.string() };

export const StudentNameUpdate = { name: t.string({ min: 1, max: 100 }) };

/** Only the placement coordinator may change academic data. */
export const AcademicRecordUpdate = {
  branch: t.string({ min: 2, max: 50, optional: true, transform: normalizeBranch }),
  cgpa: t.number({ ge: 0, le: 10, optional: true }),
  active_backlogs: t.integer({ ge: 0, le: 50, optional: true }),
};

export const JobCreate = {
  title: t.string({ min: 1, max: 150 }),
  description: t.string({ max: 5000, default: '' }),
  location: t.string({ max: 100, default: '' }),
  package_lpa: t.number({ gt: 0, le: 1000 }),
  min_cgpa: t.number({ ge: 0, le: 10, default: 0 }),
  max_active_backlogs: t.integer({ ge: 0, le: 50, default: 0 }),
  allowed_branches: t.list(t.string(), {
    max: 30, default: () => [],
    transform: (list) => [...new Set(list.filter((b) => b.trim()).map(normalizeBranch))].sort(),
  }),
};

export const ApplicationCreate = { job_id: t.integer() };

export const InterviewCreate = {
  scheduled_at: t.datetime(),
  mode: t.enum(InterviewMode, { default: InterviewMode.ONLINE }),
  location: t.string({ max: 200, default: '' }),
};

export const InterviewResultUpdate = {
  result: t.enum(InterviewResult, { reject: [InterviewResult.PENDING], rejectMessage: 'result must be PASSED or FAILED' }),
  remarks: t.string({ max: 2000, default: '' }),
};

export const OfferCreate = { package_lpa: t.number({ gt: 0, le: 1000, optional: true }) };

export const JobListQuery = { eligible_only: t.boolean({ default: false }) };
export const StudentListQuery = {
  branch: t.string({ optional: true }),
  placed: t.boolean({ optional: true }),
};
export const ApplicationListQuery = { status: t.enum(ApplicationStatus, { optional: true }) };

/* ---------- response serializers ---------- */
export const userOut = (u) => ({ id: u.id, username: u.username, role: u.role });

export const studentOut = (s) => ({
  id: s.id, name: s.name, branch: s.branch, cgpa: s.cgpa,
  active_backlogs: s.active_backlogs, is_placed: s.is_placed,
});

export const companyOut = (c) => ({ id: c.id, name: c.name, industry: c.industry });

export const jobOut = (j) => ({
  id: j.id, company_id: j.company_id, company_name: j.company_name, title: j.title,
  description: j.description, location: j.location, package_lpa: j.package_lpa,
  min_cgpa: j.min_cgpa, max_active_backlogs: j.max_active_backlogs,
  allowed_branches: j.allowed_branches, is_open: j.is_open, created_at: toApi(j.created_at),
});

export const interviewOut = (i) => i && ({
  id: i.id, application_id: i.application_id, scheduled_at: toApi(i.scheduled_at),
  mode: i.mode, location: i.location, result: i.result, remarks: i.remarks,
});

export const offerOut = (o) => o && ({
  id: o.id, application_id: o.application_id, package_lpa: o.package_lpa, status: o.status,
  issued_at: toApi(o.issued_at), responded_at: toApi(o.responded_at),
});

export const applicationOut = (a) => ({
  id: a.id, student_id: a.student_id, job_id: a.job_id, status: a.status, applied_at: toApi(a.applied_at),
  student: studentOut(a.student), job: jobOut(a.job),
  interview: interviewOut(a.interview), offer: offerOut(a.offer),
});
