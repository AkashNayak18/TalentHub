// End-to-end happy path: the ABC Technologies / Rahul scenario from the requirements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceToSelected, coordinator, makeCompany, makeJob, makeStudent, withClient } from './helpers.js';

test('full placement flow and statistics', withClient(async (c) => {
  const [rahulH] = await makeStudent(c);
  await makeStudent(c, { username: 'priya', name: 'Priya', cgpa: 6.0, backlogs: 0, branch: 'ECE' });
  const abcH = await makeCompany(c);
  const job = await makeJob(c, abcH);

  // Rahul sees the job as eligible; Priya (CGPA 6.0) does not.
  const eligible = await c.get('/jobs?eligible_only=true', { headers: rahulH });
  assert.deepEqual(eligible.json.map((j) => j.id), [job.id]);
  assert.equal((await c.get(`/jobs/${job.id}/eligibility`, { headers: rahulH })).json.eligible, true);

  const appId = await advanceToSelected(c, rahulH, abcH, job.id);
  assert.equal((await c.get(`/applications/${appId}`, { headers: rahulH })).json.status, 'SELECTED');

  const offer = await c.post(`/applications/${appId}/offer`, { headers: abcH });
  assert.equal(offer.status, 201);
  assert.equal(offer.json.package_lpa, 8.0);
  assert.equal(offer.json.status, 'ISSUED');

  const accepted = await c.post(`/offers/${offer.json.id}/accept`, { headers: rahulH });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.json.status, 'ACCEPTED');
  assert.equal((await c.get('/students/me', { headers: rahulH })).json.is_placed, true);
  assert.equal((await c.get(`/applications/${appId}`, { headers: rahulH })).json.status, 'OFFER_ACCEPTED');

  const coord = await coordinator(c);
  const stats = (await c.get('/reports/placement-statistics', { headers: coord })).json;
  assert.equal(stats.total_students, 2);
  assert.equal(stats.placed_students, 1);
  assert.equal(stats.placement_percentage, 50.0);
  assert.equal(stats.offers_accepted, 1);
  assert.equal(stats.highest_package_lpa, 8.0);
  assert.deepEqual(new Set(stats.branch_wise.map((b) => b.branch)), new Set(['CSE', 'ECE']));
  const placed = (await c.get('/reports/placed-students', { headers: coord })).json;
  assert.equal(placed[0].student_name, 'Rahul');
  assert.equal(placed[0].company, 'ABC Technologies');
}));

test('accepting one offer withdraws the others', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const c1 = await makeCompany(c, 'comp1', 'Company One');
  const c2 = await makeCompany(c, 'comp2', 'Company Two');
  const j1 = await makeJob(c, c1);
  const j2 = await makeJob(c, c2);
  const a1 = await advanceToSelected(c, stuH, c1, j1.id);
  const a2 = await advanceToSelected(c, stuH, c2, j2.id);
  const o1 = (await c.post(`/applications/${a1}/offer`, { headers: c1 })).json;
  const o2 = (await c.post(`/applications/${a2}/offer`, { headers: c2 })).json;

  assert.equal((await c.post(`/offers/${o1.id}/accept`, { headers: stuH })).status, 200);
  const offers = Object.fromEntries((await c.get('/offers/me', { headers: stuH })).json.map((o) => [o.id, o.status]));
  assert.deepEqual(offers, { [o1.id]: 'ACCEPTED', [o2.id]: 'WITHDRAWN' });
  assert.equal((await c.get(`/applications/${a2}`, { headers: stuH })).json.status, 'OFFER_WITHDRAWN');
}));

test('declined offer keeps the student unplaced', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = await advanceToSelected(c, stuH, comp, job.id);
  const offer = (await c.post(`/applications/${appId}/offer`, { headers: comp })).json;
  assert.equal((await c.post(`/offers/${offer.id}/decline`, { headers: stuH })).json.status, 'DECLINED');
  assert.equal((await c.get('/students/me', { headers: stuH })).json.is_placed, false);
}));

test('custom offer package and job closing', withClient(async (c) => {
  const [stuH] = await makeStudent(c);
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  const appId = await advanceToSelected(c, stuH, comp, job.id);
  const offer = await c.post(`/applications/${appId}/offer`, { json: { package_lpa: 9.5 }, headers: comp });
  assert.equal(offer.json.package_lpa, 9.5);
  assert.equal((await c.post(`/jobs/${job.id}/close`, { headers: comp })).json.is_open, false);
  assert.deepEqual((await c.get('/jobs', { headers: stuH })).json, []);
}));

test('coordinator corrects an academic record', withClient(async (c) => {
  const [stuH, stu] = await makeStudent(c, { cgpa: 6.5 });
  const comp = await makeCompany(c);
  const job = await makeJob(c, comp);
  assert.equal((await c.get(`/jobs/${job.id}/eligibility`, { headers: stuH })).json.eligible, false);
  const r = await c.patch(`/students/${stu.id}/academic-record`, { json: { cgpa: 7.5 }, headers: await coordinator(c) });
  assert.equal(r.status, 200);
  assert.equal(r.json.cgpa, 7.5);
  assert.equal((await c.get(`/jobs/${job.id}/eligibility`, { headers: stuH })).json.eligible, true);
}));
