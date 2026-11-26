// Negative paths: invalid input, business-rule violations, authentication and authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceToSelected, coordinator, future, makeCompany, makeJob, makeStudent, withClient,
} from './helpers.js';

const registerStudent = (c, json) => c.post('/auth/register/student', { json });

/* ---------- validation ---------- */
for (const cgpa of [-0.1, 10.1]) {
  test(`CGPA ${cgpa} out of range is rejected`, withClient(async (c) => {
    const r = await registerStudent(c, { username: 'bad', password: 'Password@123', name: 'X', branch: 'CSE', cgpa });
    assert.equal(r.status, 422);
    assert.deepEqual(r.json.detail[0].loc, ['body', 'cgpa']);
  }));
}

test('short password and negative backlogs are rejected', withClient(async (c) => {
  const base = { username: 'bad', name: 'X', branch: 'CSE', cgpa: 7 };
  assert.equal((await registerStudent(c, { ...base, password: 'short' })).status, 422);
  assert.equal((await registerStudent(c, { ...base, password: 'Password@123', active_backlogs: -1 })).status, 422);
}));

test('invalid username characters, missing fields and malformed JSON give 422', withClient(async (c) => {
  const ok = { password: 'Password@123', name: 'X', branch: 'CSE', cgpa: 7 };
  assert.equal((await registerStudent(c, { ...ok, username: 'bad name!' })).status, 422);
  const missing = await registerStudent(c, { username: 'abc' });
  assert.equal(missing.status, 422);
  assert.ok(missing.json.detail.some((d) => d.msg === 'Field required'));
  const bad = await c.request('POST', '/auth/register/student', {
    headers: { 'Content-Type': 'application/json' }, json: undefined });
  assert.equal(bad.status, 422);
}));

test('invalid job payload is rejected', withClient(async (c) => {
  const comp = await makeCompany(c);
  assert.equal((await c.post('/jobs', { json: { title: 'x', package_lpa: 0 }, headers: comp })).status, 422);
}));

test('invalid path / query params give 422', withClient(async (c) => {
  const coord = await coordinator(c);
  assert.equal((await c.get('/jobs/abc', { headers: coord })).status, 422);
  assert.equal((await c.get('/students?placed=maybe', { headers: coord })).status, 422);
}));

/* ---------- authentication ---------- */
test('duplicate username conflicts', withClient(async (c) => {
  await makeStudent(c);
  const r = await registerStudent(c, { username: 'rahul', password: 'Password@123', name: 'Other', branch: 'CSE', cgpa: 7 });
  assert.equal(r.status, 409);
}));

test('wrong password and unknown user get the same 401', withClient(async (c) => {
  await makeStudent(c);
  const bad = await c.post('/auth/login', { form: { username: 'rahul', password: 'wrong-password' } });
  const unknown = await c.post('/auth/login', { form: { username: 'ghost', password: 'wrong-password' } });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(bad.json, unknown.json);
  assert.equal(bad.headers.get('www-authenticate'), 'Bearer');
}));

test('missing or tampered token is 401', withClient(async (c) => {
  assert.equal((await c.get('/jobs')).status, 401);
  assert.equal((await c.get('/jobs', { headers: { Authorization: 'Bearer not.a.token' } })).status, 401);
  const [stuH] = await makeStudent(c);
  const tampered = stuH.Authorization.slice(0, -2) + (stuH.Authorization.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await c.get('/jobs', { headers: { Authorization: tampered } })).status, 401);
}));

/* ---------- authorization ---------- */
test('role restrictions', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  assert.equal((await c.post('/jobs', { json: { title: 't', package_lpa: 5 }, headers: stuH })).status, 403);
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: comp })).status, 403);
  assert.equal((await c.get('/reports/placement-statistics', { headers: stuH })).status, 403);
  assert.equal((await c.get('/reports/placement-statistics', { headers: comp })).status, 403);
  assert.equal((await c.get('/students', { headers: stuH })).status, 403);
  assert.equal((await c.patch('/students/1/academic-record', { json: { cgpa: 10 }, headers: stuH })).status, 403);
}));

test("a company cannot touch another company's data", withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const owner = await makeCompany(c, 'owner', 'Owner Co');
  const intruder = await makeCompany(c, 'intruder', 'Intruder Co');
  const job = await makeJob(c, owner);
  const appId = (await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).json.id;

  assert.equal((await c.get(`/jobs/${job.id}/applications`, { headers: intruder })).status, 403);
  assert.equal((await c.post(`/jobs/${job.id}/close`, { headers: intruder })).status, 403);
  assert.equal((await c.post(`/applications/${appId}/shortlist`, { headers: intruder })).status, 403);
  assert.equal((await c.get(`/applications/${appId}`, { headers: intruder })).status, 403);
}));

test("a student cannot see or accept another student's records", withClient(async (c) => {
  const [rahulH] = await makeStudent(c);
  const [otherH] = await makeStudent(c, { username: 'other', name: 'Other' });
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = await advanceToSelected(c, rahulH, comp, job.id);
  const offer = (await c.post(`/applications/${appId}/offer`, { headers: comp })).json;

  assert.equal((await c.get(`/applications/${appId}`, { headers: otherH })).status, 403);
  assert.equal((await c.post(`/offers/${offer.id}/accept`, { headers: otherH })).status, 403);
}));

/* ---------- eligibility / application rules ---------- */
test('ineligible student cannot apply', withClient(async (c) => {
  const [stuH] = await makeStudent(c, { cgpa: 6.99 });
  const job = await makeJob(c, await makeCompany(c));
  const r = await c.post('/applications', { json: { job_id: job.id }, headers: stuH });
  assert.equal(r.status, 400);
  assert.match(r.json.detail, /CGPA/);
}));

test('too many backlogs cannot apply', withClient(async (c) => {
  const [stuH] = await makeStudent(c, { backlogs: 3 });
  const job = await makeJob(c, await makeCompany(c));
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 400);
}));

test('boundary student can apply', withClient(async (c) => {
  const [stuH] = await makeStudent(c, { cgpa: 7.0, backlogs: 2 });
  const job = await makeJob(c, await makeCompany(c));
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 201);
}));

test('wrong branch cannot apply', withClient(async (c) => {
  const [stuH] = await makeStudent(c, { branch: 'MECH' });
  const job = await makeJob(c, await makeCompany(c), { allowed_branches: ['CSE', 'IT'] });
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 400);
}));

test('allowed branches are normalised', withClient(async (c) => {
  const job = await makeJob(c, await makeCompany(c), { allowed_branches: [' it ', 'cse', 'CSE', ''] });
  assert.deepEqual(job.allowed_branches, ['CSE', 'IT']);
}));

test('duplicate application conflicts', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const job = await makeJob(c, await makeCompany(c));
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 201);
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 409);
}));

test('applying to a closed or missing job', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  await c.post(`/jobs/${job.id}/close`, { headers: comp });
  assert.equal((await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).status, 400);
  assert.equal((await c.post('/applications', { json: { job_id: 9999 }, headers: stuH })).status, 404);
}));

test('a placed student cannot apply again', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const j1 = await makeJob(c, comp);
  const j2 = await makeJob(c, comp, { title: 'Second role' });
  const appId = await advanceToSelected(c, stuH, comp, j1.id);
  const offer = (await c.post(`/applications/${appId}/offer`, { headers: comp })).json;
  await c.post(`/offers/${offer.id}/accept`, { headers: stuH });
  assert.equal((await c.post('/applications', { json: { job_id: j2.id }, headers: stuH })).status, 400);
}));

/* ---------- workflow ordering ---------- */
test('workflow steps cannot be skipped', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = (await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).json.id;

  // APPLIED -> cannot interview or offer yet
  assert.equal((await c.post(`/applications/${appId}/interview`, { json: { scheduled_at: future() }, headers: comp })).status, 400);
  assert.equal((await c.post(`/applications/${appId}/offer`, { headers: comp })).status, 400);
  assert.equal((await c.put(`/applications/${appId}/interview/result`, { json: { result: 'PASSED' }, headers: comp })).status, 400);

  await c.post(`/applications/${appId}/shortlist`, { headers: comp });
  assert.equal((await c.post(`/applications/${appId}/shortlist`, { headers: comp })).status, 400); // twice
  assert.equal((await c.post(`/applications/${appId}/offer`, { headers: comp })).status, 400); // no interview
}));

test('an interview in the past is rejected', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = (await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).json.id;
  await c.post(`/applications/${appId}/shortlist`, { headers: comp });
  const past = new Date(Date.now() - 3_600_000).toISOString();
  assert.equal((await c.post(`/applications/${appId}/interview`, { json: { scheduled_at: past }, headers: comp })).status, 400);
  assert.equal((await c.post(`/applications/${appId}/interview`, { json: { scheduled_at: 'not a date' }, headers: comp })).status, 422);
}));

test('a failed interview blocks the offer', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = (await c.post('/applications', { json: { job_id: job.id }, headers: stuH })).json.id;
  await c.post(`/applications/${appId}/shortlist`, { headers: comp });
  await c.post(`/applications/${appId}/interview`, { json: { scheduled_at: future() }, headers: comp });
  const r = await c.put(`/applications/${appId}/interview/result`, { json: { result: 'FAILED' }, headers: comp });
  assert.equal(r.json.result, 'FAILED');
  assert.equal((await c.post(`/applications/${appId}/offer`, { headers: comp })).status, 400);
  // the result cannot be recorded twice, and PENDING is not a valid result
  assert.equal((await c.put(`/applications/${appId}/interview/result`, { json: { result: 'PASSED' }, headers: comp })).status, 400);
  assert.equal((await c.put(`/applications/${appId}/interview/result`, { json: { result: 'PENDING' }, headers: comp })).status, 422);
}));

test('an offer cannot be answered twice', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = await advanceToSelected(c, stuH, comp, job.id);
  const offer = (await c.post(`/applications/${appId}/offer`, { headers: comp })).json;
  assert.equal((await c.post(`/applications/${appId}/offer`, { headers: comp })).status, 400); // duplicate offer
  assert.equal((await c.post(`/offers/${offer.id}/accept`, { headers: stuH })).status, 200);
  assert.equal((await c.post(`/offers/${offer.id}/accept`, { headers: stuH })).status, 400);
  assert.equal((await c.post(`/offers/${offer.id}/decline`, { headers: stuH })).status, 400);
  assert.equal((await c.post('/offers/9999/accept', { headers: stuH })).status, 404);
}));

test('statistics with no students has no division error', withClient(async (c) => {
  const stats = (await c.get('/reports/placement-statistics', { headers: await coordinator(c) })).json;
  assert.equal(stats.placement_percentage, 0.0);
  assert.equal(stats.average_package_lpa, 0.0);
}));

test('registration is atomic: a failed profile insert leaves no orphan user', withClient(async (c) => {
  // two simultaneous registrations for the same username: exactly one wins
  const body = { username: 'racer', password: 'Password@123', name: 'R', branch: 'CSE', cgpa: 7 };
  const results = await Promise.all([registerStudent(c, body), registerStudent(c, body)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
}));
